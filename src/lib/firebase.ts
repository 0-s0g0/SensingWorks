import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  writeBatch,
  orderBy,
  limit,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { connectStorageEmulator, getBlob, getStorage, ref, uploadBytes } from 'firebase/storage';
import { type Action, type State, type Profile, type Attachment, transition } from './domain';
import { initialProject } from './seed';
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};
export const firebaseConfigured = !!(
  config.apiKey &&
  config.projectId &&
  config.authDomain &&
  config.appId
);
export const emulatorMode = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === 'true';
export const app = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(config)
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app && emulatorMode ? getStorage(app) : null;
// Never enables a paid Storage bucket in production. Spark deployments use attachment links.
const connected = globalThis as typeof globalThis & { __sensingEmulators?: boolean };
if (typeof window !== 'undefined' && emulatorMode && auth && db && !connected.__sensingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  if (storage) connectStorageEmulator(storage, '127.0.0.1', 9199);
  connected.__sensingEmulators = true;
}
export async function loginGoogle() {
  if (!auth) throw Error('Firebase設定がありません。');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}
export async function logoutFirebase() {
  if (auth) await signOut(auth);
}
export async function ensureProfile() {
  if (!db || !auth?.currentUser) throw Error('ログインが必要です。');
  const u = auth.currentUser,
    target = doc(db, 'users', u.uid),
    found = await getDoc(target);
  if (!found.exists())
    await setDoc(target, { name: u.displayName || 'メンバー', role: 'TEAM', active: true });
  return u.uid;
}
const collections: (keyof State)[] = [
  'users',
  'projects',
  'wbsItems',
  'taskDependencies',
  'taskAssignments',
  'completionReports',
  'weeklyReports',
  'pointAwards',
  'activityLogs',
];
export function subscribeWorkspace(
  role: Profile['role'],
  update: <K extends keyof State>(key: K, value: State[K]) => void,
  error: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const keys = role === 'OWNER' ? [...collections, 'rewardPrivate' as const] : collections;
  const unsub = keys.map((key) => {
    const target =
      key === 'activityLogs'
        ? query(collection(db!, key), orderBy('createdAt', 'desc'), limit(100))
        : collection(db!, key);
    return onSnapshot(
      target,
      (s) => update(key, s.docs.map((d) => ({ ...d.data(), id: d.id })) as State[typeof key]),
      (e) => error(e.message),
    );
  });
  return () => unsub.forEach((fn) => fn());
}
export function subscribeAvailability(
  start: string,
  end: string,
  update: (values: State['availability']) => void,
  error: (message: string) => void,
) {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, 'availability'), where('date', '>=', start), where('date', '<=', end)),
    (s) => update(s.docs.map((d) => ({ ...d.data(), id: d.id })) as State['availability']),
    (e) => error(e.message),
  );
}
function dataOf(value: { id: string }) {
  const { id, ...data } = value;
  void id;
  return data;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stable(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function saveAction(state: State, action: Action, user: Profile, database = db) {
  const db = database;
  if (!db) throw Error('Firebase設定がありません。');
  const next = transition(state, action, user);
  if (action.type === 'availability') {
    const userId = String(action.payload.userId ?? user.id),
      cells = action.payload.cells as { date: string; hour: number; status: string | null }[];
    // Independent hourly cells are idempotent; no read-before-write or paid backend is needed.
    for (let i = 0; i < cells.length; i += 400) {
      const batch = writeBatch(db);
      for (const c of cells.slice(i, i + 400)) {
        const target = doc(db, 'availability', `${userId}_${c.date}_${c.hour}`);
        if (c.status) batch.set(target, { userId, ...c });
        else batch.delete(target);
      }
      await batch.commit();
    }
    const log = next.activityLogs[0];
    await setDoc(doc(db, 'activityLogs', log.id), dataOf(log));
    return;
  }
  const changes: {
    key: keyof State;
    id: string;
    before: unknown;
    after: { id: string } | undefined;
  }[] = [];
  for (const key of Object.keys(state) as (keyof State)[]) {
    const before = new Map(state[key].map((x) => [x.id, x]));
    const after = new Map(next[key].map((x) => [x.id, x]));
    for (const id of new Set([...before.keys(), ...after.keys()]))
      if (stable(before.get(id)) !== stable(after.get(id)))
        changes.push({
          key,
          id,
          before: before.get(id) ? dataOf(before.get(id)!) : undefined,
          after: after.get(id),
        });
  }
  await runTransaction(db, async (tx) => {
    const reads = await Promise.all(changes.map((c) => tx.get(doc(db!, c.key, c.id))));
    changes.forEach((c, i) => {
      if (stable(reads[i].exists() ? reads[i].data() : undefined) !== stable(c.before))
        throw Error('他のメンバーが更新しました。最新の表示で操作をやり直してください。');
    });
    changes.forEach((c) => {
      const target = doc(db!, c.key, c.id);
      if (c.after) tx.set(target, dataOf(c.after));
      else tx.delete(target);
    });
  });
}
export async function initializeProject() {
  if (!db) throw Error('Firebase設定がありません。');
  if (!(await getDocs(query(collection(db, 'wbsItems'), limit(1)))).empty)
    throw Error('WBSは登録済みです。重複登録しません。');
  const s = initialProject(),
    first = writeBatch(db);
  s.projects.forEach((p) => first.set(doc(db!, 'projects', p.id), dataOf(p)));
  s.wbsItems
    .filter((w) => w.level === 1)
    .forEach((w) => first.set(doc(db!, 'wbsItems', w.id), dataOf(w)));
  await first.commit();
  for (const m of s.wbsItems.filter((w) => w.level === 2)) {
    const batch = writeBatch(db);
    [m, ...s.wbsItems.filter((w) => w.parentId === m.id)].forEach((w) =>
      batch.set(doc(db!, 'wbsItems', w.id), dataOf(w)),
    );
    s.taskDependencies
      .filter((d) => d.missionId === m.id)
      .forEach((d) => batch.set(doc(db!, 'taskDependencies', d.id), dataOf(d)));
    const r = s.rewardPrivate.find((r) => r.id === m.id)!;
    batch.set(doc(db, 'rewardPrivate', r.id), dataOf(r));
    await batch.commit();
  }
}
export async function uploadAttachment(missionId: string, file: File): Promise<Attachment> {
  if (!storage || !auth?.currentUser) throw Error('無料運用では添付リンクを使用してください。');
  if (file.size > 25 * 1024 * 1024) throw Error('添付ファイルは25MB以下にしてください。');
  const path = `attachments/${missionId}/${auth.currentUser.uid}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await uploadBytes(ref(storage, path), file);
  return { name: file.name, path, url: '' };
}
export async function downloadAttachment(file: Attachment) {
  if (!storage) throw Error('Storageエミュレーターが必要です。');
  const blob = await getBlob(ref(storage, file.path));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function saveAccess(allowedDomains: string[], allowedEmails: string[]) {
  if (!db) throw Error('Firebase設定がありません。');
  await setDoc(doc(db, 'settings', 'access'), { allowedDomains, allowedEmails });
}
export async function readAccess() {
  if (!db) return { allowedDomains: [], allowedEmails: [] };
  const snap = await getDoc(doc(db, 'settings', 'access'));
  return (snap.data() ?? { allowedDomains: [], allowedEmails: [] }) as {
    allowedDomains: string[];
    allowedEmails: string[];
  };
}
export async function updateUser(id: string, changes: Pick<Profile, 'role' | 'active'>) {
  if (!db) throw Error('Firebase設定がありません。');
  await setDoc(doc(db, 'users', id), changes, { merge: true });
}

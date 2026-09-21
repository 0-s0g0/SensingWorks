import { canManage } from './domain';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  serverTimestamp,
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
import { defaultAccess } from './access-config';
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
  const keys = canManage({ role }) ? [...collections, 'rewardPrivate' as const] : collections;
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
    // Check deletions transactionally: deleting an absent document cannot satisfy
    // ownership Rules, and a local snapshot alone can be stale after another tab clears it.
    for (let i = 0; i < cells.length; i += 400) {
      const chunk = cells.slice(i, i + 400);
      await runTransaction(db, async (tx) => {
        const clears = chunk.filter((c) => !c.status);
        const snapshots = await Promise.all(
          clears.map((c) => tx.get(doc(db, 'availability', `${userId}_${c.date}_${c.hour}`))),
        );
        const existing = new Set(snapshots.filter((s) => s.exists()).map((s) => s.id));
        for (const c of chunk) {
          const target = doc(db, 'availability', `${userId}_${c.date}_${c.hour}`);
          if (c.status) tx.set(target, { userId, date: c.date, hour: c.hour, status: c.status });
          else if (existing.has(target.id)) tx.delete(target);
        }
      });
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
export async function initializeProject(database = db) {
  if (!database) throw Error('Firebase設定がありません。');
  const s = initialProject();
  const base = [
    ...s.projects.map((p) => ({ key: 'projects', item: p })),
    ...s.wbsItems.filter((w) => w.level === 1).map((item) => ({ key: 'wbsItems', item })),
  ];
  await runTransaction(database, async (tx) => {
    const snapshots = await Promise.all(
      base.map(({ key, item }) => tx.get(doc(database, key, item.id))),
    );
    base.forEach(({ key, item }, i) => {
      if (!snapshots[i].exists()) tx.set(doc(database, key, item.id), dataOf(item));
    });
  });
  for (const m of s.wbsItems.filter((w) => w.level === 2)) {
    await runTransaction(database, async (tx) => {
      const target = doc(database, 'wbsItems', m.id);
      // Each mission group is atomic; a retry preserves all existing work.
      if ((await tx.get(target)).exists()) return;
      [m, ...s.wbsItems.filter((w) => w.parentId === m.id)].forEach((w) =>
        tx.set(doc(database, 'wbsItems', w.id), dataOf(w)),
      );
      s.taskDependencies
        .filter((d) => d.missionId === m.id)
        .forEach((d) => tx.set(doc(database, 'taskDependencies', d.id), dataOf(d)));
      const r = s.rewardPrivate.find((r) => r.id === m.id)!;
      tx.set(doc(database, 'rewardPrivate', r.id), dataOf(r));
    });
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
  if (
    allowedDomains.some(
      (d) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(d),
    ) ||
    allowedEmails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  )
    throw Error('完全なドメイン名・メールアドレスを入力してください。');
  if (!db) throw Error('Firebase設定がありません。');
  await setDoc(doc(db, 'settings', 'access'), { allowedDomains, allowedEmails });
}
export async function readAccess() {
  if (!db) return defaultAccess;
  const snap = await getDoc(doc(db, 'settings', 'access'));
  return (snap.data() ?? defaultAccess) as {
    allowedDomains: string[];
    allowedEmails: string[];
  };
}
export async function updateUser(id: string, changes: Pick<Profile, 'role' | 'active'>) {
  if (!db) throw Error('Firebase設定がありません。');
  await setDoc(doc(db, 'users', id), changes, { merge: true });
}

export async function recordLoginSession() {
  if (!db || !auth?.currentUser) return;
  const user = auth.currentUser;
  const token = await user.getIdTokenResult();
  const authTime = Number(token.claims.auth_time);
  const target = doc(db, 'loginSessions', `${user.uid}_${authTime}`);
  await runTransaction(db, async (tx) => {
    if ((await tx.get(target)).exists()) return;
    tx.set(target, {
      userId: user.uid,
      email: user.email,
      authTime,
      recordedAt: serverTimestamp(),
    });
  });
}
export type LoginSession = { id: string; userId: string; email: string; authTime: number };
export function subscribeLoginSessions(
  update: (rows: LoginSession[]) => void,
  error: (message: string) => void,
) {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, 'loginSessions'), orderBy('authTime', 'desc'), limit(100)),
    (snap) => update(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as LoginSession)),
    (e) => error(e.message),
  );
}

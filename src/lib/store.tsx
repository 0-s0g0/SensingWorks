'use client';
import { canManage } from './domain';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { addDays } from 'date-fns';
import { format, jstDate } from './time';
import { type Action, type State, type Profile, emptyState, transition, weekOf } from './domain';
import { createSeed, demoUserId } from './seed';
import {
  auth,
  db,
  firebaseConfigured,
  ensureProfile,
  recordLoginSession,
  subscribeWorkspace,
  subscribeAvailability,
  saveAction,
  logoutFirebase,
} from './firebase';
const STORAGE = 'sensingworks-firebase-demo-v2';
type Store = {
  state: State;
  user: Profile;
  ready: boolean;
  authenticated: boolean;
  demo: boolean;
  busy: boolean;
  error: string;
  act: (action: Action) => Promise<void>;
  switchUser: (id: string) => void;
  logout: () => Promise<void>;
  setAvailabilityWeek: (week: string) => void;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState),
    [userId, setUserId] = useState(demoUserId),
    [ready, setReady] = useState(false),
    [authenticated, setAuthenticated] = useState(!firebaseConfigured),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [week, setWeek] = useState(weekOf());
  const inFlight = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const user = state.users.find((u) => u.id === userId) ?? {
    id: userId,
    name: 'メンバー',
    role: 'TEAM' as const,
    active: false,
  };
  useEffect(() => {
    if (!auth) {
      let initial = createSeed();
      let selected = demoUserId;
      try {
        const raw = localStorage.getItem(STORAGE);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.state?.pointAwards && data.state?.wbsItems) {
            initial = { ...emptyState(), ...data.state };
            selected = data.userId ?? demoUserId;
          }
        }
      } catch {
        setError('保存済みデモを読み込めませんでした。');
      }
      setState(initial);
      setUserId(selected);
      setReady(true);
      return;
    }
    let unsubscribe = () => {},
      unprofile = () => {},
      generation = 0;
    const unauth = onAuthStateChanged(auth, async (fbUser) => {
      const current = ++generation;
      unsubscribe();
      unprofile();
      setState(emptyState());
      setAuthenticated(false);
      setError('');
      if (!fbUser) {
        setReady(true);
        return;
      }
      setUserId(fbUser.uid);
      try {
        await ensureProfile();
        await recordLoginSession();
        if (current !== generation) return;
        unprofile = onSnapshot(
          doc(db!, 'users', fbUser.uid),
          (snap) => {
            unsubscribe();
            setState(emptyState());
            const p = snap.exists() ? ({ ...snap.data(), id: snap.id } as Profile) : null;
            if (!p?.active) {
              setAuthenticated(false);
              setError('利用が許可されていません。Ownerに確認してください。');
              setReady(true);
              return;
            }
            setState((s) => ({ ...s, users: [p] }));
            setAuthenticated(true);
            setReady(true);
            unsubscribe = subscribeWorkspace(
              p.role,
              (key, value) => setState((s) => ({ ...s, [key]: value })),
              setError,
              p.id,
            );
          },
          (e) => {
            setError(e.message);
            setReady(true);
          },
        );
      } catch {
        if (current === generation) {
          setError(
            'このGoogleアカウントは許可されていません。Ownerにドメインまたはアカウントの許可を依頼してください。',
          );
          setReady(true);
        }
      }
    });
    return () => {
      generation++;
      unauth();
      unsubscribe();
      unprofile();
    };
  }, []);
  useEffect(() => {
    if (ready && !firebaseConfigured)
      localStorage.setItem(STORAGE, JSON.stringify({ state, userId }));
  }, [state, userId, ready]);
  useEffect(() => {
    if (!firebaseConfigured || !authenticated) return;
    return subscribeAvailability(
      week,
      format(addDays(jstDate(week), 13), 'yyyy-MM-dd'),
      (values) => setState((s) => ({ ...s, availability: values })),
      setError,
    );
  }, [week, authenticated, userId]);
  async function act(action: Action) {
    if (inFlight.current) throw Error('保存中です。');
    inFlight.current = true;
    setBusy(true);
    try {
      if (firebaseConfigured) await saveAction(state, action, user);
      else {
        const next = transition(stateRef.current, action, user);
        stateRef.current = next;
        setState(next);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  // Team sees only its own travel records and no management payment documents.
  const visible = {
    ...state,
    travelTemplates: state.travelTemplates.filter((t) => t.userId === user.id),
    ...(!canManage(user)
      ? {
          rewardPrivate: [],
          paymentStatements: [],
          paymentRevisions: [],
          aiFeeSettings: [],
          travelDeclarations: state.travelDeclarations.filter((d) => d.userId === user.id),
          travelClaims: state.travelClaims.filter((c) => c.userId === user.id),
        }
      : {}),
  };
  return (
    <Context.Provider
      value={{
        state: visible,
        user,
        ready,
        authenticated,
        demo: !firebaseConfigured,
        busy,
        error,
        act,
        switchUser: setUserId,
        logout: logoutFirebase,
        setAvailabilityWeek: setWeek,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const s = useContext(Context);
  if (!s) throw Error('StoreProvider is missing');
  return s;
}

import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
  updateDoc,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { saveAction, initializeProject } from '../../src/lib/firebase';
import type { Firestore } from 'firebase/firestore';
import { createSeed } from '../../src/lib/seed';
import { transition, type CompletionReport, type State } from '../../src/lib/domain';
let env: RulesTestEnvironment;
const token = {
  email: 'a@example.ac.jp',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' as const },
};
const as = (id: string) => env.authenticatedContext(id, token).firestore();
const body = <T extends { id: string }>(v: T) => {
  const { id, ...rest } = v;
  void id;
  return rest;
};
async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore(),
      s = createSeed(),
      b = writeBatch(db);
    for (const key of Object.keys(s) as (keyof State)[])
      for (const item of s[key]) b.set(doc(db, key, item.id), body(item));
    b.set(doc(db, 'settings', 'access'), {
      allowedDomains: ['example.ac.jp'],
      allowedEmails: ['friend@gmail.com'],
    });
    await b.commit();
  });
}
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sensingworks',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});
afterAll(async () => {
  await env.cleanup();
});
it('blocks unauthenticated access, reward reads, embedded money and privilege escalation', async () => {
  const a = as('demo-aoki');
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'wbsItems')));
  await assertSucceeds(getDocs(collection(a, 'wbsItems')));
  await assertFails(getDoc(doc(a, 'rewardPrivate', 'mission-2-2')));
  await assertFails(getDocs(collection(a, 'rewardPrivate')));
  await assertSucceeds(getDoc(doc(as('demo-owner'), 'rewardPrivate', 'mission-2-2')));
  await assertFails(updateDoc(doc(a, 'users', 'demo-aoki'), { role: 'OWNER' }));
  await assertFails(
    updateDoc(doc(as('demo-owner'), 'wbsItems', 'mission-2-3'), { rewardAmount: 3000 }),
  );
  await assertFails(updateDoc(doc(a, 'wbsItems', 'mission-2-2'), { pointValue: 99999 }));
});
it('permits verified Google domain and individually allowed accounts, rejects others', async () => {
  for (const [id, email, ok] of [
    ['new', 'new@example.ac.jp', true],
    ['friend', 'friend@gmail.com', true],
    ['bad', 'bad@gmail.com', false],
  ] as const) {
    const db = env.authenticatedContext(id, { ...token, email }).firestore();
    const attempt = setDoc(doc(db, 'users', id), { name: id, role: 'TEAM', active: true });
    if (ok) await assertSucceeds(attempt);
    else await assertFails(attempt);
  }
  const spoof = env.authenticatedContext('spoof', { ...token, email_verified: false }).firestore();
  await assertFails(
    setDoc(doc(spoof, 'users', 'spoof'), { name: 'x', role: 'TEAM', active: true }),
  );
});
it('shares weekly reports and schedules, restricts weekly editing to author, supports Owner deletions', async () => {
  const s = createSeed(),
    r = s.weeklyReports[0],
    a = as('demo-aoki'),
    owner = as('demo-owner');
  await assertSucceeds(getDoc(doc(a, 'weeklyReports', r.id)));
  await assertFails(updateDoc(doc(a, 'weeklyReports', r.id), { wentWell: '他人の変更' }));
  await assertFails(updateDoc(doc(owner, 'weeklyReports', r.id), { wentWell: 'Ownerの変更' }));
  const cell = doc(a, 'availability', 'demo-aoki_2026-09-25_15');
  await assertSucceeds(
    setDoc(cell, { userId: 'demo-aoki', date: '2026-09-25', hour: 15, status: 'AVAILABLE' }),
  );
  await assertSucceeds(getDoc(doc(as('demo-tanaka'), 'availability', cell.id)));
  await assertFails(deleteDoc(doc(as('demo-tanaka'), 'availability', cell.id)));
  await assertSucceeds(deleteDoc(doc(owner, 'availability', cell.id)));
});
function report(shares: Record<string, number>): CompletionReport {
  return {
    id: 'mission-2-2',
    missionId: 'mission-2-2',
    workSummary: '実装',
    result: '検証済み',
    wentWell: '',
    didNotGoWell: '',
    findings: '',
    remainingIssues: '',
    handoverNotes: '',
    workHours: 2,
    githubUrl: '',
    externalUrl: '',
    attachments: [],
    contributionShares: shares,
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'demo-aoki',
    version: 1,
    reviewComment: '',
  };
}
async function submit(shares: Record<string, number>, id = 'demo-aoki') {
  const db = as(id),
    b = writeBatch(db);
  b.set(doc(db, 'completionReports', 'mission-2-2'), body({ ...report(shares), updatedBy: id }));
  b.update(doc(db, 'wbsItems', 'mission-2-2'), { status: 'REPORT_SUBMITTED' });
  return b.commit();
}
it('requires an exact 100% report and atomically links submission to status', async () => {
  await assertFails(submit({ 'demo-aoki': 50, 'demo-tanaka': 30, 'demo-sato': 30 }));
  await assertFails(submit({ 'demo-aoki': 40, 'demo-tanaka': 30, 'demo-sato': 30 }, 'demo-owner'));
  await assertSucceeds(submit({ 'demo-aoki': 40, 'demo-tanaka': 30, 'demo-sato': 30 }));
  await assertSucceeds(getDoc(doc(as('demo-sato'), 'completionReports', 'mission-2-2')));
  await assertFails(
    updateDoc(doc(as('demo-aoki'), 'completionReports', 'mission-2-2'), {
      result: '変更',
      version: 2,
    }),
  );
});
it('validates six-person integer approval, immutable point awards, separate cash and no duplicate approval', async () => {
  const base = createSeed(),
    m = base.wbsItems.find((m) => m.id === 'mission-2-2')!;
  await env.withSecurityRulesDisabled(async (c) => {
    const b = writeBatch(c.firestore());
    for (let i = 4; i <= 6; i++) {
      const id = `team-${i}`;
      base.users.push({ id, name: id, role: 'TEAM', active: true });
      m.assigneeIds.push(id);
      b.set(doc(c.firestore(), 'users', id), { name: id, role: 'TEAM', active: true });
    }
    b.update(doc(c.firestore(), 'wbsItems', m.id), { assigneeIds: m.assigneeIds });
    await b.commit();
  });
  const shares = Object.fromEntries(m.assigneeIds.map((id, i) => [id, i === 0 ? 50 : 10]));
  await assertSucceeds(submit(shares));
  const submitted = transition(
    base,
    { type: 'completion', payload: { missionId: m.id, baseVersion: 0, report: report(shares) } },
    base.users[0],
  );
  const points = Object.fromEntries(m.assigneeIds.map((id, i) => [id, i === 0 ? 40 : 12])),
    amounts = Object.fromEntries(m.assigneeIds.map((id, i) => [id, i === 0 ? 5000 : 1000]));
  const approved = transition(
    submitted,
    { type: 'review', payload: { missionId: m.id, decision: 'approve', points, amounts } },
    base.users[3],
  );
  const db = as('demo-owner');
  async function approve(overrides?: Record<string, unknown>) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'wbsItems', m.id), {
      ...body(approved.wbsItems.find((x) => x.id === m.id)!),
      ...overrides,
    });
    batch.set(
      doc(db, 'completionReports', m.id),
      body(approved.completionReports.find((x) => x.id === m.id)!),
    );
    for (const a of approved.pointAwards.filter((a) => a.missionId === m.id))
      batch.set(doc(db, 'pointAwards', a.id), body(a));
    batch.set(
      doc(db, 'rewardPrivate', m.id),
      body(approved.rewardPrivate.find((r) => r.id === m.id)!),
    );
    return batch.commit();
  }
  await assertFails(approve({ finalPoints: { ...points, 'demo-aoki': 41 } }));
  await assertFails(approve({ finalPoints: { ...points, 'demo-aoki': 39.5 } }));
  // Copy exact submitted timestamps from the real document: owner may only change review fields.
  const real = (await getDoc(doc(db, 'completionReports', m.id))).data()!;
  Object.assign(
    approved.completionReports.find((r) => r.id === m.id)!,
    { submittedAt: real.submittedAt },
  );
  await assertSucceeds(approve());
  await assertFails(updateDoc(doc(db, 'pointAwards', `${m.id}_demo-aoki`), { points: 99 }));
  await assertFails(approve());
  const visible = await getDocs(collection(as('demo-aoki'), 'pointAwards'));
  expect(visible.docs.filter((d) => d.data().missionId === m.id)).toHaveLength(6);
});
it('restricts subtask edits and refuses direct auto-completion', async () => {
  await assertFails(
    updateDoc(doc(as('demo-aoki'), 'wbsItems', 'mission-3-1-step-1'), { status: 'COMPLETED' }),
  );
  await assertSucceeds(
    updateDoc(doc(as('demo-aoki'), 'wbsItems', 'mission-2-2-step-2'), { status: 'COMPLETED' }),
  );
  await assertFails(
    updateDoc(doc(as('demo-aoki'), 'wbsItems', 'mission-2-2'), { status: 'COMPLETED' }),
  );
});
it('protects emulator Storage uploads and permits team attachment reads', async () => {
  const a = env.authenticatedContext('demo-aoki', token).storage(),
    path = 'attachments/mission-2-2/demo-aoki/test.txt';
  await assertSucceeds(
    uploadBytes(ref(a, path), new TextEncoder().encode('experiment results'), {
      contentType: 'text/plain',
    }),
  );
  await assertSucceeds(
    getBytes(ref(env.authenticatedContext('demo-tanaka', token).storage(), path)),
  );
  await assertFails(
    uploadBytes(
      ref(
        env.authenticatedContext('demo-tanaka', token).storage(),
        'attachments/mission-2-2/demo-aoki/spoof.txt',
      ),
      new Uint8Array([1]),
    ),
  );
});

it('persists real client transactions: edits, collaborative report, Owner approval and shared reads', async () => {
  const ownerDb = as('demo-owner');
  async function snapshot(): Promise<State> {
    const data = createSeed();
    for (const key of Object.keys(data) as (keyof State)[]) {
      const rows = await getDocs(
        key === 'travelTemplates'
          ? query(collection(ownerDb, key), where('userId', '==', 'demo-owner'))
          : collection(ownerDb, key),
      );
      (data[key] as unknown[]) = rows.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return data;
  }
  let s = await snapshot();
  const owner = s.users.find((u) => u.id === 'demo-owner')!,
    team = s.users.find((u) => u.id === 'demo-aoki')!;
  const target = s.wbsItems.find((m) => m.id === 'mission-2-3')!;
  await assertSucceeds(
    saveAction(
      s,
      {
        type: 'mission',
        payload: {
          item: { ...target, title: '更新した中工程' },
          checklist: ['機材', '計測', '結果'],
          totalAmount: 3200,
        },
      },
      owner,
      ownerDb as unknown as Firestore,
    ),
  );
  s = await snapshot();
  expect(s.wbsItems.find((m) => m.id === target.id)?.title).toBe('更新した中工程');
  await assertSucceeds(
    saveAction(
      { ...s, rewardPrivate: [] },
      {
        type: 'completion',
        payload: {
          missionId: 'mission-2-2',
          report: report({ 'demo-aoki': 40, 'demo-tanaka': 30, 'demo-sato': 30 }),
          baseVersion: 0,
        },
      },
      team,
      as(team.id) as unknown as Firestore,
    ),
  );
  s = await snapshot();
  await assertSucceeds(
    saveAction(
      s,
      {
        type: 'review',
        payload: {
          missionId: 'mission-2-2',
          decision: 'approve',
          points: { 'demo-aoki': 50, 'demo-tanaka': 30, 'demo-sato': 20 },
          amounts: { 'demo-aoki': 4000, 'demo-tanaka': 3000, 'demo-sato': 3000 },
        },
      },
      owner,
      ownerDb as unknown as Firestore,
    ),
  );
  expect((await snapshot()).pointAwards.filter((a) => a.missionId === 'mission-2-2')).toHaveLength(
    3,
  );
});

it('defaults to the requested 0-s0g0.com domain without granting Owner automatically', async () => {
  await env.withSecurityRulesDisabled((c) => deleteDoc(doc(c.firestore(), 'settings', 'access')));
  const db = env
    .authenticatedContext('domain-member', { ...token, email: 'info@0-s0g0.com' })
    .firestore();
  await assertSucceeds(
    setDoc(doc(db, 'users', 'domain-member'), { name: 'Info', role: 'TEAM', active: true }),
  );
  await assertFails(getDoc(doc(db, 'rewardPrivate', 'mission-2-2')));
  const lookalike = env
    .authenticatedContext('lookalike', { ...token, email: 'info@0-s0g0.com.attacker.example' })
    .firestore();
  await assertFails(
    setDoc(doc(lookalike, 'users', 'lookalike'), { name: 'x', role: 'TEAM', active: true }),
  );
});

it('initialization resumes and preserves existing mission edits without fake awards', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'users', 'demo-owner'), {
      name: 'Owner',
      role: 'OWNER',
      active: true,
    });
  });
  const db = as('demo-owner');
  await initializeProject(db as unknown as Firestore);
  expect((await getDocs(collection(db, 'wbsItems'))).size).toBe(277);
  const mission = (await getDocs(collection(db, 'wbsItems'))).docs.find(
    (d) => d.data().level === 2,
  )!;
  await updateDoc(mission.ref, { title: 'Edited mission' });
  await initializeProject(db as unknown as Firestore);
  expect((await getDoc(mission.ref)).data()?.title).toBe('Edited mission');
  expect((await getDocs(collection(db, 'pointAwards'))).size).toBe(0);
});

it('unassigned Team can replace active assignees atomically but cannot alter points or finalized work', async () => {
  const s = createSeed();
  for (const key of Object.keys(s) as (keyof State)[]) {
    const rows = await getDocs(
      key === 'travelTemplates'
        ? query(collection(as('demo-owner'), key), where('userId', '==', 'demo-owner'))
        : collection(as('demo-owner'), key),
    );
    (s[key] as unknown[]) = rows.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const actor = s.users.find((u) => u.id === 'demo-sato')!;
  const db = as(actor.id);
  await assertSucceeds(
    saveAction(
      s,
      {
        type: 'assignment',
        payload: { missionId: 'mission-2-3', assigneeIds: [actor.id], primaryId: actor.id },
      },
      actor,
      db as unknown as Firestore,
    ),
  );
  expect((await getDoc(doc(db, 'wbsItems', 'mission-2-3'))).data()?.assigneeIds).toEqual([
    actor.id,
  ]);
  await assertFails(updateDoc(doc(db, 'wbsItems', 'mission-2-3'), { pointValue: 999 }));
  await assertFails(
    updateDoc(doc(db, 'wbsItems', 'mission-1-1'), { assigneeIds: [actor.id], primaryId: actor.id }),
  );
  await assertFails(
    updateDoc(doc(db, 'wbsItems', 'mission-2-3'), {
      assigneeIds: ['missing'],
      primaryId: 'missing',
    }),
  );
});

it('login history is immutable, token-bound and readable only by Owner', async () => {
  const db = env.authenticatedContext('demo-aoki', { ...token, auth_time: 123456 }).firestore();
  const target = doc(db, 'loginSessions', 'demo-aoki_123456');
  const record = {
    userId: 'demo-aoki',
    email: token.email,
    authTime: 123456,
    recordedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(target, record));
  await assertSucceeds(getDoc(target));
  await assertSucceeds(getDocs(collection(as('demo-owner'), 'loginSessions')));
  await assertFails(getDocs(collection(db, 'loginSessions')));
  await assertFails(getDoc(doc(as('demo-sato'), 'loginSessions', 'demo-aoki_123456')));
  await assertFails(
    setDoc(doc(db, 'loginSessions', 'demo-sato_123456'), { ...record, userId: 'demo-sato' }),
  );
  await assertFails(updateDoc(target, { authTime: 42 }));
  await assertFails(deleteDoc(target));
});

it('reference step edits are available to assignees, keep sibling progress and reject outsiders', async () => {
  const actor = createSeed().users.find((u) => u.id === 'demo-aoki')!;
  const db = as(actor.id);
  const snapshot = async () => {
    const s = createSeed();
    for (const key of Object.keys(s) as (keyof State)[]) {
      const rows = await getDocs(
        key === 'travelTemplates'
          ? query(collection(as('demo-owner'), key), where('userId', '==', 'demo-owner'))
          : collection(as('demo-owner'), key),
      );
      (s[key] as unknown[]) = rows.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return s;
  };
  const before = await snapshot();
  const existing = before.wbsItems.find((w) => w.wbsCode === '2.2.2')!;
  await assertSucceeds(
    saveAction(
      before,
      {
        type: 'subtask',
        payload: { id: existing.id, operation: 'rename', title: 'Edited reference' },
      },
      actor,
      db as unknown as Firestore,
    ),
  );
  await assertSucceeds(
    saveAction(
      await snapshot(),
      {
        type: 'subtask',
        payload: { missionId: 'mission-2-2', operation: 'add', title: 'New reference' },
      },
      actor,
      db as unknown as Firestore,
    ),
  );
  const after = await snapshot();
  const created = after.wbsItems.find((w) => w.title === 'New reference')!;
  await assertSucceeds(
    saveAction(
      after,
      { type: 'subtask', payload: { id: created.id, operation: 'delete' } },
      actor,
      db as unknown as Firestore,
    ),
  );
  const final = await snapshot();
  expect(final.wbsItems.find((w) => w.wbsCode === '2.2.1')).toEqual(
    before.wbsItems.find((w) => w.wbsCode === '2.2.1'),
  );
  expect(final.wbsItems.find((w) => w.id === existing.id)?.title).toBe('Edited reference');
  const outside = before.wbsItems.find((w) => w.wbsCode === '2.3.1')!;
  await assertFails(
    updateDoc(doc(as('demo-tanaka'), 'wbsItems', outside.id), { title: 'Unauthorized' }),
  );
});

it('start date updates preserve legacy documents and allow only Owner or assignees', async () => {
  const target = doc(as('demo-aoki'), 'wbsItems', 'mission-2-3');
  await assertSucceeds(updateDoc(target, { startDate: '2026-09-21' }));
  await assertFails(updateDoc(target, { startDate: '2027-04-01' }));
  await assertFails(
    updateDoc(doc(as('demo-tanaka'), 'wbsItems', 'mission-2-3'), { startDate: '2026-09-22' }),
  );
  await assertSucceeds(
    updateDoc(doc(as('demo-owner'), 'wbsItems', 'mission-2-3'), { startDate: '' }),
  );
});

it('Admin manages the app, is excluded from participation, and cannot self-register privileges', async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    setDoc(doc(c.firestore(), 'users', 'admin'), { name: 'Admin', role: 'ADMIN', active: true }),
  );
  const db = as('admin');
  await assertSucceeds(getDocs(collection(db, 'rewardPrivate')));
  await assertSucceeds(getDocs(collection(db, 'loginSessions')));
  await assertSucceeds(updateDoc(doc(db, 'wbsItems', 'phase-1'), { title: 'Admin edit' }));
  await assertSucceeds(updateDoc(doc(db, 'users', 'demo-sato'), { active: false }));
  await assertFails(
    updateDoc(doc(db, 'wbsItems', 'mission-2-3'), { assigneeIds: ['admin'], primaryId: 'admin' }),
  );
  await assertFails(
    setDoc(doc(db, 'availability', 'admin_2026-09-21_10'), {
      userId: 'admin',
      date: '2026-09-21',
      hour: 10,
      status: 'AVAILABLE',
    }),
  );
  await assertFails(
    setDoc(doc(db, 'weeklyReports', 'admin_2026-09-21'), {
      userId: 'admin',
      weekStart: '2026-09-21',
      wentWell: '',
      challenges: '',
      nextWeek: '',
      needHelp: '',
      mostTimeSpent: '',
      status: 'DRAFT',
      updatedAt: '',
    }),
  );
  await assertFails(
    setDoc(doc(as('new-admin'), 'users', 'new-admin'), { name: 'x', role: 'ADMIN', active: true }),
  );
  await assertFails(updateDoc(doc(as('demo-aoki'), 'users', 'demo-aoki'), { role: 'ADMIN' }));
});

it('MID mixed save and repeated clearing of empty slots succeeds for Team', async () => {
  const state = createSeed(),
    actor = state.users.find((u) => u.id === 'demo-aoki')!;
  const db = as(actor.id);
  const action = {
    type: 'availability' as const,
    payload: {
      userId: actor.id,
      cells: [
        { date: '2026-10-05', hour: 10, status: 'AVAILABLE' },
        { date: '2026-10-05', hour: 11, status: null },
      ],
    },
  };
  await assertSucceeds(saveAction(state, action, actor, db as unknown as Firestore));
  expect((await getDoc(doc(db, 'availability', `${actor.id}_2026-10-05_10`))).data()?.status).toBe(
    'AVAILABLE',
  );
  const clear = {
    type: 'availability' as const,
    payload: {
      userId: actor.id,
      cells: [
        { date: '2026-10-05', hour: 10, status: null },
        { date: '2026-10-05', hour: 11, status: null },
      ],
    },
  };
  await assertSucceeds(saveAction(state, clear, actor, db as unknown as Firestore));
  await assertSucceeds(saveAction(state, clear, actor, db as unknown as Firestore));
});

it('restricts individual payment statements to management and validates amounts', async () => {
  const s = createSeed();
  const owner = s.users.find((u) => u.role === 'OWNER')!;
  const id = 'demo-aoki_2026-09-01_2026-09-30';
  const payment = {
    userId: 'demo-aoki',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    aiFee: 3000,
    travelCost: 1200,
    pointRate: 100,
    variableCap: 5000,
  };
  await assertSucceeds(setDoc(doc(as(owner.id), 'paymentStatements', id), payment));
  await assertSucceeds(getDoc(doc(as(owner.id), 'paymentStatements', id)));
  await assertFails(getDoc(doc(as('demo-aoki'), 'paymentStatements', id)));
  await assertFails(getDocs(collection(as('demo-aoki'), 'paymentStatements')));
  await assertFails(setDoc(doc(as('demo-aoki'), 'paymentStatements', id), payment));
  await assertFails(updateDoc(doc(as(owner.id), 'paymentStatements', id), { variableCap: -1 }));
  await assertFails(updateDoc(doc(as(owner.id), 'paymentStatements', id), { pointRate: 1.5 }));
});

it('allows own travel claims and templates, management reads, and blocks other users', async () => {
  const state = createSeed();
  const team = state.users.find((u) => u.id === 'demo-aoki')!;
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  const item = {
    id: `${team.id}_2026-09-24`,
    userId: team.id,
    date: '2026-09-24',
    status: 'SUBMITTED' as const,
    departure: '自宅',
    arrival: '研究室',
    trip: 'ROUND_TRIP' as const,
    busFare: 220,
    trainFare: 350,
    parkingFee: 500,
  };
  await assertSucceeds(
    saveAction(
      state,
      { type: 'travelClaim', payload: { item } },
      team,
      as(team.id) as unknown as Firestore,
    ),
  );
  const { date, status, ...route } = item;
  const template = { ...route, id: `${team.id}_通勤`, name: '通勤' };
  await assertSucceeds(
    saveAction(
      state,
      { type: 'travelTemplate', payload: { item: template } },
      team,
      as(team.id) as unknown as Firestore,
    ),
  );
  await assertSucceeds(getDoc(doc(as(owner.id), 'travelClaims', item.id)));
  await assertSucceeds(getDocs(collection(as(owner.id), 'travelClaims')));
  await assertFails(getDocs(collection(as(team.id), 'travelClaims')));
  await assertSucceeds(
    getDocs(query(collection(as(team.id), 'travelClaims'), where('userId', '==', team.id))),
  );
  await assertSucceeds(
    getDocs(query(collection(as(team.id), 'travelTemplates'), where('userId', '==', team.id))),
  );
  const other = state.users.find((u) => u.role === 'TEAM' && u.id !== team.id)!;
  await assertFails(getDoc(doc(as(other.id), 'travelClaims', item.id)));
  await assertFails(getDoc(doc(as(owner.id), 'travelTemplates', template.id)));
  await assertFails(updateDoc(doc(as(other.id), 'travelClaims', item.id), { busFare: 1 }));
  await assertFails(updateDoc(doc(as(owner.id), 'travelClaims', item.id), { busFare: 1 }));
  await assertFails(updateDoc(doc(as(team.id), 'travelClaims', item.id), { busFare: -1 }));
  await assertSucceeds(updateDoc(doc(as(team.id), 'travelClaims', item.id), { status: 'DRAFT' }));
  await assertSucceeds(
    saveAction(
      state,
      {
        type: 'travelClaim',
        payload: { item: { ...item, id: `${owner.id}_${item.date}`, userId: owner.id } },
      },
      owner,
      as(owner.id) as unknown as Firestore,
    ),
  );
});

it('protects recurring AI fees and persists through saveAction', async () => {
  const state = createSeed();
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  const db = as(owner.id);
  await saveAction(
    state,
    { type: 'aiFeeSetting', payload: { item: { id: 'demo-aoki', monthlyFee: 3000 } } },
    owner,
    db as unknown as Firestore,
  );
  expect((await getDoc(doc(db, 'aiFeeSettings', 'demo-aoki'))).data()).toEqual({
    monthlyFee: 3000,
  });
  await assertFails(getDoc(doc(as('demo-aoki'), 'aiFeeSettings', 'demo-aoki')));
  await assertFails(getDocs(collection(as('demo-aoki'), 'aiFeeSettings')));
  await assertFails(setDoc(doc(as('demo-aoki'), 'aiFeeSettings', 'demo-aoki'), { monthlyFee: 1 }));
  await assertFails(setDoc(doc(db, 'aiFeeSettings', 'missing'), { monthlyFee: 1 }));
  for (const monthlyFee of [-1, 1.5, 100000001]) {
    await assertFails(updateDoc(doc(db, 'aiFeeSettings', 'demo-aoki'), { monthlyFee }));
  }
  await assertFails(updateDoc(doc(db, 'aiFeeSettings', 'demo-aoki'), { extra: true }));
});

it('limits no-travel declarations to the person and atomically cancels them when a claim is saved', async () => {
  const state = createSeed();
  const actor = state.users.find((u) => u.id === 'demo-aoki')!;
  const db = as(actor.id);
  const action = {
    type: 'travelDeclaration' as const,
    payload: { month: '2026-09', status: 'NONE' },
  };
  await saveAction(state, action, actor, db as unknown as Firestore);
  const target = doc(db, 'travelDeclarations', 'demo-aoki_2026-09');
  expect((await getDoc(target)).data()?.status).toBe('NONE');
  await assertFails(getDoc(doc(as('demo-tanaka'), 'travelDeclarations', 'demo-aoki_2026-09')));
  await assertFails(
    setDoc(doc(as('demo-tanaka'), 'travelDeclarations', 'demo-aoki_2026-09'), {
      userId: actor.id,
      month: '2026-09',
      status: 'NONE',
    }),
  );
  await assertFails(
    setDoc(doc(db, 'travelDeclarations', 'demo-aoki_2026-13'), {
      userId: actor.id,
      month: '2026-13',
      status: 'NONE',
    }),
  );
  await assertSucceeds(getDoc(doc(as('demo-owner'), 'travelDeclarations', 'demo-aoki_2026-09')));
  const item = {
    id: 'demo-aoki_2026-09-24',
    userId: actor.id,
    date: '2026-09-24',
    status: 'SUBMITTED' as const,
    departure: '自宅',
    arrival: '研究室',
    trip: 'ONE_WAY' as const,
    busFare: 200,
    trainFare: 0,
    parkingFee: 0,
  };
  await assertFails(setDoc(doc(db, 'travelClaims', item.id), body(item)));
  const next = transition(state, action, actor);
  // Use persisted logs so the transaction's optimistic checks see the same documents.
  next.activityLogs = (await getDocs(collection(db, 'activityLogs'))).docs.map(
    (d) => ({ ...d.data(), id: d.id }) as State['activityLogs'][number],
  );
  await saveAction(
    next,
    { type: 'travelClaim', payload: { item } },
    actor,
    db as unknown as Firestore,
  );
  expect((await getDoc(target)).data()?.status).toBe('CANCELLED');
  expect((await getDoc(doc(db, 'travelClaims', item.id))).data()?.busFare).toBe(200);
});

it('atomically saves payment revisions, rejects forged metadata and protects history from edits', async () => {
  const state = createSeed();
  const actor = state.users.find((u) => u.role === 'OWNER')!;
  const db = as(actor.id);
  const item = {
    id: 'demo-aoki_2026-09-01_2026-09-30',
    userId: 'demo-aoki',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    aiFee: 3000,
    travelCost: 1200,
    pointRate: 100,
    variableCap: 10000,
    amountMode: 'manual' as const,
    manualAmount: 40000,
    changeReason: '追加の作業を反映',
  };
  await saveAction(
    state,
    { type: 'payment', payload: { item } },
    actor,
    db as unknown as Firestore,
  );
  const target = doc(db, 'paymentStatements', item.id);
  const history = doc(db, 'paymentRevisions', `${item.id}_v1`);
  const saved = (await getDoc(target)).data()!;
  expect(saved.calculation.workAmount).toBe(40000);
  expect(saved.calculation.total).toBe(44200);
  expect((await getDoc(history)).data()?.after).toEqual(saved);
  await assertFails(updateDoc(target, { manualAmount: 45000 }));
  await assertFails(updateDoc(target, { updatedBy: 'demo-aoki' }));
  await assertFails(updateDoc(history, { before: {} }));
  await assertFails(deleteDoc(history));
  await assertFails(getDocs(collection(as('demo-aoki'), 'paymentRevisions')));
  await assertFails(
    setDoc(target, {
      userId: item.userId,
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      aiFee: 0,
      travelCost: 0,
      pointRate: 1,
      variableCap: 100,
    }),
  );
  const next = { ...state, paymentStatements: [{ ...saved, id: item.id }] } as State;
  next.paymentRevisions = [
    { ...(await getDoc(history)).data(), id: `${item.id}_v1` },
  ] as State['paymentRevisions'];
  next.activityLogs = (await getDocs(collection(db, 'activityLogs'))).docs.map(
    (d) => ({ ...d.data(), id: d.id }) as State['activityLogs'][number],
  );
  await saveAction(
    next,
    {
      type: 'payment',
      payload: { item: { ...item, manualAmount: 0, changeReason: '今月は支給なし' } },
    },
    actor,
    db as unknown as Firestore,
  );
  const second = (await getDoc(doc(db, 'paymentRevisions', `${item.id}_v2`))).data()!;
  expect(second.before).toEqual(saved);
  expect(second.after.calculation.total).toBe(4200);
});

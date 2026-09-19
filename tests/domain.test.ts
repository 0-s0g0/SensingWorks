import { describe, it, expect } from 'vitest';
import { createSeed } from '../src/lib/seed';
import {
  transition,
  distribute,
  validateAllocation,
  effectiveStatus,
  earnedPoints,
  weekOf,
  type CompletionReport,
} from '../src/lib/domain';
function draft(): CompletionReport {
  return {
    id: 'mission-2-2',
    missionId: 'mission-2-2',
    workSummary: '実装しました',
    result: '安定動作を確認',
    wentWell: '',
    didNotGoWell: '',
    findings: '',
    remainingIssues: '',
    handoverNotes: '',
    workHours: 12,
    githubUrl: '',
    externalUrl: '',
    attachments: [],
    contributionShares: { 'demo-aoki': 40, 'demo-tanaka': 30, 'demo-sato': 30 },
    status: 'SUBMITTED',
    submittedAt: null,
    updatedAt: '',
    updatedBy: 'demo-aoki',
    version: 0,
    reviewComment: '',
  };
}
describe('shared completion and integer point awards', () => {
  it('shares a draft, detects concurrent editing, validates percentages and awards once', () => {
    let s = createSeed();
    const [a, b, , owner] = s.users;
    s = transition(
      s,
      {
        type: 'completion',
        payload: {
          missionId: 'mission-2-2',
          report: { ...draft(), status: 'DRAFT' },
          baseVersion: 0,
        },
      },
      a,
    );
    expect(() =>
      transition(
        s,
        {
          type: 'completion',
          payload: { missionId: 'mission-2-2', report: draft(), baseVersion: 0 },
        },
        b,
      ),
    ).toThrow('共同担当者');
    expect(() =>
      transition(
        s,
        {
          type: 'completion',
          payload: {
            missionId: 'mission-2-2',
            report: {
              ...draft(),
              contributionShares: { 'demo-aoki': 50, 'demo-tanaka': 30, 'demo-sato': 30 },
            },
            baseVersion: 1,
          },
        },
        b,
      ),
    ).toThrow('100');
    s = transition(
      s,
      {
        type: 'completion',
        payload: { missionId: 'mission-2-2', report: draft(), baseVersion: 1 },
      },
      b,
    );
    expect(s.wbsItems.find((m) => m.id === 'mission-2-2')?.status).toBe('REPORT_SUBMITTED');
    const action = {
      type: 'review' as const,
      payload: {
        missionId: 'mission-2-2',
        decision: 'approve',
        points: { 'demo-aoki': 50, 'demo-tanaka': 30, 'demo-sato': 20 },
        amounts: { 'demo-aoki': 4000, 'demo-tanaka': 3000, 'demo-sato': 3000 },
      },
    };
    expect(() => transition(s, action, a)).toThrow('Owner');
    s = transition(s, action, owner);
    expect(s.pointAwards.filter((a) => a.missionId === 'mission-2-2').map((a) => a.points)).toEqual(
      [50, 30, 20],
    );
    expect(s.rewardPrivate.find((r) => r.id === 'mission-2-2')?.allocations['demo-aoki']).toBe(
      4000,
    );
    expect(() => transition(s, action, owner)).toThrow();
    expect(
      effectiveStatus(
        s.wbsItems.find((m) => m.id === 'mission-4-1')!,
        s.wbsItems,
      ),
    ).toBe('OPEN');
  });
  it('rejects decimals, missing users and overflow; rounds suggested distribution to integers', () => {
    expect(() => validateAllocation({ a: 0.5, b: 99.5 }, ['a', 'b'], 100, 'ポイント')).toThrow();
    expect(() => validateAllocation({ a: 100 }, ['a', 'b'], 100, 'ポイント')).toThrow();
    expect(() => validateAllocation({ a: 60, b: 50 }, ['a', 'b'], 100, 'ポイント')).toThrow();
    expect(distribute(100, ['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 });
  });
  it('reference tasks never approve their parent and unrelated members cannot edit', () => {
    let s = createSeed();
    const m = s.wbsItems.find((m) => m.id === 'mission-2-2')!;
    for (const c of s.wbsItems.filter((c) => c.parentId === m.id))
      s = transition(
        s,
        { type: 'subtask', payload: { id: c.id, status: 'COMPLETED' } },
        s.users[0],
      );
    expect(s.wbsItems.find((x) => x.id === m.id)?.status).toBe('IN_PROGRESS');
    expect(() =>
      transition(
        s,
        { type: 'subtask', payload: { id: 'mission-3-1-step-1', status: 'COMPLETED' } },
        s.users[0],
      ),
    ).toThrow('担当者');
  });
  it('keeps rewards separate from every public WBS and counts actual awarded points', () => {
    const s = createSeed();
    expect(s.wbsItems.every((m) => !('rewardAmount' in m) && !('reward_amount' in m))).toBe(true);
    expect(earnedPoints(s, 'demo-aoki')).toBe(230);
  });
  it('permits at most six assignees and preserves reference progress during editable mission changes', () => {
    let s = createSeed();
    const m = s.wbsItems.find((m) => m.id === 'mission-2-3')!;
    const item = { ...m, status: 'OPEN' as const };
    expect(() =>
      transition(
        s,
        {
          type: 'mission',
          payload: {
            item: { ...item, assigneeIds: Array(7).fill('demo-aoki') },
            totalAmount: 3000,
            checklist: [],
          },
        },
        s.users[3],
      ),
    ).toThrow();
    s = transition(
      s,
      { type: 'subtask', payload: { id: 'mission-2-3-step-1', status: 'COMPLETED' } },
      s.users[3],
    );
    s = transition(
      s,
      {
        type: 'mission',
        payload: { item, totalAmount: 3000, checklist: ['環境確認', '計測', '記録'] },
      },
      s.users[3],
    );
    expect(s.wbsItems.find((c) => c.id === 'mission-2-3-step-1')?.status).toBe('COMPLETED');
  });
});
describe('shared reports and availability', () => {
  it('edits only own weekly report and lets Owner manage other schedules', () => {
    let s = createSeed();
    const [a, b, , owner] = s.users;
    const cells = [{ date: '2026-09-25', hour: 15, status: 'AVAILABLE' }];
    expect(() =>
      transition(s, { type: 'availability', payload: { userId: b.id, cells } }, a),
    ).toThrow();
    s = transition(s, { type: 'availability', payload: { userId: b.id, cells } }, owner);
    s = transition(
      s,
      { type: 'availability', payload: { userId: b.id, cells: [{ ...cells[0], status: null }] } },
      b,
    );
    expect(s.availability).toHaveLength(0);
    expect(() =>
      transition(
        s,
        {
          type: 'report',
          payload: { report: { ...s.weeklyReports[0], wentWell: '', status: 'SUBMITTED' } },
        },
        a,
      ),
    ).toThrow('必須');
  });
  it('uses Monday midnight in Japan', () => {
    expect(weekOf(new Date('2026-09-20T15:00:00Z'))).toBe('2026-09-21');
    expect(weekOf(new Date('2026-09-20T14:59:59Z'))).toBe('2026-09-14');
  });
});

it('any active member can replace assignees without changing mission conditions or awards', () => {
  const s = createSeed();
  const actor = s.users.find((u) => u.id === 'demo-sato')!;
  const target = s.wbsItems.find((m) => m.id === 'mission-2-3')!;
  const next = transition(
    s,
    {
      type: 'assignment',
      payload: { missionId: target.id, assigneeIds: [actor.id], primaryId: actor.id },
    },
    actor,
  );
  expect(next.wbsItems.find((m) => m.id === target.id)?.assigneeIds).toEqual([actor.id]);
  expect(next.pointAwards).toEqual(s.pointAwards);
  expect(() =>
    transition(
      s,
      {
        type: 'assignment',
        payload: { missionId: 'mission-1-1', assigneeIds: [actor.id], primaryId: actor.id },
      },
      actor,
    ),
  ).toThrow();
});

it('start dates are optional, editable by assignees and cannot exceed deadlines', () => {
  const s = createSeed(), actor = s.users.find((u) => u.id === 'demo-aoki')!;
  const next = transition(s, { type: 'schedule', payload: { missionId: 'mission-2-2', startDate: '2026-09-21' } }, actor);
  expect(next.wbsItems.find((m) => m.id === 'mission-2-2')?.startDate).toBe('2026-09-21');
  for (const date of ['2027-04-01', '2027-02-30']) expect(() => transition(s, { type: 'schedule', payload: { missionId: 'mission-2-2', startDate: date } }, actor)).toThrow();
  expect(transition(next, { type: 'schedule', payload: { missionId: 'mission-2-2', startDate: '' } }, actor).wbsItems.find((m) => m.id === 'mission-2-2')?.startDate).toBe('');
});

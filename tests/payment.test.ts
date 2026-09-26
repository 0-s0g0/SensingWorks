import { describe, it, expect } from 'vitest';
import {
  calculatePayment,
  savedPaymentResult,
  defaultAmountMode,
  type PaymentStatement,
} from '../src/lib/payment';
import { transition, type PointAward } from '../src/lib/domain';
import { createSeed } from '../src/lib/seed';
const item: PaymentStatement = {
  id: 'demo-aoki_2026-09-01_2026-09-30',
  userId: 'demo-aoki',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  aiFee: 3000,
  travelCost: 1200,
  pointRate: 100,
  variableCap: 5000,
};
const award = (awardedAt: string, points: number, userId = item.userId): PointAward => ({
  id: awardedAt,
  missionId: 'm',
  approvedBy: 'owner',
  userId,
  points,
  awardedAt,
});
describe('payment statements', () => {
  it('includes both JST boundaries and excludes other users and outside dates', () => {
    expect(
      calculatePayment(item, [
        award('2026-08-31T15:00:00Z', 30),
        award('2026-09-30T14:59:59Z', 40),
        award('2026-08-31T14:59:59Z', 99),
        award('2026-09-30T15:00:00Z', 99),
        award('2026-09-10T00:00:00Z', 99, 'other'),
      ]),
    ).toEqual({ points: 70, rawVariable: 7000, variable: 5000, workAmount: 5000, total: 9200 });
  });
  it('handles no points, below cap, and zero cap', () => {
    expect(calculatePayment(item, []).total).toBe(4200);
    expect(calculatePayment(item, [award('2026-09-01', 2)]).variable).toBe(200);
    expect(calculatePayment({ ...item, variableCap: 0 }, [award('2026-09-01', 2)]).variable).toBe(
      0,
    );
  });
  it('rejects invalid dates, reversed periods and invalid money', () => {
    for (const change of [
      { periodEnd: '2026-09-31' },
      { periodEnd: '2026-08-31' },
      { aiFee: -1 },
      { pointRate: 1.5 },
      { variableCap: NaN },
    ])
      expect(() => calculatePayment({ ...item, ...change }, [])).toThrow();
  });
  it('persists by person and period, updates existing records and rejects team writes', () => {
    const state = createSeed();
    const owner = state.users.find((u) => u.role === 'OWNER')!;
    const team = state.users.find((u) => u.role === 'TEAM')!;
    const action = { type: 'payment' as const, payload: { item } };
    expect(() => transition(state, action, team)).toThrow();
    const saved = transition(state, action, owner);
    expect(saved.paymentStatements).toMatchObject([item]);
    expect(
      transition(saved, { ...action, payload: { item: { ...item, aiFee: 5000 } } }, owner)
        .paymentStatements,
    ).toHaveLength(1);
  });
});

it('restricts recurring AI fees to managers and preserves saved statements', () => {
  const state = createSeed();
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  const team = state.users.find((u) => u.role === 'TEAM')!;
  const saved = transition(state, { type: 'payment', payload: { item } }, owner);
  const action = {
    type: 'aiFeeSetting' as const,
    payload: { item: { id: team.id, monthlyFee: 5000 } },
  };
  expect(() => transition(saved, action, team)).toThrow();
  const next = transition(saved, action, owner);
  expect(next.aiFeeSettings).toEqual([{ id: team.id, monthlyFee: 5000 }]);
  expect(next.paymentStatements).toEqual(saved.paymentStatements);
  for (const monthlyFee of [-1, 1.5, NaN, 100000001]) {
    expect(() =>
      transition(next, { ...action, payload: { item: { id: team.id, monthlyFee } } }, owner),
    ).toThrow();
  }
});

it('keeps role separate from the mode and treats zero as an explicit manual amount', () => {
  expect(defaultAmountMode('OWNER')).toBe('manual');
  expect(defaultAmountMode('TEAM')).toBe('points');
  const awards = [award('2026-09-01', 30)];
  const manual = {
    ...item,
    amountMode: 'manual' as const,
    manualAmount: 40000,
    changeReason: 'リーダー業務分を調整',
  };
  expect(calculatePayment(manual, awards)).toMatchObject({
    rawVariable: 3000,
    variable: 3000,
    workAmount: 40000,
    total: 44200,
  });
  expect(calculatePayment({ ...manual, manualAmount: 0 }, awards).total).toBe(4200);
  expect(calculatePayment({ ...manual, manualAmount: null }, awards).workAmount).toBe(3000);
  expect(() => calculatePayment({ ...manual, changeReason: ' ' }, awards)).toThrow(/変更理由/);
  expect(() => calculatePayment({ ...manual, amountMode: 'points' }, awards)).toThrow();
  expect(() => calculatePayment({ ...manual, manualAmount: -1 }, awards)).toThrow();
});

it('freezes calculations and records before and after revisions without trusting client metadata', () => {
  const state = createSeed();
  const actor = state.users.find((u) => u.role === 'OWNER')!;
  state.pointAwards = [award('2026-09-01', 30)];
  const manual = {
    ...item,
    amountMode: 'manual' as const,
    manualAmount: 40000,
    changeReason: '調整',
    updatedBy: 'forged',
    revision: 999,
  };
  const first = transition(state, { type: 'payment', payload: { item: manual } }, actor);
  const statement = first.paymentStatements[0];
  expect(statement).toMatchObject({
    updatedBy: actor.id,
    revision: 1,
    roleAtSave: 'TEAM',
    calculation: { points: 30, rawVariable: 3000, workAmount: 40000, total: 44200 },
  });
  expect(first.paymentRevisions[0].before).toBeNull();
  first.pointAwards.push(award('2026-09-02', 20));
  expect(savedPaymentResult(statement, first.pointAwards).points).toBe(30);
  const second = transition(
    first,
    {
      type: 'payment',
      payload: {
        item: {
          ...statement,
          amountMode: 'points',
          manualAmount: null,
          changeReason: '通常の計算に戻す',
        },
      },
    },
    actor,
  );
  expect(second.paymentStatements[0]).toMatchObject({
    revision: 2,
    calculation: { points: 50, workAmount: 5000, total: 9200 },
  });
  expect(second.paymentRevisions).toHaveLength(2);
  expect(second.paymentRevisions[0]).toEqual(first.paymentRevisions[0]);
  expect(second.paymentRevisions[1].before).toMatchObject({
    manualAmount: 40000,
    calculation: { points: 30, total: 44200 },
  });
});

it('retains an old statement as the first before-record without inventing historical points', () => {
  const state = createSeed();
  const owner = state.users.find((u) => u.role === 'OWNER')!;
  state.paymentStatements = [item];
  const next = transition(
    state,
    {
      type: 'payment',
      payload: {
        item: { ...item, amountMode: 'manual', manualAmount: 10000, changeReason: '月額調整' },
      },
    },
    owner,
  );
  const { id, ...old } = item;
  expect(next.paymentRevisions[0].before).toEqual(old);
  expect(next.paymentRevisions[0].after.revision).toBe(1);
  expect(next.paymentStatements[0].id).toBe(id);
});

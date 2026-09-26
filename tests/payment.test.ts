import { describe, it, expect } from 'vitest';
import { calculatePayment, type PaymentStatement } from '../src/lib/payment';
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
    ).toEqual({ points: 70, rawVariable: 7000, variable: 5000, total: 9200 });
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
    expect(saved.paymentStatements).toEqual([item]);
    expect(
      transition(saved, { ...action, payload: { item: { ...item, aiFee: 5000 } } }, owner)
        .paymentStatements,
    ).toHaveLength(1);
  });
});

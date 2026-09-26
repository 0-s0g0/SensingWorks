import { expect, it } from 'vitest';
import { createSeed } from '../src/lib/seed';
import { monthlySettlement, monthPeriod } from '../src/lib/settlement';

it('uses calendar month boundaries including leap years', () => {
  expect(monthPeriod('2028-02').end).toBe('2028-02-29');
  expect(() => monthPeriod('2026-13')).toThrow();
});
it('prioritizes unresolved people and separates saved costs from live claims', () => {
  const state = createSeed();
  state.users = [
    { id: 'ready', name: 'あ', role: 'TEAM', active: true },
    { id: 'pending', name: 'ん', role: 'TEAM', active: true },
    { id: 'inactive', name: '旧メンバー', role: 'TEAM', active: false },
    { id: 'admin', name: '管理', role: 'ADMIN', active: true },
  ];
  state.pointAwards = [];
  state.travelDeclarations = [
    { id: 'ready_2026-09', userId: 'ready', month: '2026-09', status: 'NONE' },
  ];
  const base = {
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    aiFee: 3000,
    travelCost: 0,
    pointRate: 100,
    variableCap: 10000,
  };
  state.paymentStatements = [
    { ...base, id: 'ready_2026-09-01_2026-09-30', userId: 'ready' },
    { ...base, id: 'pending_2026-09-01_2026-09-30', userId: 'pending', travelCost: 100 },
  ];
  state.travelClaims = [
    {
      id: 'pending_2026-09-01',
      userId: 'pending',
      date: '2026-09-01',
      status: 'SUBMITTED',
      departure: 'A',
      arrival: 'B',
      trip: 'ONE_WAY',
      busFare: 200,
      trainFare: 0,
      parkingFee: 0,
    },
  ];
  const rows = monthlySettlement(state, '2026-09');
  expect(rows.map((r) => r.person.id)).toEqual(['pending', 'ready']);
  expect(rows[0].issues).toContain('交通費に差額あり');
  expect(rows[0].travel).toBe(200);
  expect(rows[0].result?.total).toBe(3100);
  expect(rows[1].issues).toEqual([]);
  // A stale or concurrent no-travel declaration cannot hide actual claims.
  state.travelDeclarations.push({
    id: 'pending_2026-09',
    userId: 'pending',
    month: '2026-09',
    status: 'NONE',
  });
  expect(monthlySettlement(state, '2026-09')[0].noTravel).toBe(false);
});

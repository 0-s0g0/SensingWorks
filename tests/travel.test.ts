import { it, expect } from 'vitest';
import { createSeed } from '../src/lib/seed';
import { transition } from '../src/lib/domain';
import {
  travelTotal,
  approvedTravelTotal,
  validateClaim,
  type TravelClaim,
} from '../src/lib/travel';
const claim: TravelClaim = {
  id: 'demo-aoki_2026-09-24',
  userId: 'demo-aoki',
  date: '2026-09-24',
  status: 'SUBMITTED',
  departure: '自宅',
  arrival: '研究室',
  trip: 'ROUND_TRIP',
  busFare: 220,
  trainFare: 350,
  parkingFee: 500,
};
it('doubles fares for round trips but parking only once', () => {
  expect(travelTotal(claim)).toBe(1640);
  expect(travelTotal({ ...claim, trip: 'ONE_WAY' })).toBe(1070);
});
it('aggregates only approved claims for the selected person and inclusive period', () => {
  expect(
    approvedTravelTotal(
      [
        { ...claim, status: 'APPROVED' },
        claim,
        { ...claim, status: 'REJECTED' },
        { ...claim, status: 'DRAFT' },
        { ...claim, userId: 'other' },
        { ...claim, date: '2026-09-25' },
      ],
      claim.userId,
      claim.date,
      claim.date,
    ),
  ).toBe(1640);
});
it('saves and updates own daily claim without duplicates for Team and Owner', () => {
  for (const role of ['TEAM', 'OWNER']) {
    const state = createSeed(),
      actor = state.users.find((u) => u.role === role)!;
    const item = { ...claim, id: `${actor.id}_${claim.date}`, userId: actor.id };
    const saved = transition(state, { type: 'travelClaim', payload: { item } }, actor);
    expect(saved.travelClaims).toEqual([item]);
    const updated = transition(
      saved,
      { type: 'travelClaim', payload: { item: { ...item, status: 'DRAFT' } } },
      actor,
    );
    expect(updated.travelClaims).toHaveLength(1);
    expect(updated.travelClaims[0].status).toBe('DRAFT');
    expect(() =>
      transition(
        state,
        { type: 'travelClaim', payload: { item: { ...item, userId: 'other' } } },
        actor,
      ),
    ).toThrow();
    expect(() =>
      transition(state, { type: 'travelClaim', payload: { item } }, { ...actor, role: 'ADMIN' }),
    ).toThrow();
  }
});
it('rejects invalid dates, fractions, negative fares, and missing routes', () => {
  for (const change of [
    { date: '2026-02-30' },
    { busFare: -1 },
    { trainFare: 1.2 },
    { parkingFee: NaN },
    { arrival: ' ' },
  ])
    expect(() => validateClaim({ ...claim, ...change })).toThrow();
});
it('updates named templates without changing historical claims', () => {
  const state = createSeed(),
    actor = state.users.find((u) => u.id === claim.userId)!;
  const { date, status, ...route } = claim;
  const item = { ...route, id: `${actor.id}_通勤`, name: '通勤' };
  const saved = transition(
    transition(state, { type: 'travelClaim', payload: { item: claim } }, actor),
    { type: 'travelTemplate', payload: { item } },
    actor,
  );
  const updated = transition(
    saved,
    { type: 'travelTemplate', payload: { item: { ...item, busFare: 300 } } },
    actor,
  );
  expect(updated.travelTemplates).toHaveLength(1);
  expect(updated.travelClaims[0].busFare).toBe(220);
});

it('records no-travel months, rejects contradictory declarations and cancels on a new claim', () => {
  const state = createSeed();
  const actor = state.users.find((u) => u.id === claim.userId)!;
  const action = {
    type: 'travelDeclaration' as const,
    payload: { month: '2026-09', status: 'NONE' },
  };
  const declared = transition(state, action, actor);
  expect(declared.travelDeclarations[0]).toMatchObject({
    userId: actor.id,
    month: '2026-09',
    status: 'NONE',
  });
  const updated = transition(declared, { type: 'travelClaim', payload: { item: claim } }, actor);
  expect(updated.travelDeclarations[0].status).toBe('CANCELLED');
  expect(() => transition(updated, action, actor)).toThrow(/記録/);
  expect(() => transition(state, action, { ...actor, role: 'ADMIN' })).toThrow();
  expect(() =>
    transition(state, { ...action, payload: { month: '2026-13', status: 'NONE' } }, actor),
  ).toThrow();
  expect(
    transition(declared, { ...action, payload: { month: '2026-09', status: 'CANCELLED' } }, actor)
      .travelDeclarations[0].status,
  ).toBe('CANCELLED');
});

it('requires ADMIN review, excludes pending/rejected costs, and allows rejected resubmission', () => {
  const state = createSeed();
  const team = state.users.find((u) => u.id === claim.userId)!;
  const admin = { id: 'admin', name: 'Admin', role: 'ADMIN' as const, active: true };
  state.users.push(admin);
  const pending = transition(state, { type: 'travelClaim', payload: { item: claim } }, team);
  const review = (status: string) => ({
    type: 'travelReview' as const,
    payload: { id: claim.id, status },
  });
  expect(approvedTravelTotal(pending.travelClaims, team.id, claim.date, claim.date)).toBe(0);
  for (const role of ['TEAM', 'LEADER', 'OWNER'] as const)
    expect(() => transition(pending, review('APPROVED'), { ...team, role })).toThrow(/ADMIN/);
  expect(() =>
    transition(
      state,
      { type: 'travelClaim', payload: { item: { ...claim, status: 'APPROVED' } } },
      team,
    ),
  ).toThrow();
  expect(() =>
    transition(
      state,
      { type: 'travelClaim', payload: { item: { ...claim, reviewedBy: admin.id } } },
      team,
    ),
  ).toThrow();
  const rejected = transition(pending, review('REJECTED'), admin);
  expect(rejected.travelClaims[0]).toMatchObject({ status: 'REJECTED', reviewedBy: admin.id });
  expect(approvedTravelTotal(rejected.travelClaims, team.id, claim.date, claim.date)).toBe(0);
  const resubmitted = transition(rejected, { type: 'travelClaim', payload: { item: claim } }, team);
  expect(resubmitted.travelClaims[0].reviewedBy).toBeUndefined();
  const approved = transition(resubmitted, review('APPROVED'), admin);
  expect(approvedTravelTotal(approved.travelClaims, team.id, claim.date, claim.date)).toBe(1640);
  expect(() =>
    transition(approved, { type: 'travelClaim', payload: { item: claim } }, team),
  ).toThrow(/承認済み/);
  expect(() => transition(approved, review('REJECTED'), admin)).toThrow(/承認待ち/);
  const draft = transition(
    state,
    { type: 'travelClaim', payload: { item: { ...claim, status: 'DRAFT' } } },
    team,
  );
  expect(() => transition(draft, review('APPROVED'), admin)).toThrow(/承認待ち/);
});

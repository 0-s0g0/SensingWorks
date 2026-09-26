import { it, expect } from 'vitest';
import { createSeed } from '../src/lib/seed';
import { transition } from '../src/lib/domain';
import {
  travelTotal,
  submittedTravelTotal,
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
it('aggregates only submitted claims for the selected person and inclusive period', () => {
  expect(
    submittedTravelTotal(
      [
        claim,
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

import { expect, it } from 'vitest';
import { compareUsers, transition } from '../src/lib/domain';
import { createSeed } from '../src/lib/seed';
import { availabilityCsv } from '../src/lib/csv';

it('uses numeric order, then names, with unnumbered users last', () => {
  const state = createSeed();
  state.users[0].userNumber = 10;
  state.users[1].userNumber = 2;
  state.users[2].userNumber = 2;
  expect([...state.users].sort(compareUsers).map((u) => u.id)).toEqual([
    'demo-sato',
    'demo-tanaka',
    'demo-aoki',
    'demo-owner',
  ]);
  const csv = availabilityCsv(state, '2026-09-21', 'team');
  expect(csv.indexOf('demo-sato')).toBeLessThan(csv.indexOf('demo-tanaka'));
  expect(csv.indexOf('demo-tanaka')).toBeLessThan(csv.indexOf('demo-aoki'));
});

it('lets managers assign and clear numbers, rejects invalid and participant writes', () => {
  const state = createSeed();
  const actor = state.users.find((u) => u.role === 'OWNER')!;
  const team = state.users[0];
  const action = (userNumber: unknown) => ({
    type: 'userNumber' as const,
    payload: { userId: team.id, userNumber },
  });
  const numbered = transition(state, action(3), actor);
  expect(numbered.users[0].userNumber).toBe(3);
  expect(transition(numbered, action(null), actor).users[0].userNumber).toBeNull();
  expect(() => transition(state, action(3), team)).toThrow();
  for (const number of [0, -1, 1.5, NaN, 1000000, '3'])
    expect(() => transition(state, action(number), actor)).toThrow();
});

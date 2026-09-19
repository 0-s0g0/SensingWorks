import { expect, it } from 'vitest';
import { weeklyWeeks, weeklyStatus } from '../src/lib/weekly';
import type { WeeklyReport } from '../src/lib/domain';
it('covers all 28 Mondays through March and uses the JST Monday deadline', () => {
  expect(weeklyWeeks).toHaveLength(28);
  expect(weeklyWeeks[0]).toBe('2026-09-21');
  expect(weeklyWeeks.at(-1)).toBe('2027-03-29');
  expect(weeklyStatus(weeklyWeeks[0], undefined, Date.parse('2026-09-21T14:59:59Z')).key).toBe('empty');
  expect(weeklyStatus(weeklyWeeks[0], undefined, Date.parse('2026-09-21T15:00:00Z')).key).toBe('overdue');
  expect(weeklyStatus(weeklyWeeks[0], { status: 'SUBMITTED' } as WeeklyReport, Date.parse('2026-09-22')).key).toBe('submitted');
  expect(weeklyStatus(weeklyWeeks[0], { status: 'DRAFT' } as WeeklyReport, Date.parse('2026-09-20')).key).toBe('draft');
});

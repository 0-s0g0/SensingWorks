import { it, expect } from 'vitest';
import { initialProject } from '../src/lib/seed';
import rows from '../src/lib/data/pet-poc-wbs.json';
it('preserves all 277 supplied rows, empty fields and every dependency', () => {
 const s = initialProject();
 expect(s.wbsItems).toHaveLength(277);
 expect(s.wbsItems.filter((w) => w.level === 2)).toHaveLength(57);
 expect(s.wbsItems.reduce((n,w) => n+w.pointValue,0)).toBe(3660);
 for (const row of rows) {
  const w = s.wbsItems.find((w) => w.wbsCode === row['WBS番号'])!;
  expect(w.title).toBe(row['工程名']);
  expect(w.deadline).toBe(''); expect(w.startDate).toBe(''); expect(w.assigneeIds).toEqual([]);
  expect(w.dependencyIds.map((id) => s.wbsItems.find((x) => x.id === id)!.wbsCode)).toEqual(row['前提WBS'].split('/').map((v) => v.trim()).filter(Boolean));
 }
 expect(s.rewardPrivate.every((r) => r.totalAmount === 0 && r.paymentStatus === 'DRAFT')).toBe(true);
 expect(s.pointAwards).toHaveLength(0);
});

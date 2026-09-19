import { expect, it } from 'vitest';
import { encodeCsv, wbsCsv, availabilityCsv, weeklyCsv } from '../src/lib/csv';
import { createSeed } from '../src/lib/seed';
it('quotes delimiters and newlines, adds UTF-8 BOM and neutralizes spreadsheet formulas', () => {
  const csv = encodeCsv([['日本語', 'a,"b"\nc', '=HYPERLINK("x")', '  +SUM(1,2)']]);
  expect(csv).toBe('\uFEFF"日本語","a,""b""\nc","\'=HYPERLINK(""x"")","\'  +SUM(1,2)"\r\n');
});
it('exports every WBS level with inherited step assignees and no private financial data', () => {
  const s = createSeed();
  const csv = wbsCsv(s);
  expect(csv.split('\r\n').length).toBe(s.wbsItems.length + 2);
  const step = csv.split('\r\n').find((r) => r.startsWith('"小工程","2.2.2"'))!;
  expect(step).toContain('青木 海斗');
  expect(step).toContain('中工程 2.2');
  expect(step).toContain('2027-03-31');
  expect(csv).toContain('"LOCKED"');
  expect(csv).not.toMatch(/reward|報酬|totalAmount|¥/);
});
it('exports the selected MID week and members, including unanswered hours and March cutoff', () => {
  const s = createSeed();
  s.availability = [
    { id: 'x', userId: 'demo-aoki', date: '2027-03-29', hour: 10, status: 'AVAILABLE' },
  ];
  const csv = availabilityCsv(s, '2027-03-29', 'demo-aoki');
  expect(csv.split('\r\n')).toHaveLength(3 * 14 + 2);
  expect(csv).toContain('"参加可能","AVAILABLE"');
  expect(csv).toContain('"未入力",""');
  expect(csv).not.toContain('2027-04-01');
  expect(csv).not.toContain('田中 美咲');
});

it('weekly export contains all 28 weeks and saved content, with a single-report scope', () => {
  const state = createSeed();
  state.weeklyReports = [
    {
      id: 'a',
      userId: 'demo-aoki',
      weekStart: '2026-09-21',
      status: 'SUBMITTED',
      updatedAt: '2026-09-21T12:00:00Z',
      wentWell: '実験成功',
      challenges: '課題あり',
      nextWeek: '再計測',
      needHelp: '',
      mostTimeSpent: '',
    },
  ];
  const all = weeklyCsv(state);
  expect(all).toContain('実験成功');
  expect(all).toContain('2027-03-29');
  expect(all).toContain('未提出');
  expect(all.split('\r\n')).toHaveLength(28 * state.users.length + 2);
  const one = weeklyCsv(state, { userId: 'demo-aoki', week: '2026-09-21' });
  expect(one.split('\r\n')).toHaveLength(3);
  expect(one).toContain('提出済み');
  expect(one).not.toContain('田中 美咲');
  expect(one).toContain('2026-09-21 21:00:00');
});

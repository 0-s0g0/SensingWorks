import { addWeeks } from 'date-fns';
import { format, jstDate } from './time';
import { weekOf, type WeeklyReport } from './domain';
export const weeklyStart = '2026-09-21';
export const weeklyEnd = '2027-03-29';
export const weeklyWeeks = Array.from({ length: 28 }, (_, i) =>
  format(addWeeks(jstDate(weeklyStart), i), 'yyyy-MM-dd'),
);
export const currentReportWeek = () => {
  const week = weekOf();
  return week < weeklyStart ? weeklyStart : week > weeklyEnd ? weeklyEnd : week;
};
export const weeklyFields = [
  ['wentWell', '今週うまくいったこと'],
  ['challenges', '今週悩んだこと'],
  ['nextWeek', '来週やること'],
  ['needHelp', '相談したいこと'],
  ['mostTimeSpent', '一番時間を使ったこと'],
] as const;
export function weeklyStatus(week: string, report?: WeeklyReport, now = Date.now()) {
  if (report?.status === 'SUBMITTED') return { key: 'submitted', label: '提出済み', symbol: '✓' };
  const overdue = now > new Date(`${week}T23:59:59.999+09:00`).getTime();
  if (overdue)
    return { key: 'overdue', label: report ? '締切超過・下書き' : '締切超過・未提出', symbol: '!' };
  if (report) return { key: 'draft', label: '下書き', symbol: '下書き' };
  return { key: 'empty', label: '未提出', symbol: '—' };
}

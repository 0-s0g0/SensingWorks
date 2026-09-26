import type { PointAward } from './domain';
import { format } from './time';
export type PaymentStatement = {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  aiFee: number;
  travelCost: number;
  pointRate: number;
  variableCap: number;
};
export function validPaymentDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validatePayment(p: PaymentStatement) {
  if (
    !validPaymentDate(p.periodStart) ||
    !validPaymentDate(p.periodEnd) ||
    p.periodStart > p.periodEnd
  )
    throw Error('支払い対象期間を正しい日付・順序で入力してください。');
  for (const value of [p.aiFee, p.travelCost, p.pointRate, p.variableCap])
    if (!Number.isSafeInteger(value) || value < 0 || value > 100000000)
      throw Error('金額・単価・上限は0〜100,000,000円の整数で入力してください。');
  if (p.id !== `${p.userId}_${p.periodStart}_${p.periodEnd}`) throw Error('明細IDが不正です。');
}
export function calculatePayment(p: PaymentStatement, awards: PointAward[]) {
  validatePayment(p);
  const points = awards
    .filter(
      (a) =>
        a.userId === p.userId &&
        format(a.awardedAt, 'yyyy-MM-dd') >= p.periodStart &&
        format(a.awardedAt, 'yyyy-MM-dd') <= p.periodEnd,
    )
    .reduce((sum, a) => sum + a.points, 0);
  const rawVariable = points * p.pointRate;
  if (!Number.isSafeInteger(points) || !Number.isSafeInteger(rawVariable))
    throw Error('計算可能な金額の範囲を超えています。');
  const variable = Math.min(rawVariable, p.variableCap);
  return { points, rawVariable, variable, total: p.aiFee + p.travelCost + variable };
}

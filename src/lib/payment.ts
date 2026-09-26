import type { PointAward, Profile } from './domain';
import { format } from './time';
export type PaymentCalculation = {
  points: number;
  rawVariable: number;
  variable: number;
  workAmount: number;
  total: number;
};
export type PaymentStatement = {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  aiFee: number;
  travelCost: number;
  pointRate: number;
  variableCap: number;
  // Optional for legacy statements, which used automatic calculation only.
  amountMode?: 'points' | 'manual';
  manualAmount?: number | null;
  changeReason?: string;
  roleAtSave?: Profile['role'];
  calculation?: PaymentCalculation;
  revision?: number;
  updatedBy?: string;
  updatedAt?: string;
};
export type PaymentRevision = {
  id: string;
  statementId: string;
  before: Omit<PaymentStatement, 'id'> | null;
  after: Omit<PaymentStatement, 'id'>;
};
export const defaultAmountMode = (role: Profile['role']) =>
  role === 'OWNER' ? 'manual' : 'points';
export const hasManualAmount = (p: PaymentStatement) =>
  p.amountMode === 'manual' && p.manualAmount != null;
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
  for (const value of [
    p.aiFee,
    p.travelCost,
    p.pointRate,
    p.variableCap,
    ...(p.manualAmount == null ? [] : [p.manualAmount]),
  ])
    if (!Number.isSafeInteger(value) || value < 0 || value > 100000000)
      throw Error('金額・単価・上限は0〜100,000,000円の整数で入力してください。');
  if (p.amountMode !== undefined && !['points', 'manual'].includes(p.amountMode))
    throw Error('金額の決定方法が不正です。');
  if (p.manualAmount != null && p.amountMode !== 'manual')
    throw Error('手動金額は手動設定を選択したときのみ入力できます。');
  if (
    p.changeReason !== undefined &&
    (typeof p.changeReason !== 'string' || p.changeReason.length > 1000)
  )
    throw Error('変更理由は1,000文字以内で入力してください。');
  if (hasManualAmount(p) && !p.changeReason?.trim())
    throw Error('手動設定の変更理由を入力してください。');
  if (p.id !== `${p.userId}_${p.periodStart}_${p.periodEnd}`) throw Error('明細IDが不正です。');
}
export function calculatePayment(p: PaymentStatement, awards: PointAward[]): PaymentCalculation {
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
  const workAmount = hasManualAmount(p) ? p.manualAmount! : variable;
  return { points, rawVariable, variable, workAmount, total: p.aiFee + p.travelCost + workAmount };
}
export function savedPaymentResult(p: PaymentStatement, awards: PointAward[]) {
  return p.calculation ?? calculatePayment(p, awards);
}
export function preparePayment(
  p: PaymentStatement,
  awards: PointAward[],
  role: Profile['role'],
  actorId: string,
  now: string,
  revision: number,
): PaymentStatement {
  const calculation = calculatePayment(p, awards);
  return {
    id: p.id,
    userId: p.userId,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    aiFee: p.aiFee,
    travelCost: p.travelCost,
    pointRate: p.pointRate,
    variableCap: p.variableCap,
    amountMode: p.amountMode ?? 'points',
    manualAmount: p.manualAmount ?? null,
    changeReason: p.changeReason?.trim() || 'ポイントから自動計算',
    roleAtSave: role,
    calculation,
    revision,
    updatedBy: actorId,
    updatedAt: now,
  };
}

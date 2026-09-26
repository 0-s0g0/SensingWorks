import { validPaymentDate } from './payment';
export type TravelRoute = {
  departure: string;
  arrival: string;
  trip: 'ONE_WAY' | 'ROUND_TRIP';
  busFare: number;
  trainFare: number;
  parkingFee: number;
};
export type TravelClaim = TravelRoute & {
  id: string;
  userId: string;
  date: string;
  status: 'DRAFT' | 'SUBMITTED';
};
export type TravelTemplate = TravelRoute & { id: string; userId: string; name: string };
export const emptyRoute = (): TravelRoute => ({
  departure: '',
  arrival: '',
  trip: 'ROUND_TRIP',
  busFare: 0,
  trainFare: 0,
  parkingFee: 0,
});
export function validateRoute(r: TravelRoute) {
  if (
    ![r.departure, r.arrival].every(
      (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200,
    )
  )
    throw Error('出発地・到着地を200文字以内で入力してください。');
  if (!['ONE_WAY', 'ROUND_TRIP'].includes(r.trip))
    throw Error('片道または往復を選択してください。');
  if (
    ![r.busFare, r.trainFare, r.parkingFee].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1000000,
    )
  )
    throw Error('各料金は0〜1,000,000円の整数で入力してください。');
}
export function validateClaim(c: TravelClaim) {
  validateRoute(c);
  if (!validPaymentDate(c.date) || c.id !== `${c.userId}_${c.date}`)
    throw Error('利用日を正しく入力してください。');
  if (!['DRAFT', 'SUBMITTED'].includes(c.status)) throw Error('申請状態が不正です。');
}
export function travelTotal(r: TravelRoute) {
  return (r.busFare + r.trainFare) * (r.trip === 'ROUND_TRIP' ? 2 : 1) + r.parkingFee;
}
export function submittedTravelTotal(
  claims: TravelClaim[],
  userId: string,
  start: string,
  end: string,
) {
  return claims
    .filter(
      (c) => c.userId === userId && c.status === 'SUBMITTED' && c.date >= start && c.date <= end,
    )
    .reduce((sum, c) => sum + travelTotal(c), 0);
}

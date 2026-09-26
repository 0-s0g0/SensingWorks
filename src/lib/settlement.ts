import { endOfMonth } from 'date-fns';
import { compareUsers, isParticipant, type State } from './domain';
import { savedPaymentResult, validPaymentDate } from './payment';
import { format, jstDate } from './time';
import { submittedTravelTotal } from './travel';

export function monthPeriod(month: string) {
  const start = `${month}-01`;
  if (!validPaymentDate(start)) throw Error('対象月を確認してください。');
  return { start, end: format(endOfMonth(jstDate(start)), 'yyyy-MM-dd') };
}

export function monthlySettlement(state: State, month: string) {
  const { start, end } = monthPeriod(month);
  return state.users
    .filter((u) => isParticipant(u))
    .map((person) => {
      const claims = state.travelClaims.filter(
        (c) => c.userId === person.id && c.date >= start && c.date <= end,
      );
      const awards = state.pointAwards.filter(
        (a) =>
          a.userId === person.id &&
          format(a.awardedAt, 'yyyy-MM-dd') >= start &&
          format(a.awardedAt, 'yyyy-MM-dd') <= end,
      );
      const statement = state.paymentStatements.find(
        (p) => p.userId === person.id && p.periodStart === start && p.periodEnd === end,
      );
      const declaration = state.travelDeclarations.find(
        (d) => d.userId === person.id && d.month === month,
      );
      const noTravel = declaration?.status === 'NONE' && claims.length === 0;
      const travel = submittedTravelTotal(claims, person.id, start, end);
      const draftCount = claims.filter((c) => c.status === 'DRAFT').length;
      const result = statement ? savedPaymentResult(statement, awards) : undefined;
      const livePoints = awards.reduce((sum, a) => sum + a.points, 0);
      const issues: string[] = [];
      if (statement?.calculation && statement.calculation.points !== livePoints)
        issues.push('保存後にポイント変更あり');
      if (statement && statement.travelCost !== travel) issues.push('交通費に差額あり');
      if (!statement) issues.push('明細未作成');
      if (draftCount) issues.push(`交通費の下書き ${draftCount}件`);
      if (!noTravel && !claims.some((c) => c.status === 'SUBMITTED'))
        issues.push('交通費の申告待ち');
      if (declaration?.status === 'NONE' && claims.length > 0)
        issues.push('交通費なしの申告と記録が不一致');
      return {
        person,
        claims,
        awards,
        statement,
        noTravel,
        travel,
        result,
        issues,
        points: result?.points ?? livePoints,
        livePoints,
        aiFee:
          statement?.aiFee ?? state.aiFeeSettings.find((s) => s.id === person.id)?.monthlyFee ?? 0,
        included:
          person.active || claims.length > 0 || awards.length > 0 || !!statement || noTravel,
      };
    })
    .filter((r) => r.included)
    .sort((a, b) => compareUsers(a.person, b.person));
}

export function teamPointProgress(state: State, month: string) {
  const { start, end } = monthPeriod(month);
  const teamIds = new Set(state.users.filter((u) => u.role === 'TEAM').map((u) => u.id));
  const earned = state.pointAwards
    .filter(
      (a) =>
        teamIds.has(a.userId) &&
        format(a.awardedAt, 'yyyy-MM-dd') >= start &&
        format(a.awardedAt, 'yyyy-MM-dd') <= end,
    )
    .reduce((sum, a) => sum + a.points, 0);
  const target = 7500;
  return {
    earned,
    target,
    remaining: Math.max(0, target - earned),
    excess: Math.max(0, earned - target),
    percent: (earned / target) * 100,
  };
}

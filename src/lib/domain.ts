import { validateClaim, validateRoute, type TravelClaim, type TravelTemplate } from './travel';
import {
  validPaymentDate,
  preparePayment,
  type PaymentStatement,
  type PaymentRevision,
} from './payment';
import { addDays, startOfWeek } from 'date-fns';
import { format, jstDate } from './time';
export type Status =
  | 'LOCKED'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'REPORT_SUBMITTED'
  | 'REVIEW'
  | 'REVISION'
  | 'COMPLETED'
  | 'ON_HOLD';
export type AvailabilityStatus = 'AVAILABLE' | 'MAYBE' | 'UNAVAILABLE';
export type Profile = {
  id: string;
  name: string;
  role: 'TEAM' | 'LEADER' | 'OWNER' | 'ADMIN';
  active: boolean;
};
export const canManage = (user: Pick<Profile, 'role'>) =>
  user.role === 'OWNER' || user.role === 'ADMIN';
export const isParticipant = (user: Profile) => user.role !== 'ADMIN';
export type Project = { id: string; name: string; startDate: string; endDate: string };
export type WbsItem = {
  id: string;
  projectId: string;
  parentId: string | null;
  wbsCode: string;
  level: 1 | 2 | 3;
  title: string;
  description: string;
  pointValue: number;
  status: Status;
  deadline: string;
  startDate?: string;
  assigneeIds: string[];
  primaryId: string | null;
  dependencyIds: string[];
  autoUnlock: boolean;
  order: number;
  completedAt: string | null;
  approvedBy: string | null;
  finalPoints: Record<string, number>;
};
export type Mission = WbsItem;
export type TaskAssignment = {
  id: string;
  missionId: string;
  userId: string;
  isPrimary: boolean;
  assignedAt: string;
};
export type TaskDependency = { id: string; missionId: string; dependsOnId: string };
export type Attachment = { name: string; url: string; path: string };
export type CompletionReport = {
  id: string;
  missionId: string;
  workSummary: string;
  result: string;
  wentWell: string;
  didNotGoWell: string;
  findings: string;
  remainingIssues: string;
  handoverNotes: string;
  workHours: number;
  githubUrl: string;
  externalUrl: string;
  attachments: Attachment[];
  contributionShares: Record<string, number>;
  status: 'DRAFT' | 'SUBMITTED' | 'REVISION' | 'APPROVED';
  submittedAt: string | null;
  updatedAt: string;
  updatedBy: string;
  version: number;
  reviewComment: string;
};
export type PointAward = {
  id: string;
  missionId: string;
  userId: string;
  points: number;
  awardedAt: string;
  approvedBy: string;
};
export type RewardPrivate = {
  id: string;
  missionId: string;
  totalAmount: number;
  allocations: Record<string, number>;
  approvedAt: string | null;
  approvedBy: string | null;
  paymentStatus: 'DRAFT' | 'APPROVED' | 'PAID';
};
export type WeeklyReport = {
  id: string;
  userId: string;
  weekStart: string;
  wentWell: string;
  challenges: string;
  nextWeek: string;
  needHelp: string;
  mostTimeSpent: string;
  status: 'DRAFT' | 'SUBMITTED';
  updatedAt: string;
};
export type Availability = {
  id: string;
  userId: string;
  date: string;
  hour: number;
  status: AvailabilityStatus;
};
export type ActivityLog = { id: string; userId: string; action: string; createdAt: string };
export type State = {
  users: Profile[];
  projects: Project[];
  wbsItems: WbsItem[];
  taskDependencies: TaskDependency[];
  taskAssignments: TaskAssignment[];
  completionReports: CompletionReport[];
  weeklyReports: WeeklyReport[];
  availability: Availability[];
  pointAwards: PointAward[];
  rewardPrivate: RewardPrivate[];
  paymentStatements: PaymentStatement[];
  paymentRevisions: PaymentRevision[];
  aiFeeSettings: { id: string; monthlyFee: number }[];
  travelClaims: TravelClaim[];
  travelDeclarations: { id: string; userId: string; month: string; status: 'NONE' | 'CANCELLED' }[];
  travelTemplates: TravelTemplate[];
  activityLogs: ActivityLog[];
};
export type Action = {
  type:
    | 'schedule'
    | 'assignment'
    | 'mission'
    | 'phase'
    | 'subtask'
    | 'start'
    | 'completion'
    | 'review'
    | 'report'
    | 'availability'
    | 'paid'
    | 'aiFeeSetting'
    | 'payment'
    | 'travelDeclaration'
    | 'travelClaim'
    | 'travelTemplate';
  payload: Record<string, unknown>;
};
export const statusLabels: Record<Status, string> = {
  LOCKED: 'ロック中',
  OPEN: '未担当',
  ASSIGNED: '担当決定',
  IN_PROGRESS: '対応中',
  REPORT_SUBMITTED: '終了報告済',
  REVIEW: 'レビュー中',
  REVISION: '修正依頼',
  COMPLETED: '完了',
  ON_HOLD: '保留',
};
export const referenceLabels = {
  OPEN: '未着手',
  IN_PROGRESS: '対応中',
  COMPLETED: '完了',
  ON_HOLD: '保留',
};
export const phases = [
  'PoC設計・実験準備',
  'CSI取得基盤',
  '人による基礎センシング検証',
  '位置推定・空間センシング',
  '微小動作・呼吸センシング',
  'ペット実証',
  '個体ベースライン・異常差分',
  'アプリ・最終PoC統合',
];
export const uid = () => crypto.randomUUID();
export const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
export const weekOf = (date = new Date()) =>
  format(startOfWeek(jstDate(date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
export const inWeek = (date: string | null, week = weekOf()) =>
  !!date &&
  format(date, 'yyyy-MM-dd') >= week &&
  format(date, 'yyyy-MM-dd') < format(addDays(jstDate(week), 7), 'yyyy-MM-dd');
export const emptyState = (): State => ({
  users: [],
  projects: [],
  wbsItems: [],
  taskDependencies: [],
  taskAssignments: [],
  completionReports: [],
  weeklyReports: [],
  availability: [],
  pointAwards: [],
  rewardPrivate: [],
  paymentStatements: [],
  paymentRevisions: [],
  aiFeeSettings: [],
  travelClaims: [],
  travelDeclarations: [],
  travelTemplates: [],
  activityLogs: [],
});
export const missionsOf = (s: State) => s.wbsItems.filter((m) => m.level === 2);
export const canUnlock = (m: WbsItem, all: WbsItem[]) =>
  m.dependencyIds.every((id) => all.some((x) => x.id === id && x.status === 'COMPLETED'));
export const effectiveStatus = (m: WbsItem, all: WbsItem[]): Status => {
  if (m.level !== 2 || m.status === 'COMPLETED') return m.status;
  if (!canUnlock(m, all)) return 'LOCKED';
  return m.status === 'LOCKED' && m.autoUnlock
    ? m.assigneeIds.length
      ? 'ASSIGNED'
      : 'OPEN'
    : m.status;
};
export const phaseName = (s: State, m: WbsItem) =>
  s.wbsItems.find((p) => p.id === m.parentId)?.title ?? '—';
export const earnedPoints = (s: State, id: string) =>
  s.pointAwards.filter((a) => a.userId === id).reduce((n, a) => n + a.points, 0);
export const progressOf = (s: State, m: WbsItem) => {
  const children = s.wbsItems.filter((c) => c.parentId === m.id);
  return { done: children.filter((c) => c.status === 'COMPLETED').length, total: children.length };
};
export function integer(value: unknown, label: string, min = 0) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > 100000000)
    throw Error(`${label}は${min}以上の整数で入力してください。`);
}
export function validateAllocation(
  values: Record<string, number>,
  users: string[],
  total: number,
  label: string,
) {
  if (
    !users.length ||
    users.length > 6 ||
    Object.keys(values).length !== users.length ||
    Object.keys(values).some((id) => !users.includes(id))
  )
    throw Error(`${label}は全担当者について入力してください。`);
  Object.values(values).forEach((v) => integer(v, label));
  if (Object.values(values).reduce((a, b) => a + b, 0) !== total)
    throw Error(`${label}の合計を${total}にしてください。`);
}
export function distribute(total: number, users: string[], shares?: Record<string, number>) {
  const exact = users.map((id, i) => ({
    id,
    i,
    n: (total * (shares?.[id] ?? 100 / users.length)) / 100,
  }));
  const values = Object.fromEntries(exact.map((x) => [x.id, Math.floor(x.n)]));
  let left = total - Object.values(values).reduce((a, b) => a + b, 0);
  for (const x of [...exact].sort((a, b) => (b.n % 1) - (a.n % 1) || a.i - b.i))
    if (left-- > 0) values[x.id]++;
  return values;
}
export function safeUrl(url: string) {
  return !url || /^https?:\/\/[^\s]+$/.test(url);
}
export function validateStartDate(startDate: string | undefined, deadline: string) {
  if (!startDate) return;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !Number.isFinite(Date.parse(startDate)) ||
    new Date(startDate).toISOString().slice(0, 10) !== startDate
  )
    throw Error('開始日を正しい日付で入力してください。');
  if (deadline && startDate > deadline) throw Error('開始日は期限以前の日付にしてください。');
}
export function transition(state: State, action: Action, actor: Profile): State {
  if (!actor.active) throw Error('このアカウントは無効です。');
  const s = structuredClone(state),
    p = action.payload,
    now = new Date().toISOString();
  const owner = () => {
    if (!canManage(actor)) throw Error('Owner権限が必要です。');
  };
  const mission = () => {
    const m = s.wbsItems.find((x) => x.id === p.missionId && x.level === 2);
    if (!m) throw Error('中工程が見つかりません。');
    return m;
  };
  const assigned = (m: WbsItem) => {
    if (!isParticipant(actor) || !m.assigneeIds.includes(actor.id))
      throw Error('担当者のみ操作できます。');
  };
  switch (action.type) {
    case 'travelDeclaration': {
      const month = String(p.month ?? '');
      if (!isParticipant(actor) || !validPaymentDate(`${month}-01`))
        throw Error('対象月を確認してください。');
      if (!['NONE', 'CANCELLED'].includes(String(p.status))) throw Error('申告状態が不正です。');
      if (
        p.status === 'NONE' &&
        s.travelClaims.some((c) => c.userId === actor.id && c.date.startsWith(`${month}-`))
      )
        throw Error('この月には交通費の記録があります。下書きも確認してください。');
      const id = `${actor.id}_${month}`;
      s.travelDeclarations = [
        ...s.travelDeclarations.filter((d) => d.id !== id),
        { id, userId: actor.id, month, status: p.status as 'NONE' | 'CANCELLED' },
      ];
      break;
    }
    case 'travelClaim': {
      const item = p.item as TravelClaim;
      if (!isParticipant(actor) || item.userId !== actor.id)
        throw Error('自分の交通費のみ保存できます。');
      validateClaim(item);
      const declaration = s.travelDeclarations.find(
        (d) => d.userId === actor.id && d.month === item.date.slice(0, 7),
      );
      if (declaration) declaration.status = 'CANCELLED';
      s.travelClaims = [...s.travelClaims.filter((c) => c.id !== item.id), item];
      break;
    }
    case 'travelTemplate': {
      const item = p.item as TravelTemplate;
      if (!isParticipant(actor) || item.userId !== actor.id)
        throw Error('自分の経路のみ保存できます。');
      validateRoute(item);
      if (
        typeof item.name !== 'string' ||
        !item.name.trim() ||
        item.name.length > 100 ||
        item.id !== `${actor.id}_${item.name}` ||
        item.name.includes('/')
      )
        throw Error('経路名は / を含まない100文字以内で入力してください。');
      s.travelTemplates = [...s.travelTemplates.filter((c) => c.id !== item.id), item];
      break;
    }
    case 'aiFeeSetting': {
      owner();
      const item = p.item as { id: string; monthlyFee: number };
      integer(item.monthlyFee, '月額AI利用料');
      if (!s.users.some((u) => u.id === item.id && isParticipant(u)))
        throw Error('対象者が見つかりません。');
      s.aiFeeSettings = [
        ...s.aiFeeSettings.filter((x) => x.id !== item.id),
        { id: item.id, monthlyFee: item.monthlyFee },
      ];
      break;
    }
    case 'payment': {
      owner();
      const item = p.item as PaymentStatement;
      const person = s.users.find((u) => u.id === item.userId && isParticipant(u));
      if (!person) throw Error('対象者が見つかりません。');
      const previous = s.paymentStatements.find((x) => x.id === item.id);
      const saved = preparePayment(
        item,
        s.pointAwards,
        person.role,
        actor.id,
        now,
        (previous?.revision ?? 0) + 1,
      );
      const withoutId = ({ id: _id, ...data }: PaymentStatement) => data;
      s.paymentRevisions.push({
        id: `${saved.id}_v${saved.revision}`,
        statementId: saved.id,
        before: previous ? withoutId(previous) : null,
        after: withoutId(saved),
      });
      s.paymentStatements = [...s.paymentStatements.filter((x) => x.id !== item.id), saved];
      break;
    }
    case 'schedule': {
      const m = mission();
      if (!canManage(actor)) assigned(m);
      const startDate = String(p.startDate ?? '');
      validateStartDate(startDate, m.deadline);
      m.startDate = startDate;
      break;
    }
    case 'assignment': {
      const m = mission();
      if (['REPORT_SUBMITTED', 'REVIEW', 'COMPLETED'].includes(m.status))
        throw Error('提出済み・レビュー中・完了済みの担当者は変更できません。');
      const ids = p.assigneeIds as string[];
      const primaryId = p.primaryId as string | null;
      if (
        !Array.isArray(ids) ||
        ids.length > 6 ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !s.users.some((u) => u.id === id && u.active && isParticipant(u)))
      )
        throw Error('担当者は有効なメンバーから最大6人まで選んでください。');
      if (ids.length ? !primaryId || !ids.includes(primaryId) : primaryId !== null)
        throw Error('主担当を1人指定してください。');
      m.assigneeIds = ids;
      m.primaryId = primaryId;
      if (['OPEN', 'ASSIGNED'].includes(m.status)) m.status = ids.length ? 'ASSIGNED' : 'OPEN';
      s.taskAssignments = s.taskAssignments.filter((a) => a.missionId !== m.id);
      ids.forEach((userId) =>
        s.taskAssignments.push({
          id: `${m.id}_${userId}`,
          missionId: m.id,
          userId,
          isPrimary: userId === primaryId,
          assignedAt: now,
        }),
      );
      break;
    }
    case 'phase': {
      owner();
      const item = s.wbsItems.find((x) => x.id === p.id && x.level === 1);
      if (!item || !String(p.title ?? '').trim()) throw Error('大工程名を確認してください。');
      item.title = String(p.title).trim();
      break;
    }
    case 'mission': {
      const m = p.item as WbsItem,
        old = s.wbsItems.find((x) => x.id === m.id);
      validateStartDate(m.startDate, m.deadline);
      const isOwner = canManage(actor);
      const isTeamEdit = !isOwner && old;

      if (isTeamEdit) {
        // TEAMメンバーによる編集：ステータス、期限、担当者、前提のみ変更可能
        if (!old.assigneeIds.includes(actor.id)) throw Error('担当者のみ編集できます。');
        if (old.status === 'COMPLETED') throw Error('完了済みの工程は編集できません。');

        // ステータスの検証（TEAMはCOMPLETEDには変更不可）
        if (
          m.status === 'COMPLETED' ||
          !['ASSIGNED', 'IN_PROGRESS', 'REPORT_SUBMITTED', 'REVISION', 'ON_HOLD'].includes(m.status)
        )
          throw Error('ステータスが不正です。');

        // 期限の検証
        if (m.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(m.deadline))
          throw Error('期限を入力してください。');

        // 担当者の検証
        if (
          m.assigneeIds.length > 6 ||
          new Set(m.assigneeIds).size !== m.assigneeIds.length ||
          m.assigneeIds.some(
            (id) => !s.users.some((u) => u.id === id && u.active && isParticipant(u)),
          )
        )
          throw Error('担当者は有効なメンバーから最大6人まで選んでください。');
        if (
          m.assigneeIds.length
            ? !m.primaryId || !m.assigneeIds.includes(m.primaryId)
            : m.primaryId !== null
        )
          throw Error('主担当を1人指定してください。');

        // 前提の検証
        if (
          m.dependencyIds.length > 6 ||
          new Set(m.dependencyIds).size !== m.dependencyIds.length ||
          m.dependencyIds.some(
            (id) => !s.wbsItems.some((d) => d.id === id && d.level === 2 && d.order < m.order),
          )
        )
          throw Error('前提は先行する中工程から最大6件まで指定してください。');

        // 変更可能なフィールドのみ更新
        old.status = m.status;
        old.deadline = m.deadline;
        old.startDate = m.startDate ?? '';
        old.assigneeIds = m.assigneeIds;
        old.primaryId = m.primaryId;
        old.dependencyIds = m.dependencyIds;

        // 担当者の同期
        s.taskAssignments = s.taskAssignments.filter((a) => a.missionId !== m.id);
        m.assigneeIds.forEach((userId) =>
          s.taskAssignments.push({
            id: `${m.id}_${userId}`,
            missionId: m.id,
            userId,
            isPrimary: userId === m.primaryId,
            assignedAt: now,
          }),
        );

        // 前提の同期
        s.taskDependencies = s.taskDependencies.filter((d) => d.missionId !== m.id);
        m.dependencyIds.forEach((dependsOnId) =>
          s.taskDependencies.push({ id: `${m.id}_${dependsOnId}`, missionId: m.id, dependsOnId }),
        );
      } else {
        // Ownerによる編集：全フィールド変更可能
        owner();
        if (old && !['OPEN', 'LOCKED', 'ASSIGNED', 'ON_HOLD'].includes(old.status))
          throw Error('対応開始後の担当・条件は変更できません。');
        if (
          !m.title.trim() ||
          m.level !== 2 ||
          !/^\d+\.\d+$/.test(m.wbsCode) ||
          !s.wbsItems.some((x) => x.id === m.parentId && x.level === 1)
        )
          throw Error('大工程・WBS番号・タイトルを確認してください。');
        if (old && (old.wbsCode !== m.wbsCode || old.order !== m.order))
          throw Error('作成済みのWBS番号は変更できません。');
        if (s.wbsItems.some((x) => x.id !== m.id && x.wbsCode === m.wbsCode))
          throw Error('WBS番号が重複しています。');
        if (m.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(m.deadline))
          throw Error('期限を入力してください。');
        integer(m.pointValue, '総ポイント', 1);
        integer(p.totalAmount, '内部総報酬');
        if (
          m.assigneeIds.length > 6 ||
          new Set(m.assigneeIds).size !== m.assigneeIds.length ||
          m.assigneeIds.some(
            (id) => !s.users.some((u) => u.id === id && u.active && isParticipant(u)),
          )
        )
          throw Error('担当者は有効なメンバーから最大6人まで選んでください。');
        if (
          m.assigneeIds.length
            ? !m.primaryId || !m.assigneeIds.includes(m.primaryId)
            : m.primaryId !== null
        )
          throw Error('主担当を1人指定してください。');
        if (
          m.dependencyIds.length > 6 ||
          new Set(m.dependencyIds).size !== m.dependencyIds.length ||
          m.dependencyIds.some(
            (id) => !s.wbsItems.some((d) => d.id === id && d.level === 2 && d.order < m.order),
          )
        )
          throw Error('前提は先行する中工程から最大6件まで指定してください。');
        m.status = !canUnlock(m, s.wbsItems)
          ? 'LOCKED'
          : m.status === 'ON_HOLD'
            ? 'ON_HOLD'
            : m.assigneeIds.length
              ? 'ASSIGNED'
              : 'OPEN';
        m.finalPoints = {};
        m.completedAt = null;
        m.approvedBy = null;
        s.wbsItems = old ? s.wbsItems.map((x) => (x.id === m.id ? m : x)) : [...s.wbsItems, m];
        const checklist = (p.checklist as string[]).map((t) => t.trim()).filter(Boolean);
        if (checklist.length > 30) throw Error('参考小工程は30件までです。');
        const children = s.wbsItems
          .filter((x) => x.parentId === m.id)
          .sort((a, b) => a.order - b.order);
        s.wbsItems = s.wbsItems.filter((x) => x.parentId !== m.id);
        checklist.forEach((title, i) =>
          s.wbsItems.push({
            ...m,
            id: children[i]?.id ?? `${m.id}-step-${i + 1}`,
            parentId: m.id,
            level: 3,
            wbsCode: `${m.wbsCode}.${i + 1}`,
            title,
            description: '',
            pointValue: 0,
            assigneeIds: [],
            primaryId: null,
            dependencyIds: [],
            status: children[i]?.status ?? 'OPEN',
            order: m.order + (i + 1) / 100,
          }),
        );
        s.taskAssignments = s.taskAssignments.filter((a) => a.missionId !== m.id);
        m.assigneeIds.forEach((userId) =>
          s.taskAssignments.push({
            id: `${m.id}_${userId}`,
            missionId: m.id,
            userId,
            isPrimary: userId === m.primaryId,
            assignedAt: now,
          }),
        );
        s.taskDependencies = s.taskDependencies.filter((d) => d.missionId !== m.id);
        m.dependencyIds.forEach((dependsOnId) =>
          s.taskDependencies.push({ id: `${m.id}_${dependsOnId}`, missionId: m.id, dependsOnId }),
        );
        s.rewardPrivate = s.rewardPrivate.filter((r) => r.id !== m.id);
        s.rewardPrivate.push({
          id: m.id,
          missionId: m.id,
          totalAmount: p.totalAmount as number,
          allocations: {},
          approvedAt: null,
          approvedBy: null,
          paymentStatus: 'DRAFT',
        });
      }
      break;
    }
    case 'subtask': {
      const c = s.wbsItems.find((x) => x.id === p.id && x.level === 3);
      const m = s.wbsItems.find((x) => x.id === (c?.parentId ?? p.missionId) && x.level === 2);
      if (!m || (!c && p.operation !== 'add')) throw Error('小工程が見つかりません。');
      if (!canManage(actor)) {
        assigned(m);
        if (effectiveStatus(m, s.wbsItems) === 'LOCKED') throw Error('前提が未完了です。');
      }
      if (p.operation === 'delete') {
        s.wbsItems = s.wbsItems.filter((x) => x.id !== c!.id);
      } else if (p.operation === 'add') {
        const children = s.wbsItems.filter((x) => x.parentId === m.id);
        const title = String(p.title ?? '').trim();
        if (!title || title.length > 20000) throw Error('小工程名を入力してください。');
        if (children.length >= 30) throw Error('参考小工程は30件までです。');
        const index =
          Math.max(0, ...children.map((x) => Number(x.wbsCode.split('.').at(-1)) || 0)) + 1;
        s.wbsItems.push({
          ...m,
          id: uid(),
          level: 3,
          parentId: m.id,
          title,
          description: '',
          wbsCode: `${m.wbsCode}.${index}`,
          order: m.order + index / 100,
          pointValue: 0,
          status: 'OPEN',
          assigneeIds: [],
          primaryId: null,
          dependencyIds: [],
          completedAt: null,
          approvedBy: null,
          finalPoints: {},
        });
      } else if (p.operation === 'rename') {
        const title = String(p.title ?? '').trim();
        if (!title || title.length > 20000) throw Error('小工程名を入力してください。');
        c!.title = title;
      } else {
        if (!Object.keys(referenceLabels).includes(String(p.status)))
          throw Error('状態が不正です。');
        c!.status = p.status as Status;
      }
      break;
    }
    case 'start': {
      const m = mission();
      assigned(m);
      if (effectiveStatus(m, s.wbsItems) !== 'ASSIGNED')
        throw Error('開始できる状態ではありません。');
      m.status = 'IN_PROGRESS';
      break;
    }
    case 'completion': {
      const m = mission();
      assigned(m);
      if (!['IN_PROGRESS', 'REVISION'].includes(m.status) || !canUnlock(m, s.wbsItems))
        throw Error('終了報告を編集できる状態ではありません。');
      const r = p.report as CompletionReport,
        old = s.completionReports.find((r) => r.missionId === m.id);
      if ((old?.version ?? 0) !== Number(p.baseVersion ?? 0))
        throw Error('共同担当者が更新しました。最新の報告を開き直してください。');
      if (
        !safeUrl(r.githubUrl) ||
        !safeUrl(r.externalUrl) ||
        r.attachments.some((a) => !safeUrl(a.url) || (!a.url && !a.path))
      )
        throw Error('成果物URLはhttpまたはhttpsで入力してください。');
      if (!Number.isFinite(r.workHours) || r.workHours < 0)
        throw Error('実作業時間を確認してください。');
      if (r.status === 'SUBMITTED') {
        if (!r.workSummary.trim() || !r.result.trim()) throw Error('実施内容と結果は必須です。');
        if (m.assigneeIds.length === 1) r.contributionShares = { [m.assigneeIds[0]]: 100 };
        validateAllocation(r.contributionShares, m.assigneeIds, 100, '貢献割合');
      } else if (r.status !== 'DRAFT') throw Error('終了報告の状態が不正です。');
      const saved = {
        ...r,
        id: m.id,
        missionId: m.id,
        version: (old?.version ?? 0) + 1,
        updatedAt: now,
        updatedBy: actor.id,
        submittedAt: r.status === 'SUBMITTED' ? now : null,
        reviewComment: old?.reviewComment ?? '',
      };
      s.completionReports = [...s.completionReports.filter((x) => x.id !== m.id), saved];
      if (r.status === 'SUBMITTED') m.status = 'REPORT_SUBMITTED';
      break;
    }
    case 'review': {
      owner();
      const m = mission(),
        r = s.completionReports.find((x) => x.missionId === m.id),
        reward = s.rewardPrivate.find((x) => x.id === m.id);
      if (!['REPORT_SUBMITTED', 'REVIEW'].includes(m.status) || !r || r.status !== 'SUBMITTED')
        throw Error('承認対象の終了報告がありません。');
      if (p.decision === 'begin') {
        m.status = 'REVIEW';
        break;
      }
      if (p.decision === 'revise') {
        if (!String(p.comment ?? '').trim()) throw Error('修正内容を入力してください。');
        r.status = 'REVISION';
        r.reviewComment = String(p.comment);
        r.version++;
        r.updatedAt = now;
        r.updatedBy = actor.id;
        m.status = 'REVISION';
        break;
      }
      if (p.decision !== 'approve' || !reward) throw Error('承認情報が不正です。');
      const pointValues = p.points as Record<string, number>,
        amounts = p.amounts as Record<string, number>;
      validateAllocation(pointValues, m.assigneeIds, m.pointValue, '最終ポイント');
      validateAllocation(amounts, m.assigneeIds, reward.totalAmount, '内部実報酬');
      if (s.pointAwards.some((a) => a.missionId === m.id))
        throw Error('すでにポイントが付与されています。');
      m.status = 'COMPLETED';
      m.completedAt = now;
      m.approvedBy = actor.id;
      m.finalPoints = pointValues;
      m.assigneeIds.forEach((userId) =>
        s.pointAwards.push({
          id: `${m.id}_${userId}`,
          missionId: m.id,
          userId,
          points: pointValues[userId],
          awardedAt: now,
          approvedBy: actor.id,
        }),
      );
      r.status = 'APPROVED';
      r.version++;
      r.updatedAt = now;
      r.updatedBy = actor.id;
      r.reviewComment = String(p.comment ?? '');
      reward.allocations = amounts;
      reward.approvedAt = now;
      reward.approvedBy = actor.id;
      reward.paymentStatus = 'APPROVED';
      break;
    }
    case 'report': {
      if (!isParticipant(actor)) throw Error('管理専用Adminは週報の提出対象ではありません。');
      const r = p.report as WeeklyReport;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.weekStart) || weekOf(jstDate(r.weekStart)) !== r.weekStart)
        throw Error('週の開始日は月曜日です。');
      if (
        r.status === 'SUBMITTED' &&
        (!r.wentWell.trim() || !r.challenges.trim() || !r.nextWeek.trim())
      )
        throw Error('必須の3項目を入力してください。');
      const saved = { ...r, id: `${actor.id}_${r.weekStart}`, userId: actor.id, updatedAt: now };
      s.weeklyReports = [...s.weeklyReports.filter((x) => x.id !== saved.id), saved];
      break;
    }
    case 'availability': {
      const userId = String(p.userId ?? actor.id);
      if (userId !== actor.id) owner();
      if (!s.users.some((u) => u.id === userId && isParticipant(u)))
        throw Error('対象メンバーがいません。');
      for (const c of p.cells as {
        date: string;
        hour: number;
        status: AvailabilityStatus | null;
      }[]) {
        if (
          c.date < '2026-09-01' ||
          c.date > '2027-03-31' ||
          !Number.isInteger(c.hour) ||
          c.hour < 9 ||
          c.hour > 22 ||
          (c.status !== null && !['AVAILABLE', 'MAYBE', 'UNAVAILABLE'].includes(c.status))
        )
          throw Error('予定の対象期間・時間を確認してください。');
        const id = `${userId}_${c.date}_${c.hour}`;
        s.availability = s.availability.filter((x) => x.id !== id);
        if (c.status) s.availability.push({ id, userId, ...c, status: c.status });
      }
      break;
    }
    case 'paid': {
      owner();
      const r = s.rewardPrivate.find((x) => x.id === p.id);
      if (!r || r.paymentStatus !== 'APPROVED') throw Error('未払いの承認済み報酬がありません。');
      r.paymentStatus = 'PAID';
      break;
    }
  }
  s.activityLogs.unshift({
    id: uid(),
    userId: actor.id,
    action: {
      schedule: '開始日を更新',
      assignment: '担当者を変更',
      mission: '中工程を保存',
      phase: '大工程名を更新',
      subtask: '参考小工程を更新',
      start: '中工程を開始',
      completion: '終了報告を保存',
      review: '終了報告をレビュー',
      report: '週報を保存',
      availability: 'MID.予定を更新',
      paid: '支払済みを記録',
      payment: '支払明細を保存',
      aiFeeSetting: '月額AI利用料を設定',
      travelClaim: '交通費申請を保存',
      travelDeclaration: '交通費なしの申告を更新',
      travelTemplate: '交通費の経路を保存',
    }[action.type],
    createdAt: now,
  });
  return s;
}

import petPocInitial from './data/pet-poc-initial.json';
import { emptyState, phases, type State, type WbsItem, distribute, weekOf } from './domain';
export const demoUserId = 'demo-aoki';
export function createSeed(): State {
  const s = emptyState();
  s.users = [
    { id: demoUserId, name: '青木 海斗', role: 'TEAM', active: true },
    { id: 'demo-tanaka', name: '田中 美咲', role: 'TEAM', active: true },
    { id: 'demo-sato', name: '佐藤 蓮', role: 'TEAM', active: true },
    { id: 'demo-owner', name: '高橋 直樹', role: 'OWNER', active: true },
  ];
  s.projects = [
    { id: 'wifi-poc', name: 'Wi-FiセンシングPoC', startDate: '2026-09-01', endDate: '2027-03-31' },
  ];
  const names = [
    ['実験計画・評価指標の設計', '実験環境のセットアップ', '計測プロトコルの策定'],
    ['ESP32単体CSI取得', 'ESP32複数台同時取得', 'AX210 CSI取得'],
    ['在室・不在の基礎検証', '歩行・静止状態の分類', 'センシングデータの前処理'],
    ['9マス位置推定', '空間マッピングの検証', '位置推定モデルの評価'],
    ['呼吸周期の信号抽出', '微小動作の検出', '呼吸推定の精度評価'],
    ['ペット計測環境の構築', '犬・猫の行動データ収集', 'ペット在室検知の検証'],
    ['個体ベースラインの設計', '異常差分の検出モデル', '個体別評価レポート'],
    ['センシングAPIの実装', 'モニタリングUIの実装', '最終PoC・デモ統合'],
  ];
  const blank: WbsItem = {
    id: '',
    projectId: 'wifi-poc',
    parentId: null,
    wbsCode: '',
    level: 1,
    title: '',
    description: '',
    pointValue: 0,
    status: 'OPEN',
    deadline: '2027-03-31',
    assigneeIds: [],
    primaryId: null,
    dependencyIds: [],
    autoUnlock: true,
    order: 0,
    completedAt: null,
    approvedBy: null,
    finalPoints: {},
  };
  phases.forEach((title, i) =>
    s.wbsItems.push({
      ...blank,
      id: `phase-${i + 1}`,
      wbsCode: String(i + 1),
      title,
      order: (i + 1) * 1000,
    }),
  );
  names.forEach((titles, i) =>
    titles.forEach((title, j) => {
      const n = i * 3 + j,
        id = `mission-${i + 1}-${j + 1}`,
        pointValue = [50, 100, 30][j];
      const assigneeIds =
        n < 7
          ? n === 4
            ? [demoUserId, 'demo-tanaka', 'demo-sato']
            : [n === 6 ? 'demo-tanaka' : demoUserId]
          : [];
      const status =
        n < 4
          ? 'COMPLETED'
          : n === 4
            ? 'IN_PROGRESS'
            : n === 6
              ? 'REPORT_SUBMITTED'
              : n > 8
                ? 'LOCKED'
                : assigneeIds.length
                  ? 'ASSIGNED'
                  : 'OPEN';
      const completedAt = n < 4 ? new Date(Date.now() - (n + 1) * 86400000).toISOString() : null;
      const m: WbsItem = {
        ...blank,
        id,
        parentId: `phase-${i + 1}`,
        level: 2,
        wbsCode: `${i + 1}.${j + 1}`,
        title,
        description: `${title}を実装・検証し、実験条件と結果をチームに共有します。`,
        pointValue,
        status,
        assigneeIds,
        primaryId: assigneeIds[0] ?? null,
        dependencyIds: n === 4 ? ['mission-2-1'] : n > 8 ? ['mission-2-2'] : [],
        order: (i + 1) * 1000 + j + 1,
        completedAt,
        approvedBy: completedAt ? 'demo-owner' : null,
        finalPoints: completedAt ? distribute(pointValue, assigneeIds) : {},
      };
      s.wbsItems.push(m);
      ['環境・機材を確認する', '実装・計測を行う', '結果を整理して共有する'].forEach((title, k) =>
        s.wbsItems.push({
          ...blank,
          id: `${id}-step-${k + 1}`,
          parentId: id,
          level: 3,
          wbsCode: `${m.wbsCode}.${k + 1}`,
          title,
          status: n < 4 ? 'COMPLETED' : n === 4 && k === 0 ? 'COMPLETED' : 'OPEN',
          order: m.order + (k + 1) / 100,
        }),
      );
      assigneeIds.forEach((userId) =>
        s.taskAssignments.push({
          id: `${id}_${userId}`,
          missionId: id,
          userId,
          isPrimary: userId === m.primaryId,
          assignedAt: new Date().toISOString(),
        }),
      );
      m.dependencyIds.forEach((dependsOnId) =>
        s.taskDependencies.push({ id: `${id}_${dependsOnId}`, missionId: id, dependsOnId }),
      );
      s.rewardPrivate.push({
        id,
        missionId: id,
        totalAmount: pointValue * 100,
        allocations: completedAt
          ? Object.fromEntries(assigneeIds.map((u) => [u, m.finalPoints[u] * 100]))
          : {},
        approvedAt: completedAt,
        approvedBy: completedAt ? 'demo-owner' : null,
        paymentStatus: completedAt ? 'APPROVED' : 'DRAFT',
      });
      if (completedAt)
        assigneeIds.forEach((userId) =>
          s.pointAwards.push({
            id: `${id}_${userId}`,
            missionId: id,
            userId,
            points: m.finalPoints[userId],
            awardedAt: completedAt,
            approvedBy: 'demo-owner',
          }),
        );
      if (n === 6)
        s.completionReports.push({
          id,
          missionId: id,
          workSummary: '3条件で10分ずつ計測しました。',
          result: '在室判定の基礎検証を完了しました。',
          wentWell: '計測条件を統一できました。',
          didNotGoWell: '静止時のノイズ分離',
          findings: '前処理が検出精度に影響します。',
          remainingIssues: '静止時の追加検証',
          handoverNotes: '実験条件を揃えて再計測してください。',
          workHours: 8,
          githubUrl: '',
          externalUrl: '',
          attachments: [],
          contributionShares: { 'demo-tanaka': 100 },
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'demo-tanaka',
          version: 1,
          reviewComment: '',
        });
    }),
  );
  s.weeklyReports.push({
    id: `demo-tanaka_${weekOf()}`,
    userId: 'demo-tanaka',
    weekStart: weekOf(),
    wentWell: '計測基盤を整備しました。',
    challenges: '静止時のノイズの切り分け',
    nextWeek: '前処理を比較します。',
    needHelp: '計測条件を相談したいです。',
    mostTimeSpent: 'データ取得',
    status: 'SUBMITTED',
    updatedAt: new Date().toISOString(),
  });
  return s;
}
export function initialProject(): State {
  return {
    ...structuredClone(petPocInitial),
    paymentStatements: [],
    travelClaims: [],
    travelTemplates: [],
  } as State;
}

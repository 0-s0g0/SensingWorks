import { weeklyFields, weeklyWeeks, weeklyStatus } from './weekly';
import { inWeek, missionsOf } from './domain';
import { addDays } from 'date-fns';
import { effectiveStatus, referenceLabels, statusLabels, type State } from './domain';
import { format, jstDate } from './time';

type CsvValue = string | number | null | undefined;
export function encodeCsv(rows: CsvValue[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? '');
            // Quoting alone does not prevent spreadsheet formula execution.
            if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n') +
    '\r\n'
  );
}
export function downloadCsv(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function wbsCsv(state: State) {
  const rows: CsvValue[][] = [
    [
      '階層',
      'WBS番号',
      '工程名',
      '親WBS番号',
      '大工程',
      '担当者',
      '主担当',
      '担当の参照元',
      'ステータス',
      'ステータスコード',
      '開始日',
      '期限',
      'ポイント',
      '前提工程',
      '完了数',
      '総数',
      '進捗率(%)',
    ],
  ];
  const name = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;
  const ordered = [...state.wbsItems].sort((a, b) =>
    a.wbsCode.localeCompare(b.wbsCode, 'en', { numeric: true }),
  );
  for (const item of ordered) {
    const parent = state.wbsItems.find((p) => p.id === item.parentId);
    const mission = item.level === 3 ? parent : item.level === 2 ? item : undefined;
    const phase = item.level === 1 ? item : state.wbsItems.find((p) => p.id === mission?.parentId);
    const status = effectiveStatus(item, state.wbsItems);
    const children = state.wbsItems.filter((c) => c.parentId === item.id);
    const done = children.filter((c) => c.status === 'COMPLETED').length;
    rows.push([
      ['', '大工程', '中工程', '小工程'][item.level],
      item.wbsCode,
      item.title,
      parent?.wbsCode,
      phase?.title,
      mission?.assigneeIds.map(name).join(' / ') ?? '',
      mission?.primaryId ? name(mission.primaryId) : '',
      item.level === 3 ? `中工程 ${mission?.wbsCode ?? ''}` : item.level === 2 ? '中工程自身' : '',
      item.level === 3
        ? (referenceLabels[status as keyof typeof referenceLabels] ?? statusLabels[status])
        : statusLabels[status],
      status,
      item.startDate ?? '',
      item.deadline,
      item.level === 2 ? item.pointValue : '',
      item.dependencyIds
        .map((id) => {
          const d = state.wbsItems.find((w) => w.id === id);
          return d ? `${d.wbsCode} ${d.title}` : id;
        })
        .join(' / '),
      item.level < 3 ? done : '',
      item.level < 3 ? children.length : '',
      item.level < 3 && children.length ? Math.round((done / children.length) * 100) : '',
    ]);
  }
  return encodeCsv(rows);
}
export function availabilityCsv(state: State, week: string, target = 'team') {
  const rows: CsvValue[][] = [
    [
      '日付',
      '開始時刻',
      '終了時刻',
      'タイムゾーン',
      'メンバーID',
      'メンバー名',
      'ステータス',
      'ステータスコード',
    ],
  ];
  const people = state.users.filter((u) => (target === 'team' ? u.active : u.id === target));
  const answers = new Map(
    state.availability.map((a) => [`${a.userId}/${a.date}/${a.hour}`, a.status]),
  );
  const labels = { AVAILABLE: '参加可能', MAYBE: '未確定', UNAVAILABLE: '参加不可' };
  for (let day = 0; day < 7; day++) {
    const date = format(addDays(jstDate(week), day), 'yyyy-MM-dd');
    if (date < '2026-09-01' || date > '2027-03-31') continue;
    for (let hour = 9; hour <= 22; hour++)
      for (const user of people) {
        const status = answers.get(`${user.id}/${date}/${hour}`);
        rows.push([
          date,
          `${hour}:00`,
          `${hour + 1}:00`,
          'Asia/Tokyo',
          user.id,
          user.name,
          status ? labels[status] : '未入力',
          status ?? '',
        ]);
      }
  }
  return encodeCsv(rows);
}

export function weeklyCsv(
  state: State,
  scope?: { userId: string; week: string },
  now = Date.now(),
) {
  const rows: CsvValue[][] = [
    [
      '対象週',
      '締切(JST)',
      'メンバーID',
      'メンバー名',
      '提出状況',
      '最終更新(JST)',
      ...weeklyFields.map(([, label]) => label),
      '今週完了した担当ミッション',
      '今週提出した終了報告',
    ],
  ];
  const people = state.users.filter((u) =>
    scope ? u.id === scope.userId : u.active || state.weeklyReports.some((r) => r.userId === u.id),
  );
  const weeks = scope ? [scope.week] : weeklyWeeks;
  for (const week of weeks)
    for (const user of people) {
      const report = state.weeklyReports.find((r) => r.userId === user.id && r.weekStart === week);
      const done = missionsOf(state).filter(
        (m) => m.assigneeIds.includes(user.id) && inWeek(m.completedAt, week),
      );
      const submitted = state.completionReports.filter(
        (r) =>
          inWeek(r.submittedAt, week) &&
          state.wbsItems.some((m) => m.id === r.missionId && m.assigneeIds.includes(user.id)),
      );
      rows.push([
        week,
        `${week} 23:59`,
        user.id,
        user.name,
        weeklyStatus(week, report, now).label,
        report?.updatedAt ? format(report.updatedAt, 'yyyy-MM-dd HH:mm:ss') : '',
        ...weeklyFields.map(([key]) => report?.[key] ?? ''),
        done.map((m) => `${m.wbsCode} ${m.title}`).join(' / '),
        submitted
          .map((r) => {
            const m = state.wbsItems.find((m) => m.id === r.missionId);
            return m ? `${m.wbsCode} ${m.title}` : r.missionId;
          })
          .join(' / '),
      ]);
    }
  return encodeCsv(rows);
}

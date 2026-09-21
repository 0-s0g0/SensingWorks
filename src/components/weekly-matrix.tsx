'use client';
import { isParticipant } from '@/lib/domain';
import { Download } from 'lucide-react';
import { downloadCsv, weeklyCsv } from '@/lib/csv';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { weeklyFields, weeklyStatus, weeklyWeeks, currentReportWeek } from '@/lib/weekly';
import { format } from '@/lib/time';
import { Modal } from './ui/primitives';
import { Button } from './ui/button';

export function WeeklyMatrix() {
  const { state } = useStore();
  const [selected, setSelected] = useState<{ userId: string; week: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const reports = new Map(state.weeklyReports.map((r) => [`${r.userId}_${r.weekStart}`, r]));
  const people = state.users.filter(
    (u) => isParticipant(u) && (u.active || state.weeklyReports.some((r) => r.userId === u.id)),
  );
  const report = selected ? reports.get(`${selected.userId}_${selected.week}`) : undefined;
  return (
    <section className="panel detail-section weekly-matrix">
      <div className="section-title">
        <h2>週報の提出一覧</h2>
        <Button
          variant="outline"
          size="sm"
          title="全28週・全メンバーの保存済み内容と未提出状況を出力します。"
          onClick={() =>
            downloadCsv('SensingWorks-weekly-2026-09-21_2027-03-29.csv', weeklyCsv(state))
          }
        >
          <Download size={16} />
          全員の週報をCSV出力
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            document
              .getElementById(`weekly-column-${currentReportWeek()}`)
              ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
          }}
        >
          今週へ
        </Button>
      </div>
      <p>2026/9/21の週〜2027/3/29の週（3月末まで） · 各週の月曜23:59締切（日本時間）</p>
      <p>セルをクリックすると週報を閲覧できます。締切後も提出・本人による修正ができます。</p>
      <div className="weekly-legend">
        <span className="weekly-submitted">✓ 提出済み</span>
        <span className="weekly-draft">下書き</span>
        <span className="weekly-overdue">! 締切超過</span>
        <span className="weekly-empty">— 未提出</span>
      </div>
      <div
        className="weekly-scroll"
        tabIndex={0}
        role="region"
        aria-label="週報マトリックス（横スクロール）"
      >
        <table>
          <thead>
            <tr>
              <th scope="col" className="weekly-person">
                メンバー
              </th>
              {weeklyWeeks.map((week) => (
                <th
                  key={week}
                  scope="col"
                  id={`weekly-column-${week}`}
                  aria-current={week === currentReportWeek() ? 'date' : undefined}
                >
                  <span>{format(week, 'yyyy')}</span>
                  <br />
                  {format(week, 'M/d')}
                  <br />
                  <small>月 23:59</small>
                </th>
              ))}
            </tr>
            <tr>
              <th scope="row" className="weekly-person">
                提出数
              </th>
              {weeklyWeeks.map((week) => (
                <td key={week}>
                  {
                    people.filter((u) => reports.get(`${u.id}_${week}`)?.status === 'SUBMITTED')
                      .length
                  }{' '}
                  / {people.length}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((u) => (
              <tr key={u.id}>
                <th scope="row" className="weekly-person">
                  {u.name}
                  {!u.active && <small>（無効）</small>}
                </th>
                {weeklyWeeks.map((week) => {
                  const status = weeklyStatus(week, reports.get(`${u.id}_${week}`), now);
                  return (
                    <td key={week}>
                      <button
                        className={`weekly-cell weekly-${status.key}`}
                        aria-label={`${u.name} ${week} ${status.label}`}
                        title={`${u.name}・${week}の週・${status.label}`}
                        onClick={() => setSelected({ userId: u.id, week })}
                      >
                        {status.symbol}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!people.length && <p>メンバーはまだ登録されていません。</p>}
      {selected && (
        <Modal
          title={`${state.users.find((u) => u.id === selected.userId)?.name ?? 'メンバー'}の週報 · ${selected.week}の週`}
          close={() => setSelected(null)}
        >
          <p>締切：{format(selected.week, 'yyyy/MM/dd')}（月）23:59（日本時間）</p>
          <p>{weeklyStatus(selected.week, report, now).label}</p>
          {report ? (
            <>
              <p className="muted">最終更新：{format(report.updatedAt, 'yyyy/MM/dd HH:mm')}</p>
              {weeklyFields.map(([key, label]) => (
                <div className="report-read" key={key}>
                  <h3>{label}</h3>
                  <p className="prewrap">{report[key] || '—'}</p>
                </div>
              ))}
            </>
          ) : (
            <p>この週の週報はまだ作成されていません。</p>
          )}
        </Modal>
      )}
    </section>
  );
}

'use client';

import { useState } from 'react';
import { AccordionCard } from './ui/accordion-card';
import { eachDayOfInterval } from 'date-fns';
import { useStore } from '@/lib/store';
import { yen } from '@/lib/domain';
import { format, jstDate } from '@/lib/time';
import { travelStatusLabels, travelTotal } from '@/lib/travel';
import { monthlySettlement, monthPeriod, teamPointProgress } from '@/lib/settlement';
import { validPaymentDate } from '@/lib/payment';
import { Field, Modal, Notice } from './ui/primitives';
import { Button } from './ui/button';
import { TravelReview } from './travel-review';
import { PaymentStatements } from './payment-statements';

export function MonthlyManagement() {
  const { state } = useStore();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewClaimId, setReviewClaimId] = useState<string | null>(null);
  const [scope, setScope] = useState('TEAM');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const { start, end } = monthPeriod(month);
  const days = eachDayOfInterval({ start: jstDate(start), end: jstDate(end) }).map((d) =>
    format(d, 'yyyy-MM-dd'),
  );
  const progress = teamPointProgress(state, month);
  const people = monthlySettlement(state, month);
  const scoped = people.filter((r) => scope === 'ALL' || r.person.role === scope);
  const rows = scoped.filter((r) => !onlyAttention || r.issues.length > 0);
  const detail = people.find((r) => r.person.id === selected);
  const total = scoped.reduce((sum, r) => sum + (r.result?.total ?? 0), 0);
  const pending = scoped.filter((r) => r.issues.length > 0).length;

  return (
    <>
      <AccordionCard title="今月の精算" className="settlement-panel">
        <div className="section-title">
          <div>
            <p>メンバー名を押すと、内訳の確認と明細の編集ができます。</p>
          </div>
          <Field label="管理の対象月">
            <input
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (validPaymentDate(`${e.target.value}-01`)) {
                  setMonth(e.target.value);
                  setSelected(null);
                  setReviewClaimId(null);
                }
              }}
            />
          </Field>
        </div>
        <section aria-label="TEAMの獲得ポイント" className="detail-section">
          <h3>TEAMの獲得ポイント · {month}</h3>
          <p>
            <strong>{progress.earned.toLocaleString()} pt</strong> /{' '}
            {progress.target.toLocaleString()} pt
          </p>
          <progress
            aria-label="TEAMのポイント達成率"
            max={progress.target}
            value={Math.min(progress.earned, progress.target)}
          />
          <p>
            達成率 {progress.percent.toFixed(1)}% ·{' '}
            {progress.excess > 0
              ? `超過 ${progress.excess.toLocaleString()} pt`
              : `残り ${progress.remaining.toLocaleString()} pt`}
          </p>
          <p className="help-text">
            対象月に承認された、現在のTEAMメンバー全員の合計です。LEADER・OWNER・ADMINは含みません。
          </p>
        </section>
        <div className="settlement-stats">
          <div>
            <span>保存済み明細の支払合計</span>
            <strong>{yen(total)}</strong>
            <small>
              {scoped.filter((r) => !!r.statement).length} / {scoped.length} 人の明細を作成済み
            </small>
          </div>
          <div>
            <span>確認が必要なメンバー</span>
            <strong>
              {pending}
              <small> 人</small>
            </strong>
            <small>差額・下書き・未申告を確認</small>
          </div>
          <div>
            <span>承認済み交通費</span>
            <strong>{yen(scoped.reduce((sum, r) => sum + r.travel, 0))}</strong>
            <small>承認待ち・下書き・不承認は含みません</small>
          </div>
        </div>
        <div className="settlement-filters">
          <Field label="精算の表示対象">
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="TEAM">TEAMメンバーのみ</option>
              <option value="LEADER">LEADERメンバーのみ</option>
              <option value="ALL">全参加者（LEADER・OWNERを含む）</option>
            </select>
          </Field>
          <label className="attention-filter">
            <input
              type="checkbox"
              checked={onlyAttention}
              onChange={(e) => setOnlyAttention(e.target.checked)}
            />
            確認が必要な人だけ
          </label>
          <span className="muted">ユーザー番号順</span>
        </div>
        <div className="table-wrap settlement-table">
          <table aria-label="月末精算一覧">
            <thead>
              <tr>
                <th scope="col">メンバー</th>
                <th scope="col">確定ポイント</th>
                <th scope="col">作業報酬</th>
                <th scope="col">AI利用料</th>
                <th scope="col">交通費</th>
                <th scope="col">支払合計</th>
                <th scope="col">確認すること</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.person.id}>
                  <th scope="row">
                    <button
                      className="member-detail-button"
                      onClick={() => setSelected(r.person.id)}
                    >
                      {r.person.name}
                      <span aria-hidden="true"> →</span>
                    </button>
                    {!r.person.active && <small>（無効）</small>}
                  </th>
                  <td>{r.points} pt</td>
                  <td>
                    {r.result ? yen(r.result.workAmount) : '未設定'}
                    {r.statement && (
                      <small className="cell-note">
                        {r.statement.amountMode === 'manual' && r.statement.manualAmount != null
                          ? r.statement.roleAtSave === 'LEADER'
                            ? '定額支払い'
                            : '手動設定'
                          : 'ポイント計算'}
                      </small>
                    )}
                  </td>
                  <td>
                    {yen(r.aiFee)}
                    {!r.statement && <small className="cell-note">月額設定</small>}
                  </td>
                  <td>
                    {yen(r.statement?.travelCost ?? r.travel)}
                    {r.statement && r.statement.travelCost !== r.travel && (
                      <small className="cell-note">最新承認額 {yen(r.travel)}</small>
                    )}
                    {r.noTravel && <small className="cell-note">交通費なし申告済み</small>}
                  </td>
                  <td className="settlement-total">{r.result ? yen(r.result.total) : '—'}</td>
                  <td>
                    <div className="settlement-status">
                      {r.issues.length ? (
                        r.issues.map((issue) => (
                          <span key={issue} className="review-chip">
                            {issue}
                          </span>
                        ))
                      ) : (
                        <span className="ready-chip">明細作成済み・差額なし</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p>{onlyAttention ? '確認が必要なメンバーはいません。' : '対象メンバーはいません。'}</p>
        )}
        <p className="help-text">
          {start} 〜 {end}
          （日本時間・月末締め）。確定ポイントは承認日で集計します。支払合計は保存時点の金額で表示し（旧形式の明細は現在のポイントで計算）、明細未作成の人は含みません。
        </p>
      </AccordionCard>
      <AccordionCard title="交通費の月別申請状況" className="weekly-matrix">
        <p>
          名前と月合計は横スクロールしても表示されます。申請のセルを押すと内容を確認できます。ADMINは承認待ちの申請を承認・不承認にできます。月合計は承認済みのみです。
        </p>
        <div className="weekly-legend">
          <span className="weekly-empty">申請なし</span>
          <span className="weekly-draft">下書き</span>
          <span className="travel-pending">承認待ち</span>
          <span className="weekly-submitted">承認済</span>
          <span className="travel-rejected">不承認</span>
        </div>
        <div
          className="weekly-scroll travel-matrix"
          tabIndex={0}
          role="region"
          aria-label="交通費マトリックス（横スクロール）"
        >
          <table>
            <thead>
              <tr>
                <th scope="col" className="weekly-person">
                  メンバー
                </th>
                <th scope="col" className="travel-month-total">
                  月合計
                </th>
                {days.map((day) => (
                  <th scope="col" key={day}>
                    {format(day, 'M/d')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.person.id}>
                  <th scope="row" className="weekly-person">
                    <button
                      className="member-detail-button"
                      onClick={() => setSelected(r.person.id)}
                    >
                      {r.person.name}
                    </button>
                  </th>
                  <td className="travel-month-total">
                    {yen(r.travel)}
                    {r.noTravel && (
                      <small className="cell-note">
                        交通費なし
                        <br />
                        申告済み
                      </small>
                    )}
                  </td>
                  {days.map((day) => {
                    const c = r.claims.find((c) => c.date === day);
                    const label = c ? travelStatusLabels[c.status] : '申請なし';
                    const cellClass = !c
                      ? 'weekly-empty'
                      : c.status === 'SUBMITTED'
                        ? 'travel-pending'
                        : c.status === 'APPROVED'
                          ? 'weekly-submitted'
                          : c.status === 'REJECTED'
                            ? 'travel-rejected'
                            : 'weekly-draft';
                    return (
                      <td key={day}>
                        <button
                          className={`weekly-cell ${cellClass}`}
                          aria-label={`${r.person.name} ${day} ${label}`}
                          onClick={() => (c ? setReviewClaimId(c.id) : setSelected(r.person.id))}
                        >
                          {label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AccordionCard>
      {reviewClaimId && (
        <TravelReview
          key={reviewClaimId}
          claimId={reviewClaimId}
          close={() => setReviewClaimId(null)}
        />
      )}
      {detail && (
        <Modal
          drawer
          title={`${detail.person.name} · ${month}の精算`}
          close={() => setSelected(null)}
        >
          <div className="drawer-summary">
            <span>保存済み明細の支払合計</span>
            <strong>{detail.result ? yen(detail.result.total) : '明細未作成'}</strong>
          </div>
          {detail.issues.length > 0 && (
            <div className="detail-section">
              <h3>確認すること</h3>
              <ul>
                {detail.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <section className="detail-section">
            <h3>現在の確定ポイントの内訳 · {detail.livePoints} pt</h3>
            {detail.awards.map((a) => {
              const m = state.wbsItems.find((m) => m.id === a.missionId);
              return (
                <p key={a.id}>
                  {m ? `${m.wbsCode} ${m.title}` : '工程情報なし'} · {a.points} pt（
                  {format(a.awardedAt, 'M/d')}承認）
                </p>
              );
            })}
            {!detail.awards.length && <p>この月の確定ポイントはありません。</p>}
          </section>
          <section className="detail-section">
            <h3>交通費の内訳 · {yen(detail.travel)}</h3>
            {detail.noTravel && <p>本人がこの月の「交通費なし」を申告済みです。</p>}
            {!detail.noTravel && !detail.claims.length && (
              <p>交通費の申請・なしの申告はまだありません。</p>
            )}
            {[...detail.claims]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((c) => (
                <div className="travel-detail-row" key={c.id}>
                  <div>
                    <strong>
                      {format(c.date, 'M/d')} · {travelStatusLabels[c.status]}
                      {c.status !== 'APPROVED' && '（集計対象外）'}
                    </strong>
                    <p>
                      {c.departure} → {c.arrival}（{c.trip === 'ROUND_TRIP' ? '往復' : '片道'}）
                    </p>
                    <small>
                      バス片道 {yen(c.busFare)} / 電車片道 {yen(c.trainFare)} / 駐車場{' '}
                      {yen(c.parkingFee)}
                    </small>
                  </div>
                  <strong>{yen(travelTotal(c))}</strong>
                </div>
              ))}
          </section>
          <section className="detail-section">
            <h3>毎月のAI利用料</h3>
            <p>本人への支払額に加算します。保存済み明細は自動変更されません。</p>
            <AiFeeSetting
              key={`${detail.person.id}_${state.aiFeeSettings.find((s) => s.id === detail.person.id)?.monthlyFee}`}
              userId={detail.person.id}
              name={detail.person.name}
            />
          </section>
          <PaymentStatements
            key={`${month}_${detail.person.id}`}
            month={month}
            personId={detail.person.id}
          />
        </Modal>
      )}
    </>
  );
}
function AiFeeSetting({ userId, name }: { userId: string; name: string }) {
  const { state, act, busy } = useStore();
  const saved = state.aiFeeSettings.find((s) => s.id === userId);
  const [fee, setFee] = useState(saved?.monthlyFee ?? 0);
  const [message, setMessage] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await act({ type: 'aiFeeSetting', payload: { item: { id: userId, monthlyFee: fee } } });
          setMessage('保存しました。');
        } catch (error) {
          setMessage((error as Error).message);
        }
      }}
    >
      <Field label={`${name}の月額AI利用料（円）`}>
        <input
          aria-label={`${name}の月額AI利用料（円）`}
          type="number"
          min={0}
          max={100000000}
          step={1}
          required
          value={Number.isNaN(fee) ? '' : fee}
          onChange={(e) => setFee(e.target.valueAsNumber)}
        />
      </Field>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={busy || saved?.monthlyFee === fee}
      >
        月額を保存
      </Button>
      {saved && <p className="help-text">保存済み：{yen(saved.monthlyFee)} / 月</p>}
      <Notice text={message} />
    </form>
  );
}

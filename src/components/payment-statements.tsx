'use client';
import { AccordionCard } from './ui/accordion-card';
import { submittedTravelTotal } from '@/lib/travel';
import { useState } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useStore } from '@/lib/store';
import { isParticipant, yen } from '@/lib/domain';
import {
  calculatePayment,
  defaultAmountMode,
  hasManualAmount,
  type PaymentStatement,
} from '@/lib/payment';
import { format, jstDate } from '@/lib/time';
import { Button } from './ui/button';
import { Field, Notice } from './ui/primitives';
export function PaymentStatements({ month, personId }: { month?: string; personId?: string }) {
  const { state } = useStore();
  const people = state.users.filter(isParticipant);
  const [selected, setSelected] = useState('');
  const userId = personId || selected || people[0]?.id || '';
  return (
    <AccordionCard title="電磁波PJ・個人別支払明細">
      <p>個人・期間ごとに費用を保存し、Word形式で出力できます。</p>
      {!personId && (
        <Field label="明細の対象者">
          <select value={userId} onChange={(e) => setSelected(e.target.value)}>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.active ? '' : '（無効）'}
              </option>
            ))}
          </select>
        </Field>
      )}
      {userId ? (
        <PaymentEditor key={userId + month} userId={userId} month={month} />
      ) : (
        <p>対象者がいません。</p>
      )}
    </AccordionCard>
  );
}
function PaymentEditor({ userId, month }: { userId: string; month?: string }) {
  const { state, act, busy } = useStore();
  const [start, setStart] = useState(
    format(startOfMonth(jstDate(month ? `${month}-01` : undefined)), 'yyyy-MM-dd'),
  );
  const [end, setEnd] = useState(
    format(endOfMonth(jstDate(month ? `${month}-01` : undefined)), 'yyyy-MM-dd'),
  );
  const id = `${userId}_${start}_${end}`;
  const saved = state.paymentStatements.find((p) => p.id === id);
  return (
    <>
      <div className="form-grid">
        <Field label="対象期間の開始日">
          <input required type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="対象期間の終了日">
          <input required type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <PaymentForm
        key={JSON.stringify(saved) + id + state.users.find((u) => u.id === userId)!.role}
        initial={
          saved ?? {
            id,
            userId,
            periodStart: start,
            periodEnd: end,
            aiFee: state.aiFeeSettings.find((s) => s.id === userId)?.monthlyFee ?? 0,
            travelCost: submittedTravelTotal(state.travelClaims, userId, start, end),
            pointRate: 0,
            variableCap: 0,
            amountMode: defaultAmountMode(state.users.find((u) => u.id === userId)!.role),
            manualAmount: null,
            changeReason: '',
          }
        }
        busy={busy}
        save={async (item) => {
          await act({ type: 'payment', payload: { item } });
        }}
      />
      <Field label="保存済みの対象期間">
        <select
          value={saved ? id : ''}
          onChange={(e) => {
            const p = state.paymentStatements.find((p) => p.id === e.target.value);
            if (p) {
              setStart(p.periodStart);
              setEnd(p.periodEnd);
            }
          }}
        >
          <option value="">期間を選択</option>
          {state.paymentStatements
            .filter((p) => p.userId === userId)
            .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.periodStart} ～ {p.periodEnd}
              </option>
            ))}
        </select>
      </Field>
      <PaymentHistory statementId={id} />
    </>
  );
}
function PaymentForm({
  initial,
  busy,
  save,
}: {
  initial: PaymentStatement;
  busy: boolean;
  save: (p: PaymentStatement) => Promise<void>;
}) {
  const { state } = useStore();
  const isLeader = state.users.find((u) => u.id === initial.userId)?.role === 'LEADER';
  const [item, setItem] = useState<PaymentStatement>(() =>
    isLeader
      ? { ...initial, amountMode: 'manual', changeReason: initial.changeReason || 'LEADER定額報酬' }
      : initial,
  );
  const [outputDate, setOutputDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  let result: ReturnType<typeof calculatePayment> | undefined;
  let error = '';
  try {
    if (isLeader && !hasManualAmount(item)) throw Error('LEADERの定額作業報酬を入力してください。');
    result = calculatePayment(item, state.pointAwards);
  } catch (e) {
    error = (e as Error).message;
  }
  async function submit(download: boolean) {
    setWorking(true);
    setMessage('');
    try {
      const name = state.users.find((u) => u.id === item.userId)!.name;
      // Generate before saving so invalid output dates or generation failures do not save a partial operation.
      const blob = download
        ? await (
            await import('@/lib/payment-docx')
          ).paymentDocx(
            { ...item, calculation: calculatePayment(item, state.pointAwards) },
            name,
            outputDate,
            state.pointAwards,
          )
        : null;
      await save(item);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `支払明細_${name.replace(/[\\/:*?"<>|]/g, '_')}_${item.periodStart}_${item.periodEnd}.docx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage(download ? '保存してWordを出力しました。' : '明細を保存しました。');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit((e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'word');
      }}
    >
      <fieldset className="payment-mode">
        <legend>今月の作業報酬</legend>
        <label>
          <input
            type="radio"
            name="amount-mode"
            disabled={isLeader}
            checked={(item.amountMode ?? 'points') === 'points'}
            onChange={() =>
              setItem({ ...item, amountMode: 'points', manualAmount: null, changeReason: '' })
            }
          />
          ポイントから自動計算
        </label>
        <label>
          <input
            type="radio"
            name="amount-mode"
            checked={item.amountMode === 'manual'}
            onChange={() =>
              setItem({ ...item, amountMode: 'manual', manualAmount: null, changeReason: '' })
            }
          />
          {isLeader ? '定額で支払い（ポイント数に関係なし）' : '手動で金額を設定'}
        </label>
      </fieldset>
      {item.amountMode === 'manual' && (
        <Field label={isLeader ? '定額作業報酬（円）' : '手動設定する作業報酬（円）'}>
          <input
            type="number"
            min={0}
            max={100000000}
            step={1}
            value={
              item.manualAmount == null || Number.isNaN(item.manualAmount) ? '' : item.manualAmount
            }
            required={isLeader}
            placeholder={isLeader ? '定額を入力（0円も可）' : '未入力ならポイントから計算'}
            onChange={(e) =>
              setItem({
                ...item,
                manualAmount: e.target.value === '' ? null : e.target.valueAsNumber,
              })
            }
          />
        </Field>
      )}
      <Field label="変更理由">
        <textarea
          aria-label="変更理由"
          maxLength={1000}
          required={hasManualAmount(item)}
          value={item.changeReason ?? ''}
          placeholder="例：今月のリーダー業務を含めて調整"
          onChange={(e) => setItem({ ...item, changeReason: e.target.value })}
        />
      </Field>
      <p>
        AI利用料と交通費は、作業報酬に別途加算します。
        {isLeader
          ? 'LEADERは定額の入力が必要です。0円も指定できます。'
          : '手動金額が未入力の場合はポイント計算額を採用します。0円の指定もできます。'}
      </p>
      <div className="form-grid">
        <Field label="出力日">
          <input
            required
            type="date"
            value={outputDate}
            onChange={(e) => setOutputDate(e.target.value)}
          />
        </Field>
        {(
          [
            ['aiFee', 'AI利用料（定額・円）'],
            ['travelCost', '交通費（円）'],
            ['pointRate', 'ポイント単価（円 / pt）'],
            ['variableCap', '変動費の上限（円）'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              type="number"
              required
              min={0}
              max={100000000}
              step={1}
              value={Number.isNaN(item[key]) ? '' : item[key]}
              onChange={(e) => setItem({ ...item, [key]: e.target.valueAsNumber })}
            />
          </Field>
        ))}
      </div>
      <p>
        現在の月額AI利用料：
        {yen(state.aiFeeSettings.find((s) => s.id === item.userId)?.monthlyFee ?? 0)}
        （本人への支払いに加算）
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={busy || working}
        onClick={() =>
          setItem({
            ...item,
            aiFee: state.aiFeeSettings.find((s) => s.id === item.userId)?.monthlyFee ?? 0,
          })
        }
      >
        月額AI利用料を明細に反映
      </Button>
      <p>
        対象期間の申請済み交通費：
        {yen(
          submittedTravelTotal(state.travelClaims, item.userId, item.periodStart, item.periodEnd),
        )}
        （下書きを除く）
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={busy || working}
        onClick={() =>
          setItem({
            ...item,
            travelCost: submittedTravelTotal(
              state.travelClaims,
              item.userId,
              item.periodStart,
              item.periodEnd,
            ),
          })
        }
      >
        申請済み交通費を明細に反映
      </Button>
      <p>反映ボタンで交通費欄を置き換えます。申請の修正後は再度反映し、明細を保存してください。</p>
      <p>
        変動費 ＝ 対象期間の承認済みポイント × 単価（上限まで）。上限0円の場合、変動費は0円です。
      </p>
      {result && (
        <div aria-label="支払明細プレビュー">
          <p>承認済みポイント：{result.points} pt（日本時間・開始日と終了日を含む）</p>
          <p>
            ポイント計算額：{yen(result.rawVariable)} → 上限適用後 {yen(result.variable)}
          </p>
          <p>
            採用する作業報酬：{yen(result.workAmount)}（
            {hasManualAmount(item) ? '手動設定' : 'ポイント計算'}）
          </p>
          {initial.calculation && initial.calculation.points !== result.points && (
            <p>
              保存時点は{initial.calculation.points} ptです。再保存すると現在の{result.points}{' '}
              ptで明細を更新します。
            </p>
          )}
          <p>
            <strong>支払合計：{yen(result.total)}</strong>
          </p>
        </div>
      )}
      <Notice text={error || message} />
      <div className="form-actions">
        <Button type="submit" value="save" disabled={busy || working || !!error}>
          明細を保存
        </Button>
        <Button type="submit" value="word" variant="outline" disabled={busy || working || !!error}>
          保存してWord出力
        </Button>
      </div>
    </form>
  );
}

function PaymentHistory({ statementId }: { statementId: string }) {
  const { state } = useStore();
  const entries = state.paymentRevisions
    .filter((r) => r.statementId === statementId)
    .sort((a, b) => (b.after.revision ?? 0) - (a.after.revision ?? 0));
  return (
    <section className="payment-history">
      <h3>変更履歴</h3>
      {!entries.length && <p>記録された変更履歴はありません。次回保存時から記録します。</p>}
      {entries.map((entry) => (
        <details key={entry.id}>
          <summary>
            第{entry.after.revision}版 ·{' '}
            {entry.after.updatedAt
              ? format(entry.after.updatedAt, 'yyyy/MM/dd HH:mm:ss')
              : '日時不明'}{' '}
            · {yen(entry.after.calculation?.total ?? 0)}
          </summary>
          <p>
            変更者：
            {state.users.find((u) => u.id === entry.after.updatedBy)?.name ??
              entry.after.updatedBy}{' '}
            / 保存時のロール：{entry.after.roleAtSave}
          </p>
          <p>理由：{entry.after.changeReason}</p>
          <p>
            金額決定方法：
            {entry.after.amountMode === 'manual' && entry.after.manualAmount != null
              ? '手動設定'
              : 'ポイント計算'}{' '}
            / 手動設定額：
            {entry.after.manualAmount != null ? yen(entry.after.manualAmount) : '未設定'}
          </p>
          <p>
            保存時点：{entry.after.calculation?.points} pt × {yen(entry.after.pointRate)}
            、ポイント計算額 {yen(entry.after.calculation?.rawVariable ?? 0)} → 上限適用後{' '}
            {yen(entry.after.calculation?.variable ?? 0)}
          </p>
          <p>
            作業報酬：{yen(entry.after.calculation?.workAmount ?? 0)} ＋ AI利用料{' '}
            {yen(entry.after.aiFee)} ＋ 交通費 {yen(entry.after.travelCost)} ＝ 支払合計{' '}
            {yen(entry.after.calculation?.total ?? 0)}
          </p>
          {entry.before ? (
            <div>
              <h4>変更前の明細</h4>
              <p>
                AI利用料 {yen(entry.before.aiFee)} / 交通費 {yen(entry.before.travelCost)} / 単価{' '}
                {yen(entry.before.pointRate)} / 上限 {yen(entry.before.variableCap)}
              </p>
              {entry.before.calculation ? (
                <p>
                  ポイント計算額 {yen(entry.before.calculation.rawVariable)} / 作業報酬{' '}
                  {yen(entry.before.calculation.workAmount)} / 支払合計{' '}
                  {yen(entry.before.calculation.total)}
                </p>
              ) : (
                <p>旧形式の明細のため、保存時点のポイント・支払合計の記録はありません。</p>
              )}
              <p>変更理由：{entry.before.changeReason || '記録なし'}</p>
            </div>
          ) : (
            <p>新規作成</p>
          )}
        </details>
      ))}
    </section>
  );
}

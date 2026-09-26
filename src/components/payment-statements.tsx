'use client';
import { submittedTravelTotal } from '@/lib/travel';
import { useState } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useStore } from '@/lib/store';
import { isParticipant, yen } from '@/lib/domain';
import { calculatePayment, type PaymentStatement } from '@/lib/payment';
import { format, jstDate } from '@/lib/time';
import { Button } from './ui/button';
import { Field, Notice } from './ui/primitives';
export function PaymentStatements() {
  const { state } = useStore();
  const people = state.users.filter(isParticipant);
  const [selected, setSelected] = useState('');
  const userId = selected || people[0]?.id || '';
  return (
    <section className="panel detail-section">
      <h2>AI電磁波・個人別支払明細</h2>
      <p>個人・期間ごとに費用を保存し、Word形式で出力できます。</p>
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
      {userId ? <PaymentEditor key={userId} userId={userId} /> : <p>対象者がいません。</p>}
    </section>
  );
}
function PaymentEditor({ userId }: { userId: string }) {
  const { state, act, busy } = useStore();
  const [start, setStart] = useState(format(startOfMonth(jstDate()), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(format(endOfMonth(jstDate()), 'yyyy-MM-dd'));
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
        key={JSON.stringify(saved) + id}
        initial={
          saved ?? {
            id,
            userId,
            periodStart: start,
            periodEnd: end,
            aiFee: 0,
            travelCost: 0,
            pointRate: 0,
            variableCap: 0,
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
  const [item, setItem] = useState(initial);
  const [outputDate, setOutputDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  let result: ReturnType<typeof calculatePayment> | undefined;
  let error = '';
  try {
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
          ).paymentDocx(item, name, outputDate, state.pointAwards)
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
            変動費：{yen(result.rawVariable)} → 上限適用後 {yen(result.variable)}
          </p>
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

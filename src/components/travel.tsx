'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { canManage, isParticipant, yen } from '@/lib/domain';
import { emptyRoute, travelTotal, type TravelRoute, type TravelClaim } from '@/lib/travel';
import { format } from '@/lib/time';
import { validPaymentDate } from '@/lib/payment';
import { Button } from './ui/button';
import { Field, Notice, PageHeading } from './ui/primitives';
export function TravelPage() {
  const { state, user } = useStore();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [person, setPerson] = useState(user.id);
  const saved = state.travelClaims.find((c) => c.userId === user.id && c.date === date);
  const claims = state.travelClaims
    .filter((c) => c.date.startsWith(month) && c.userId === person)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeading
        eyebrow="TRAVEL EXPENSES"
        title="交通費"
        description="日ごとの交通費を保存・申請できます。よく使う経路は保存して再利用できます。"
      />
      {isParticipant(user) && (
        <section className="panel detail-section">
          <h2>自分の交通費を入力</h2>
          <Field label="利用日">
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <TravelForm key={user.id + date + JSON.stringify(saved)} date={date} saved={saved} />
        </section>
      )}
      <section className="panel detail-section">
        <h2>交通費の申請一覧</h2>
        <div className="form-grid">
          <Field label="表示月">
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (validPaymentDate(`${e.target.value}-01`)) setMonth(e.target.value);
              }}
            />
          </Field>
          {canManage(user) && (
            <Field label="申請者">
              <select value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value={user.id}>自分</option>
                {state.users
                  .filter((u) => isParticipant(u) && u.id !== user.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>
        {person === user.id && isParticipant(user) && (
          <NoTravelDeclaration key={user.id + month} month={month} />
        )}
        <p>
          申請済み合計：
          {yen(
            claims
              .filter((c) => c.status === 'SUBMITTED')
              .reduce((sum, c) => sum + travelTotal(c), 0),
          )}
          （下書きを除く）
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>利用日</th>
                <th>経路</th>
                <th>区分</th>
                <th>バス・片道</th>
                <th>電車・片道</th>
                <th>駐車場・1日</th>
                <th>合計</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>{c.date}</td>
                  <td>
                    {c.departure} → {c.arrival}
                  </td>
                  <td>{c.trip === 'ROUND_TRIP' ? '往復' : '片道'}</td>
                  <td>{yen(c.busFare)}</td>
                  <td>{yen(c.trainFare)}</td>
                  <td>{yen(c.parkingFee)}</td>
                  <td>{yen(travelTotal(c))}</td>
                  <td>{c.status === 'SUBMITTED' ? '申請済み' : '下書き'}</td>
                  <td>
                    {c.userId === user.id && (
                      <Button variant="outline" onClick={() => setDate(c.date)}>
                        編集
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!claims.length && <p>この月の交通費はありません。</p>}
      </section>
    </>
  );
}
function TravelForm({ date, saved }: { date: string; saved?: TravelClaim }) {
  const { state, user, act, busy } = useStore();
  const [route, setRoute] = useState<TravelRoute>(saved ?? emptyRoute());
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const templates = state.travelTemplates.filter((t) => t.userId === user.id);
  async function save(kind: string) {
    setMessage('');
    try {
      const fields: TravelRoute = {
        departure: route.departure.trim(),
        arrival: route.arrival.trim(),
        trip: route.trip,
        busFare: route.busFare,
        trainFare: route.trainFare,
        parkingFee: route.parkingFee,
      };
      if (kind === 'template') {
        const label = name.trim();
        await act({
          type: 'travelTemplate',
          payload: { item: { ...fields, id: `${user.id}_${label}`, userId: user.id, name: label } },
        });
        setMessage('経路を保存しました。同じ名前で保存すると更新されます。');
      } else {
        await act({
          type: 'travelClaim',
          payload: {
            item: {
              ...fields,
              id: `${user.id}_${date}`,
              userId: user.id,
              date,
              status: kind === 'submit' ? 'SUBMITTED' : 'DRAFT',
            },
          },
        });
        setMessage(kind === 'submit' ? '申請しました。' : '下書きを保存しました。');
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save((e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'draft');
      }}
    >
      <p>
        1日1件で保存します。同じ日の保存は更新になります。申請済みの内容も修正でき、下書きに戻すと申請対象から外れます。
      </p>
      {saved && (
        <p role="status">保存状態：{saved.status === 'SUBMITTED' ? '申請済み' : '下書き'}</p>
      )}
      <Field label="保存した経路を呼び出す">
        <select
          value=""
          onChange={(e) => {
            const t = templates.find((t) => t.id === e.target.value);
            if (t) {
              setRoute(t);
              setName(t.name);
            }
          }}
        >
          <option value="">経路を選択</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="出発地">
          <input
            required
            maxLength={200}
            value={route.departure}
            onChange={(e) => setRoute({ ...route, departure: e.target.value })}
          />
        </Field>
        <Field label="到着地">
          <input
            required
            maxLength={200}
            value={route.arrival}
            onChange={(e) => setRoute({ ...route, arrival: e.target.value })}
          />
        </Field>
        <Field label="片道・往復">
          <select
            value={route.trip}
            onChange={(e) => setRoute({ ...route, trip: e.target.value as TravelRoute['trip'] })}
          >
            <option value="ONE_WAY">片道</option>
            <option value="ROUND_TRIP">往復</option>
          </select>
        </Field>
        {(
          [
            ['busFare', 'バス代（片道・円）'],
            ['trainFare', '電車代（片道・円）'],
            ['parkingFee', '駐車場代（1日分・円）'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              type="number"
              required
              min={0}
              max={1000000}
              step={1}
              value={Number.isNaN(route[key]) ? '' : route[key]}
              onChange={(e) => setRoute({ ...route, [key]: e.target.valueAsNumber })}
            />
          </Field>
        ))}
      </div>
      <p>往復は（バス代＋電車代）× 2 ＋ 駐車場代。利用しない項目は0円にしてください。</p>
      <p aria-label="交通費合計">
        <strong>合計：{Number.isFinite(travelTotal(route)) ? yen(travelTotal(route)) : '—'}</strong>
      </p>
      <Field label="よく使う経路の名前">
        <input
          maxLength={100}
          placeholder="例：九工大からMID."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Button type="submit" value="template" variant="outline" disabled={busy || !name.trim()}>
        この経路を保存
      </Button>
      <Notice text={message} />
      <div className="form-actions">
        <Button type="submit" value="draft" variant="outline" disabled={busy}>
          {saved?.status === 'SUBMITTED' ? '下書きに戻す' : '下書き保存'}
        </Button>
        <Button type="submit" value="submit" disabled={busy}>
          交通費を申請
        </Button>
      </div>
    </form>
  );
}

function NoTravelDeclaration({ month }: { month: string }) {
  const { state, user, act, busy } = useStore();
  const [message, setMessage] = useState('');
  const hasClaims = state.travelClaims.some(
    (c) => c.userId === user.id && c.date.startsWith(`${month}-`),
  );
  const declared = state.travelDeclarations.some(
    (d) => d.userId === user.id && d.month === month && d.status === 'NONE',
  );
  const noTravel = declared && !hasClaims;
  return (
    <div className="no-travel-declaration">
      <div>
        <strong>
          {month}の交通費：{noTravel ? 'なし・申告済み' : hasClaims ? '記録あり' : '未申告'}
        </strong>
        <p>
          {hasClaims
            ? 'この月には交通費の記録があります。下書きは申請を完了してください。'
            : '交通費が発生していない月は「交通費なし」を申告してください。あとから交通費を登録すると、この申告は自動で取り消されます。'}
        </p>
      </div>
      <Button
        variant="outline"
        disabled={busy || (hasClaims && !declared)}
        onClick={async () => {
          setMessage('');
          try {
            await act({
              type: 'travelDeclaration',
              payload: { month, status: declared ? 'CANCELLED' : 'NONE' },
            });
            setMessage(
              declared ? '交通費なしの申告を取り消しました。' : '交通費なしを申告しました。',
            );
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        {declared ? '交通費なしの申告を取り消す' : 'この月は交通費なしと申告'}
      </Button>
      <Notice text={message} />
    </div>
  );
}

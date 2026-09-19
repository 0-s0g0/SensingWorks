'use client';
import { downloadCsv, availabilityCsv } from '@/lib/csv';
import { useState, useRef, useEffect } from 'react';
import { addDays, addWeeks, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { format, jstDate } from '@/lib/time';
import { Download, Check, ChevronLeft, ChevronRight, MousePointer2, Save, Users, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { AvailabilityStatus, weekOf } from '@/lib/domain';
import { Button } from './ui/button';
import { PageHeading, Modal, Field, Notice, Avatar } from './ui/primitives';
const labels = {
  AVAILABLE: '○ 来れる',
  MAYBE: '△ 未確定',
  UNAVAILABLE: '× 来れない',
  CLEAR: '未入力に戻す',
};
type Cell = { date: string; hour: number; status: AvailabilityStatus | null };
export function AvailabilityPage() {
  const { state, user, act, busy, setAvailabilityWeek } = useStore();
  const [target, setTarget] = useState('team');
  const [editing, setEditing] = useState(false);
  const members = state.users.filter((u) => u.active);
  const admin = target === 'team';
  const editable = editing && !admin && (target === user.id || user.role === 'OWNER');
  const initial = weekOf(
    new Date() < new Date('2026-09-01')
      ? new Date('2026-09-01')
      : new Date() > new Date('2027-03-31')
        ? new Date('2027-03-31')
        : new Date(),
  );
  const [week, setWeek] = useState(initial),
    [mode, setMode] = useState<AvailabilityStatus | 'CLEAR'>('AVAILABLE'),
    [draft, setDraft] = useState<Record<string, Cell>>({}),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<{ date: string; hour: number } | null>(null);
  useEffect(() => setAvailabilityWeek(week), [week, setAvailabilityWeek]);
  const anchor = useRef<{ day: number; hour: number } | null>(null),
    [range, setRange] = useState<string[]>([]);
  const dates = Array.from({ length: 7 }, (_, i) =>
      format(addDays(jstDate(week), i), 'yyyy-MM-dd'),
    ),
    hours = Array.from({ length: 14 }, (_, i) => 9 + i),
    key = (d: string, h: number) => `${d}/${h}`;
  const valid = (d: string) => d >= '2026-09-01' && d <= '2027-03-31';
  function status(d: string, h: number) {
    const k = key(d, h);
    return k in draft
      ? draft[k].status
      : state.availability.find((a) => a.userId === target && a.date === d && a.hour === h)
          ?.status || null;
  }
  function paint(keys: string[]) {
    if (!editable) return;
    setDraft((old) => {
      const n = { ...old };
      keys.forEach((k) => {
        const [date, h] = k.split('/');
        if (valid(date)) {
          const currentStatus = status(date, Number(h));
          // 同じステータスにドラッグした場合は削除（null）、それ以外は新しいステータスを設定
          const newStatus = mode === 'CLEAR' ? null : currentStatus === mode ? null : mode;
          n[k] = { date, hour: Number(h), status: newStatus };
        }
      });
      return n;
    });
  }
  function rectangle(day: number, hour: number) {
    const a = anchor.current;
    if (!a) return [];
    return dates.flatMap((d, i) =>
      i >= Math.min(day, a.day) && i <= Math.max(day, a.day)
        ? hours
            .filter((h) => h >= Math.min(hour, a.hour) && h <= Math.max(hour, a.hour))
            .map((h) => key(d, h))
        : [],
    );
  }
  return (
    <>
      <PageHeading
        eyebrow={admin ? 'TEAM AVAILABILITY' : 'MID. SCHEDULE'}
        title={admin ? 'みんなのMID.予定' : editable ? 'MID.予定を入力' : 'MID.予定を確認'}
        description={
          admin
            ? '人数の濃淡で参加状況を確認。セルを選ぶとメンバーの回答を表示します。'
            : editable
              ? '来れる時間をクリック、またはドラッグ。1時間単位で予定を入力できます。'
              : 'メンバーの予定を閲覧しています。自分の予定は「予定を入力」から登録できます。'
        }
        action={
          <div className="panel-actions">
            <Button
              variant="outline"
              disabled={busy || Object.keys(draft).length > 0}
              title={
                Object.keys(draft).length
                  ? '変更を保存または破棄してから出力してください'
                  : '表示中の週・メンバーの保存済み予定を出力'
              }
              onClick={() =>
                downloadCsv(
                  `SensingWorks-MID-${week}-${admin ? 'team' : 'member'}.csv`,
                  availabilityCsv(state, week, target),
                )
              }
            >
              <Download size={16} />
              この週をCSV出力
            </Button>
            {editable ? (
              <>
                <Button
                  variant="outline"
                  disabled={busy || Object.keys(draft).length > 0}
                  onClick={() => {
                    setEditing(false);
                    setTarget('team');
                    setMessage('');
                  }}
                >
                  入力を終了
                </Button>
                <Button
                  disabled={busy || !Object.keys(draft).length}
                  onClick={async () => {
                    try {
                      await act({
                        type: 'availability',
                        payload: { userId: target, cells: Object.values(draft) },
                      });
                      setDraft({});
                      setMessage('予定を保存しました。');
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  <Save size={16} />
                  {busy
                    ? '保存中…'
                    : `予定を保存${Object.keys(draft).length ? ` (${Object.keys(draft).length})` : ''}`}
                </Button>
              </>
            ) : (
              <>
                {user.role === 'OWNER' && !admin && target !== user.id && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    表示中の予定を編集
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setTarget(user.id);
                    setEditing(true);
                    setMessage('');
                    setMode('AVAILABLE');
                  }}
                >
                  予定を入力
                </Button>
              </>
            )}
          </div>
        }
      />
      <div className="filter-panel calendar-person">
        <Field label="表示する予定">
          <select
            value={target}
            disabled={Object.keys(draft).length > 0}
            onChange={(e) => {
              setTarget(e.target.value);
              setEditing(false);
            }}
          >
            <option value="team">チーム全体（参加可能人数）</option>
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.id === user.id ? '（自分）' : ''}
              </option>
            ))}
          </select>
        </Field>
        {Object.keys(draft).length > 0 && (
          <Button variant="ghost" onClick={() => setDraft({})}>
            未保存の変更を破棄
          </Button>
        )}
      </div>
      <div className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="week-picker">
            <Button
              variant="outline"
              size="icon"
              aria-label="前の週"
              disabled={week <= '2026-08-31'}
              onClick={() => setWeek(format(addWeeks(jstDate(week), -1), 'yyyy-MM-dd'))}
            >
              <ChevronLeft size={17} />
            </Button>
            <h2>{format(jstDate(week), 'yyyy年 M月')}</h2>
            <Button
              variant="outline"
              size="icon"
              aria-label="次の週"
              disabled={week >= '2027-03-29'}
              onClick={() => setWeek(format(addWeeks(jstDate(week), 1), 'yyyy-MM-dd'))}
            >
              <ChevronRight size={17} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeek(initial)}>
              今週
            </Button>
          </div>
          <div className="calendar-actions">
            {editable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft((old) => ({
                    ...old,
                    ...Object.fromEntries(
                      dates.flatMap((date) =>
                        hours
                          .filter(() => valid(date))
                          .map((hour) => [key(date, hour), { date, hour, status: null }]),
                      ),
                    ),
                  }));
                }}
              >
                この週を全削除
              </Button>
            )}
            {admin && (
              <span className="muted">
                <Users size={15} /> チーム {members.length}人
              </span>
            )}
          </div>
        </div>
        <div className="calendar-legend">
          {editable ? (
            <div className="paint-options">
              {Object.entries(labels).map(([st, label]) => (
                <button
                  key={st}
                  className={`${st.toLowerCase()} ${mode === st ? 'selected' : ''}`}
                  onClick={() => setMode(st as typeof mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : admin ? (
            <div className="heat-legend">
              参加可能人数 <span style={{ background: '#f4f8f7' }} />少{' '}
              <span style={{ background: '#b5e2d9' }} />
              <span style={{ background: '#168f83' }} />多
            </div>
          ) : (
            <span>閲覧のみ（本人とOwnerが編集できます）</span>
          )}
          <span className="calendar-help">
            <MousePointer2 size={14} />
            {admin
              ? 'クリックでメンバーを確認'
              : editable
                ? 'PC：ドラッグ選択 / スマホ：タップ入力'
                : '閲覧モード'}
          </span>
        </div>
        <Notice text={message} />
        <div className="calendar-scroll">
          <div
            className="calendar-grid"
            role="grid"
            aria-label={admin ? 'チーム参加状況' : '参加可能時間'}
            onPointerUp={() => {
              if (anchor.current) {
                paint(range);
                anchor.current = null;
                setRange([]);
              }
            }}
            onPointerLeave={() => {
              if (anchor.current) {
                paint(range);
                anchor.current = null;
                setRange([]);
              }
            }}
          >
            <div className="calendar-corner">JST</div>
            {dates.map((d) => (
              <div
                className={`calendar-date ${d === format(new Date(), 'yyyy-MM-dd') ? 'today' : ''}`}
                key={d}
              >
                <small>{format(new Date(d), 'EEE', { locale: ja })}</small>
                <strong>{format(new Date(d), 'd')}</strong>
                <span>{format(new Date(d), 'M月')}</span>
                {editable && valid(d) && (
                  <button
                    className="day-clear"
                    aria-label={`${d} この日の予定を全削除`}
                    onClick={() => {
                      setDraft((old) => ({
                        ...old,
                        ...Object.fromEntries(
                          hours.map((hour) => [key(d, hour), { date: d, hour, status: null }]),
                        ),
                      }));
                    }}
                  >
                    全削除
                  </button>
                )}
              </div>
            ))}
            {hours.map((h) => (
              <div className="calendar-row" key={h}>
                <div className="calendar-time">{h}:00</div>
                {dates.map((d, i) => {
                  const available = state.availability.filter(
                      (a) =>
                        members.some((u) => u.id === a.userId) &&
                        a.date === d &&
                        a.hour === h &&
                        a.status === 'AVAILABLE',
                    ).length,
                    maybe = state.availability.filter(
                      (a) =>
                        members.some((u) => u.id === a.userId) &&
                        a.date === d &&
                        a.hour === h &&
                        a.status === 'MAYBE',
                    ).length,
                    st = status(d, h),
                    k = key(d, h),
                    active = range.includes(k);
                  return (
                    <button
                      role="gridcell"
                      key={d}
                      disabled={!valid(d) || (!admin && !editable)}
                      className={`calendar-cell ${!admin && st ? st.toLowerCase() : ''} ${active ? 'painting' : ''} ${k in draft ? 'unsaved' : ''}`}
                      style={
                        admin && available
                          ? {
                              background: `rgba(22,143,131,${0.1 + (0.65 * available) / Math.max(members.length, 1)})`,
                            }
                          : undefined
                      }
                      aria-label={`${d} ${h}:00 ${admin ? `${available}人参加可能` : st ? labels[st] : '未入力'}`}
                      onPointerDown={(e) => {
                        if (!editable || e.pointerType === 'touch') return;
                        e.preventDefault();
                        anchor.current = { day: i, hour: h };
                        setRange([k]);
                      }}
                      onPointerEnter={() => {
                        if (anchor.current) setRange(rectangle(i, h));
                      }}
                      onClick={(e) => {
                        if (admin) {
                          setSelected({ date: d, hour: h });
                          return;
                        }
                        if (
                          editable &&
                          (e.detail === 0 || !window.matchMedia('(pointer:fine)').matches)
                        )
                          paint([k]);
                      }}
                    >
                      {admin ? (
                        <span>
                          {available > 0 ? (
                            <>
                              {available}
                              <small>人 ○</small>
                            </>
                          ) : (
                            <small>○ 0人</small>
                          )}
                          {maybe > 0 && <small>△ {maybe}人</small>}
                        </span>
                      ) : st ? (
                        <span>
                          {st === 'AVAILABLE' ? '○' : st === 'MAYBE' ? '△' : '×'}
                          <small>
                            {st === 'AVAILABLE' ? '来れる' : st === 'MAYBE' ? '未確定' : '来れない'}
                          </small>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-bottom">
          <span>
            <span className="live-dot" />
            入力対象：2026年9月1日〜2027年3月31日
          </span>
          <span>9:00〜23:00 · 1時間単位</span>
        </div>
      </div>
      {selected && (
        <Modal
          title={`${format(new Date(selected.date), 'M月d日（E）', { locale: ja })} ${selected.hour}:00–${selected.hour + 1}:00`}
          close={() => setSelected(null)}
        >
          {members.map((p) => {
            const a = state.availability.find(
              (a) => a.userId === p.id && a.date === selected.date && a.hour === selected.hour,
            );
            return (
              <div className="member-line availability-member" key={p.id}>
                <Avatar name={p.name} />
                <strong>{p.name}</strong>
                <span className={`availability-label ${a?.status.toLowerCase() || ''}`}>
                  {a ? labels[a.status] : '未回答'}
                </span>
              </div>
            );
          })}
        </Modal>
      )}
    </>
  );
}

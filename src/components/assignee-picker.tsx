'use client';
import { isParticipant } from '@/lib/domain';
import { useState } from 'react';
import { ChevronDown, UserRound } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { WbsItem } from '@/lib/domain';
import { Modal, Notice, Field } from './ui/primitives';
import { Button } from './ui/button';

export function AssigneePicker({ item }: { item: WbsItem }) {
  const { state, act, busy } = useStore();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState(item.assigneeIds);
  const [primary, setPrimary] = useState(item.primaryId);
  const [error, setError] = useState('');
  const locked = ['REPORT_SUBMITTED', 'REVIEW', 'COMPLETED'].includes(item.status);
  return (
    <>
      <button
        className="assignee-trigger"
        aria-label={`${item.wbsCode} 担当者を変更`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setIds(item.assigneeIds);
          setPrimary(item.primaryId);
          setError('');
          setOpen(true);
        }}
      >
        <span className="assignee-avatars">
          {item.assigneeIds.length ? (
            item.assigneeIds.map((id) => {
              const name = state.users.find((u) => u.id === id)?.name ?? '未登録';
              return (
                <span
                  className={`assignee-avatar ${id === item.primaryId ? 'primary' : ''}`}
                  key={id}
                  role="img"
                  aria-label={name}
                  title={`${name}${id === item.primaryId ? '（主担当）' : ''}`}
                >
                  {name.slice(0, 1)}
                </span>
              );
            })
          ) : (
            <span className="assignee-avatar" title="未担当">
              <UserRound size={16} />
            </span>
          )}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <Modal title={`${item.wbsCode} 担当者を変更`} close={() => setOpen(false)}>
          <p>最大6人まで選択できます。全メンバーが担当者を変更できます。</p>
          {locked && <p>提出済み・レビュー中・完了済みの工程は担当を固定しています。</p>}
          <Notice text={error} />
          <fieldset disabled={busy || locked} className="assignee-options">
            <legend>担当者 {ids.length} / 6</legend>
            {state.users
              .filter((u) => (u.active && isParticipant(u)) || ids.includes(u.id))
              .map((u) => (
                <label key={u.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(u.id)}
                    disabled={
                      !ids.includes(u.id) && (!u.active || !isParticipant(u) || ids.length >= 6)
                    }
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...ids, u.id]
                        : ids.filter((id) => id !== u.id);
                      setIds(next);
                      if (!primary || !next.includes(primary)) setPrimary(next[0] ?? null);
                    }}
                  />
                  {u.name}
                  {!u.active && '（無効）'}
                </label>
              ))}
            <Field label="主担当">
              <select value={primary ?? ''} onChange={(e) => setPrimary(e.target.value || null)}>
                {!ids.length && <option value="">未担当</option>}
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {state.users.find((u) => u.id === id)?.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              onClick={async () => {
                try {
                  await act({
                    type: 'assignment',
                    payload: { missionId: item.id, assigneeIds: ids, primaryId: primary },
                  });
                  setOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              担当者を保存
            </Button>
          </fieldset>
        </Modal>
      )}
    </>
  );
}

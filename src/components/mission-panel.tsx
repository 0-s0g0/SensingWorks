'use client';
import { SubtaskEditButton } from './subtask-edit-button';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  type WbsItem,
  type CompletionReport,
  type Attachment,
  distribute,
  effectiveStatus,
  integer,
  validateAllocation,
  yen,
  uid,
  progressOf,
} from '@/lib/domain';
import { uploadAttachment, downloadAttachment, emulatorMode } from '@/lib/firebase';
import { Button } from './ui/button';
import { Modal, Field, Notice, Badge, Progress } from './ui/primitives';
export const reportFields = [
  ['workSummary', '実施内容'],
  ['result', '結果'],
  ['wentWell', 'うまくいったこと'],
  ['didNotGoWell', 'うまくいかなかったこと'],
  ['findings', '分かったこと'],
  ['remainingIssues', '残課題'],
  ['handoverNotes', '次の人への引き継ぎ'],
] as const;
export function People({ item, shares }: { item: WbsItem; shares?: Record<string, number> }) {
  const { state } = useStore();
  return (
    <div className="people-list">
      {item.assigneeIds.length ? (
        item.assigneeIds.map((id) => (
          <span key={id} title={id === item.primaryId ? '主担当' : '共同担当'}>
            {state.users.find((u) => u.id === id)?.name ?? '未登録'}
            {id === item.primaryId && <small> 主</small>}
            {shares && ` ${shares[id] ?? 0}%`}
          </span>
        ))
      ) : (
        <span className="muted">未担当</span>
      )}
    </div>
  );
}
function SubtaskSection({
  missionId,
  involved,
  setMessage,
}: {
  missionId: string;
  involved: boolean;
  setMessage: (msg: string) => void;
}) {
  const { state, user, act, busy } = useStore();
  const [newSubtask, setNewSubtask] = useState('');
  const mission = state.wbsItems.find((x) => x.id === missionId);
  const subtasks = state.wbsItems
    .filter((x) => x.parentId === missionId)
    .sort((a, b) => a.order - b.order);
  const canEdit =
    user.role === 'OWNER' ||
    (involved && mission && effectiveStatus(mission, state.wbsItems) !== 'LOCKED');

  const addSubtask = async () => {
    if (!newSubtask.trim() || !mission) return;
    try {
      await act({ type: 'subtask', payload: { operation: 'add', missionId, title: newSubtask } });
      setNewSubtask('');
      setMessage('小工程を追加しました。');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const removeSubtask = async (subtaskId: string) => {
    if (!mission) return;
    try {
      await act({ type: 'subtask', payload: { operation: 'delete', id: subtaskId } });
      setMessage('小工程を削除しました。');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <section className="detail-section">
      <h3>小工程</h3>
      {subtasks.map((c) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label className="checklist" style={{ flex: 1 }}>
            <input
              type="checkbox"
              checked={c.status === 'COMPLETED'}
              disabled={busy || !canEdit}
              onChange={async (e) => {
                try {
                  await act({
                    type: 'subtask',
                    payload: { id: c.id, status: e.target.checked ? 'COMPLETED' : 'OPEN' },
                  });
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            />
            {c.title}
          </label>
          {canEdit && <SubtaskEditButton item={c} />}
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => removeSubtask(c.id)}
            >
              削除
            </Button>
          )}
        </div>
      ))}
      <Progress
        value={
          (progressOf(state, mission!).done / Math.max(1, progressOf(state, mission!).total)) * 100
        }
      />
      {canEdit && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="新しい小工程を追加..."
            value={newSubtask}
            disabled={busy || subtasks.length >= 30}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSubtask();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !newSubtask.trim() || subtasks.length >= 30}
            onClick={addSubtask}
          >
            追加
          </Button>
        </div>
      )}
    </section>
  );
}
export function MissionPanel({ id, close }: { id: string; close: () => void }) {
  const { state, user, act, busy } = useStore(),
    m = state.wbsItems.find((x) => x.id === id),
    [mode, setMode] = useState(id === 'new' ? 'edit' : 'detail'),
    [message, setMessage] = useState('');
  if (!m && id !== 'new') return null;
  const report = state.completionReports.find((r) => r.missionId === id);
  const reward = user.role === 'OWNER' ? state.rewardPrivate.find((r) => r.id === id) : undefined;
  const involved = !!m?.assigneeIds.includes(user.id);
  return (
    <Modal title={m ? `${m.wbsCode} ${m.title}` : '中工程を追加'} close={close}>
      <Notice text={message} />
      {mode === 'edit' ? (
        <MissionEditor
          item={m}
          done={() => {
            setMode('detail');
            if (!m) close();
          }}
        />
      ) : mode === 'report' && m ? (
        <CompletionEditor item={m} existing={report} done={() => setMode('detail')} />
      ) : (
        m && (
          <>
            <div className="mission-summary">
              <strong className="point-value">{m.pointValue}pt</strong>
              <Badge status={effectiveStatus(m, state.wbsItems)} />
              <span>
                開始日 {m.startDate || '未設定'} · 期限 {m.deadline}
              </span>
            </div>
            <p className="prewrap">{m.description}</p>
            <People item={m} />
            <div className="panel-actions">
              {involved && effectiveStatus(m, state.wbsItems) === 'ASSIGNED' && (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await act({ type: 'start', payload: { missionId: id } });
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  担当ミッションを開始
                </Button>
              )}
              {involved && ['IN_PROGRESS', 'REVISION'].includes(m.status) && (
                <Button onClick={() => setMode('report')}>
                  {report ? '終了報告を編集' : '終了報告を作成'}
                </Button>
              )}
              {(user.role === 'OWNER' || (involved && !['COMPLETED'].includes(m.status))) && (
                <Button variant="outline" onClick={() => setMode('edit')}>
                  中工程を編集
                </Button>
              )}
            </div>
            <SubtaskSection missionId={id} involved={involved} setMessage={setMessage} />
            <section className="detail-section">
              <h3>終了報告</h3>
              {report ? (
                <>
                  <p>
                    {report.status === 'DRAFT'
                      ? '共同編集中の下書き'
                      : report.status === 'APPROVED'
                        ? '承認済み'
                        : report.status === 'REVISION'
                          ? '修正依頼'
                          : '提出済み'}{' '}
                    · 更新 {new Date(report.updatedAt).toLocaleString('ja-JP')}
                  </p>
                  {report.reviewComment && (
                    <Notice text={`Ownerコメント：${report.reviewComment}`} />
                  )}
                  {reportFields.map(([key, label]) => (
                    <div className="report-read" key={key}>
                      <h4>{label}</h4>
                      <p className="prewrap">{report[key] || '—'}</p>
                    </div>
                  ))}
                  <p>実作業時間 {report.workHours} 時間</p>
                  <h4>Team申告貢献割合</h4>
                  <People item={m} shares={report.contributionShares} />
                  <div className="artifact-links">
                    {report.githubUrl && (
                      <a href={report.githubUrl} target="_blank" rel="noreferrer">
                        GitHub
                      </a>
                    )}
                    {report.externalUrl && (
                      <a href={report.externalUrl} target="_blank" rel="noreferrer">
                        外部URL
                      </a>
                    )}
                    {report.attachments.map((a, i) =>
                      a.url ? (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer">
                          {a.name}
                        </a>
                      ) : (
                        <button
                          key={i}
                          onClick={() => downloadAttachment(a).catch((e) => setMessage(e.message))}
                        >
                          {a.name}
                        </button>
                      ),
                    )}
                  </div>
                </>
              ) : (
                <p>まだ終了報告はありません。</p>
              )}
            </section>
            {m.status === 'COMPLETED' && (
              <section className="detail-section">
                <h3>確定ポイント</h3>
                {m.assigneeIds.map((id) => (
                  <p key={id}>
                    {state.users.find((u) => u.id === id)?.name}{' '}
                    <strong>{m.finalPoints[id]}pt</strong>
                  </p>
                ))}
              </section>
            )}
            {user.role === 'OWNER' && reward && (
              <section className="private-panel">
                <h3>Owner専用・内部報酬</h3>
                <p>
                  内部総報酬 <strong>{yen(reward.totalAmount)}</strong>
                </p>
                {Object.entries(reward.allocations).map(([id, n]) => (
                  <p key={id}>
                    {state.users.find((u) => u.id === id)?.name} {yen(n)}
                  </p>
                ))}
              </section>
            )}
            {user.role === 'OWNER' && report?.status === 'SUBMITTED' && (
              <ReviewEditor item={m} report={report} />
            )}
          </>
        )
      )}
      {mode !== 'detail' && m && (
        <Button variant="ghost" onClick={() => setMode('detail')}>
          詳細に戻る
        </Button>
      )}
    </Modal>
  );
}
function CompletionEditor({
  item,
  existing,
  done,
}: {
  item: WbsItem;
  existing?: CompletionReport;
  done: () => void;
}) {
  const { act, busy, user } = useStore();
  const [baseVersion] = useState(existing?.version ?? 0),
    [shares, setShares] = useState(
      existing?.contributionShares ?? distribute(100, item.assigneeIds),
    ),
    [attachments, setAttachments] = useState<Attachment[]>(existing?.attachments ?? []),
    [message, setMessage] = useState(''),
    [uploading, setUploading] = useState(false);
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const submit = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'submit';
        try {
          const fields = Object.fromEntries(
            reportFields.map(([key]) => [key, String(f.get(key) ?? '')]),
          ) as Pick<CompletionReport, (typeof reportFields)[number][0]>;
          const report: CompletionReport = {
            ...fields,
            id: item.id,
            missionId: item.id,
            workHours: Number(f.get('workHours')),
            githubUrl: String(f.get('githubUrl') ?? ''),
            externalUrl: String(f.get('externalUrl') ?? ''),
            attachments,
            contributionShares:
              item.assigneeIds.length === 1 ? { [item.assigneeIds[0]]: 100 } : shares,
            status: submit ? 'SUBMITTED' : 'DRAFT',
            submittedAt: null,
            updatedAt: '',
            updatedBy: user.id,
            version: baseVersion,
            reviewComment: '',
          };
          await act({ type: 'completion', payload: { missionId: item.id, report, baseVersion } });
          done();
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <p>担当者が共同で編集する1件の技術記録です。相談した貢献割合を入力してください。</p>
      <Notice text={message} />
      {reportFields.map(([key, label]) => (
        <Field
          key={key}
          label={`${label}${['workSummary', 'result'].includes(key) ? '（提出時必須）' : ''}`}
        >
          <textarea name={key} defaultValue={existing?.[key] ?? ''} rows={3} />
        </Field>
      ))}
      <div className="form-grid">
        <Field label="実作業時間（時間）">
          <input
            name="workHours"
            type="number"
            min="0"
            step="0.25"
            defaultValue={existing?.workHours ?? 0}
          />
        </Field>
        <Field label="GitHub URL">
          <input name="githubUrl" type="url" defaultValue={existing?.githubUrl ?? ''} />
        </Field>
        <Field label="外部URL">
          <input name="externalUrl" type="url" defaultValue={existing?.externalUrl ?? ''} />
        </Field>
      </div>
      <h3>添付ファイル・リンク</h3>
      <p className="help-text">
        Google Driveなどの共有リンクを登録できます。閲覧権限をチームに設定してください。
      </p>
      {attachments.map((a, i) => (
        <div className="attachment-edit" key={i}>
          <input
            aria-label={`添付${i + 1} 名前`}
            value={a.name}
            onChange={(e) =>
              setAttachments((old) =>
                old.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)),
              )
            }
          />
          {!a.path && (
            <input
              type="url"
              aria-label={`添付${i + 1} URL`}
              placeholder="https://drive.google.com/..."
              value={a.url}
              onChange={(e) =>
                setAttachments((old) =>
                  old.map((v, j) => (j === i ? { ...v, url: e.target.value } : v)),
                )
              }
            />
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAttachments((old) => old.filter((_, j) => j !== i))}
          >
            削除
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={attachments.length >= 10}
        onClick={() => setAttachments([...attachments, { name: '資料', url: '', path: '' }])}
      >
        添付リンクを追加
      </Button>
      {emulatorMode && (
        <Field label="ファイル添付（ローカル検証）">
          <input
            type="file"
            disabled={uploading || attachments.length >= 10}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                setAttachments((old) => [...old]);
                const a = await uploadAttachment(item.id, file);
                setAttachments((old) => [...old, a]);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </Field>
      )}
      <AllocationInputs
        item={item}
        values={shares}
        setValues={setShares}
        label="申告貢献割合"
        unit="%"
        total={100}
      />
      <p role="status">合計 {total} / 100%</p>
      <div className="panel-actions">
        <Button type="submit" value="draft" variant="outline" disabled={busy || uploading}>
          共同下書きを保存
        </Button>
        <Button type="submit" value="submit" disabled={busy || uploading || total !== 100}>
          終了報告を提出
        </Button>
      </div>
    </form>
  );
}
function AllocationInputs({
  item,
  values,
  setValues,
  label,
  unit,
  total,
}: {
  item: WbsItem;
  values: Record<string, number>;
  setValues: (v: Record<string, number>) => void;
  label: string;
  unit: string;
  total: number;
}) {
  const { state } = useStore();
  const sum = Object.values(values).reduce((a, b) => a + b, 0),
    remaining = total - sum;
  return (
    <fieldset className="allocation-fields">
      <legend>{label}</legend>
      {item.assigneeIds.map((id) => (
        <Field key={id} label={`${state.users.find((u) => u.id === id)?.name ?? id} ${label}`}>
          <div className="number-unit">
            <input
              type="number"
              min="0"
              step="1"
              required
              value={values[id] ?? 0}
              disabled={unit === '%' && item.assigneeIds.length === 1}
              onChange={(e) => setValues({ ...values, [id]: Number(e.target.value) })}
            />
            <span>{unit}</span>
          </div>
        </Field>
      ))}
      <p className={remaining === 0 ? 'allocation-valid' : 'allocation-warning'} role="status">
        {remaining === 0
          ? `合計 ${sum} / ${total}${unit}`
          : remaining > 0
            ? `残り ${remaining}${unit}`
            : `${-remaining}${unit}超過`}
      </p>
    </fieldset>
  );
}
function ReviewEditor({ item, report }: { item: WbsItem; report: CompletionReport }) {
  const { state, act, busy } = useStore(),
    reward = state.rewardPrivate.find((r) => r.id === item.id);
  const [points, setPoints] = useState(
      distribute(item.pointValue, item.assigneeIds, report.contributionShares),
    ),
    [amounts, setAmounts] = useState(
      distribute(reward?.totalAmount ?? 0, item.assigneeIds, report.contributionShares),
    ),
    [comment, setComment] = useState(''),
    [message, setMessage] = useState('');
  if (!reward) return <Notice text="内部報酬情報の取得を待っています。" />;
  const valid =
    Object.values(points).every(Number.isInteger) &&
    Object.values(points).reduce((a, b) => a + b, 0) === item.pointValue &&
    Object.values(amounts).every(Number.isInteger) &&
    Object.values(amounts).reduce((a, b) => a + b, 0) === reward.totalAmount;
  const send = async (decision: string) => {
    try {
      await act({
        type: 'review',
        payload: { missionId: item.id, decision, points, amounts, comment },
      });
      setMessage('レビューを保存しました。');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <section className="review-panel">
      <h3>Ownerレビュー</h3>
      <p>Team申告割合を参考に、最終配分を確定してください。</p>
      <Notice text={message} />
      <AllocationInputs
        item={item}
        values={points}
        setValues={setPoints}
        label="最終ポイント"
        unit="pt"
        total={item.pointValue}
      />
      <div className="private-panel">
        <p>内部総報酬 {yen(reward.totalAmount)}</p>
        <AllocationInputs
          item={item}
          values={amounts}
          setValues={setAmounts}
          label="内部実報酬"
          unit="円"
          total={reward.totalAmount}
        />
      </div>
      <Field label="レビューコメント">
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <div className="panel-actions">
        {item.status !== 'REVIEW' && (
          <Button variant="outline" disabled={busy} onClick={() => send('begin')}>
            レビューを開始
          </Button>
        )}
        <Button variant="outline" disabled={busy || !comment.trim()} onClick={() => send('revise')}>
          修正を依頼
        </Button>
        <Button disabled={busy || !valid} onClick={() => send('approve')}>
          承認して完了
        </Button>
      </div>
    </section>
  );
}
function MissionEditor({ item, done }: { item?: WbsItem; done: () => void }) {
  const { state, user, act, busy } = useStore(),
    parents = state.wbsItems.filter((x) => x.level === 1);
  const [selected, setSelected] = useState(item?.assigneeIds ?? []),
    [deps, setDeps] = useState(item?.dependencyIds ?? []),
    [checklist, setChecklist] = useState(
      item
        ? state.wbsItems
            .filter((c) => c.parentId === item.id)
            .sort((a, b) => a.order - b.order)
            .map((c) => c.title)
        : [],
    ),
    [newSubtask, setNewSubtask] = useState(''),
    [message, setMessage] = useState('');
  const reward = state.rewardPrivate.find((r) => r.id === item?.id);
  const isOwner = user.role === 'OWNER';
  const isTeamEdit = !isOwner && item;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          if (isTeamEdit && !item) throw Error('編集対象がありません。');

          let m: WbsItem;
          if (isTeamEdit) {
            // TEAMメンバーの場合、変更可能なフィールドのみ更新
            m = {
              ...item,
              status: String(f.get('status')) as WbsItem['status'],
              deadline: String(f.get('deadline')),
              startDate: String(f.get('startDate') ?? ''),
              assigneeIds: selected,
              primaryId: selected.length ? String(f.get('primaryId')) : null,
              dependencyIds: deps,
            };
          } else {
            // Ownerの場合、全フィールド設定
            const wbsCode = String(f.get('wbsCode')),
              parts = wbsCode.split('.').map(Number),
              pointValue = Number(f.get('pointValue'));
            integer(pointValue, 'ポイント', 1);
            m = {
              id: item?.id ?? uid(),
              projectId: 'wifi-poc',
              parentId: String(f.get('parentId')),
              wbsCode,
              level: 2,
              title: String(f.get('title')).trim(),
              description: String(f.get('description') ?? ''),
              pointValue,
              status: String(f.get('status')) as WbsItem['status'],
              deadline: String(f.get('deadline')),
              startDate: String(f.get('startDate') ?? ''),
              assigneeIds: selected,
              primaryId: selected.length ? String(f.get('primaryId')) : null,
              dependencyIds: deps,
              autoUnlock: f.get('autoUnlock') === 'on',
              order: item?.order ?? parts[0] * 1000 + parts[1],
              completedAt: null,
              approvedBy: null,
              finalPoints: {},
            };
          }

          await act({
            type: 'mission',
            payload: {
              item: m,
              checklist: isTeamEdit ? [] : checklist,
              totalAmount: isTeamEdit ? 0 : Number(f.get('totalAmount')),
            },
          });
          done();
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <Notice text={message} />
      {!isTeamEdit && (
        <>
          <div className="form-grid">
            <Field label="大工程">
              <select name="parentId" defaultValue={item?.parentId ?? parents[0]?.id}>
                {parents.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.wbsCode} {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="WBS番号">
              <input
                name="wbsCode"
                defaultValue={item?.wbsCode ?? ''}
                placeholder="2.4"
                required
                readOnly={!!item}
              />
            </Field>
          </div>
          <Field label="工程名">
            <input name="title" defaultValue={item?.title ?? ''} required />
          </Field>
          <Field label="説明・達成条件">
            <textarea name="description" defaultValue={item?.description ?? ''} rows={4} />
          </Field>
          <div className="form-grid">
            <Field label="総ポイント">
              <input
                name="pointValue"
                type="number"
                min="1"
                step="1"
                defaultValue={item?.pointValue ?? 50}
                required
              />
            </Field>
            <Field label="内部総報酬（円・Owner専用）">
              <input
                name="totalAmount"
                type="number"
                min="0"
                step="1"
                defaultValue={reward?.totalAmount ?? 5000}
                required
              />
            </Field>
          </div>
        </>
      )}
      <div className="form-grid">
        <Field label="開始日（任意）">
          <input name="startDate" type="date" defaultValue={item?.startDate ?? ''} />
        </Field>
        <Field label="期限">
          <input
            name="deadline"
            type="date"
            defaultValue={item?.deadline ?? '2027-03-31'}
            required
          />
        </Field>
        <Field label="状態">
          <select name="status" defaultValue={item?.status ?? 'OPEN'}>
            {isTeamEdit ? (
              <>
                <option value="ASSIGNED">担当決定</option>
                <option value="IN_PROGRESS">対応中</option>
                <option value="REPORT_SUBMITTED">終了報告済</option>
                <option value="REVISION">修正依頼</option>
                <option value="ON_HOLD">保留</option>
              </>
            ) : (
              <>
                <option value="OPEN">進行可能（依存関係・担当者から判定）</option>
                <option value="ON_HOLD">保留</option>
              </>
            )}
          </select>
        </Field>
      </div>
      <fieldset>
        <legend>担当者（最大6人）</legend>
        {state.users
          .filter((u) => u.active)
          .map((u) => (
            <label className="checklist" key={u.id}>
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                disabled={!selected.includes(u.id) && selected.length >= 6}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, u.id] : selected.filter((id) => id !== u.id),
                  )
                }
              />
              {u.name}
            </label>
          ))}
      </fieldset>
      <Field label="主担当">
        <select
          name="primaryId"
          defaultValue={item?.primaryId ?? selected[0]}
          key={selected.join(',')}
        >
          {selected.map((id) => (
            <option key={id} value={id}>
              {state.users.find((u) => u.id === id)?.name}
            </option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend>前提中工程（先行するWBS番号・最大6件）</legend>
        {state.wbsItems
          .filter((m) => m.level === 2 && m.id !== item?.id && (!item || m.order < item.order))
          .map((m) => (
            <label className="checklist" key={m.id}>
              <input
                type="checkbox"
                checked={deps.includes(m.id)}
                disabled={!deps.includes(m.id) && deps.length >= 6}
                onChange={(e) =>
                  setDeps(e.target.checked ? [...deps, m.id] : deps.filter((id) => id !== m.id))
                }
              />
              {m.wbsCode} {m.title}
            </label>
          ))}
      </fieldset>
      {!isTeamEdit && (
        <>
          <label className="checklist">
            <input name="autoUnlock" type="checkbox" defaultChecked={item?.autoUnlock ?? true} />
            前提完了後に自動でロックを解除
          </label>
          <fieldset>
            <legend>小工程（最大30件）</legend>
            {checklist.map((title, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={title}
                  onChange={(e) =>
                    setChecklist(checklist.map((t, j) => (j === i ? e.target.value : t)))
                  }
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}
                >
                  削除
                </Button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                placeholder="新しい小工程を追加..."
                value={newSubtask}
                disabled={checklist.length >= 30}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newSubtask.trim()) {
                      setChecklist([...checklist, newSubtask.trim()]);
                      setNewSubtask('');
                    }
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!newSubtask.trim() || checklist.length >= 30}
                onClick={() => {
                  if (newSubtask.trim()) {
                    setChecklist([...checklist, newSubtask.trim()]);
                    setNewSubtask('');
                  }
                }}
              >
                追加
              </Button>
            </div>
          </fieldset>
        </>
      )}
      <Button disabled={busy || (!isTeamEdit && !parents.length)}>
        {isTeamEdit ? '変更を保存' : '中工程を保存'}
      </Button>
    </form>
  );
}

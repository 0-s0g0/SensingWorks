'use client';
import { Fragment, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  Search,
  FolderTree,
  Plus,
  Pencil,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  effectiveStatus,
  missionsOf,
  progressOf,
  statusLabels,
  referenceLabels,
  type WbsItem,
} from '@/lib/domain';
import { Badge, Empty, Notice, PageHeading, Progress, Modal, Field } from './ui/primitives';
import { Button } from './ui/button';
import { MissionPanel, People } from './mission-panel';
export function WbsPage() {
  const { state, user, act, busy } = useStore(),
    missions = missionsOf(state),
    phases = state.wbsItems.filter((n) => n.level === 1).sort((a, b) => a.order - b.order);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [selected, setSelected] = useState<string | null>(null),
    [phaseEdit, setPhaseEdit] = useState<WbsItem | null>(null),
    [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    phase: '',
    status: '',
    points: '',
    assignee: '',
  });
  useEffect(() => {
    const read = () => setSelected(decodeURIComponent(window.location.hash.slice(1)) || null);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const open = (id: string) => {
    setSelected(id);
    window.history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  };
  const close = () => {
    setSelected(null);
    window.history.replaceState(null, '', window.location.pathname);
  };
  const allIds = [...phases, ...missions].map((x) => x.id);
  const children = (id: string) =>
    state.wbsItems
      .filter((c) => c.parentId === id && c.level === 3)
      .sort((a, b) => a.order - b.order);
  const toggle = (id: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const change = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setExpanded(new Set(allIds));
  };
  const query = filters.search.trim().toLowerCase(),
    matches = (x: WbsItem) => `${x.wbsCode} ${x.title}`.toLowerCase().includes(query);
  const groups = phases
    .filter((p) => !filters.phase || p.id === filters.phase)
    .map((phase) => {
      const all = missions.filter((m) => m.parentId === phase.id).sort((a, b) => a.order - b.order);
      return {
        phase,
        all,
        visible: all.filter(
          (m) =>
            (!query || matches(phase) || matches(m) || children(m.id).some(matches)) &&
            (!filters.status || effectiveStatus(m, state.wbsItems) === filters.status) &&
            (!filters.points || m.pointValue === Number(filters.points)) &&
            (!filters.assignee ||
              (filters.assignee === 'unassigned'
                ? !m.assigneeIds.length
                : m.assigneeIds.includes(filters.assignee))),
        ),
      };
    })
    .filter(
      (g) =>
        g.visible.length || (!query && !filters.status && !filters.points && !filters.assignee),
    );
  const completed = missions.filter((m) => m.status === 'COMPLETED').length;
  return (
    <>
      <PageHeading
        eyebrow="WORK BREAKDOWN STRUCTURE"
        title="プロジェクトWBS"
        description="工程の構造・担当・進捗を共有し、終了報告と承認までをここで進めます。"
        action={
          user.role === 'OWNER' && (
            <Button onClick={() => open('new')} disabled={!phases.length}>
              <Plus size={16} />
              中工程を追加
            </Button>
          )
        }
      />
      <div className="panel wbs-overview">
        <FolderTree size={24} />
        <div>
          <strong>プロジェクト全体</strong>
          <p>
            {phases.length} 大工程 · {missions.length} 中工程
          </p>
        </div>
        <div className="wbs-total">
          <strong>
            {completed} / {missions.length} 完了
          </strong>
          <Progress value={(completed / Math.max(1, missions.length)) * 100} />
        </div>
      </div>
      <p className="wbs-guide">
        中工程の完了とポイント配分は、終了報告を確認したOwnerが承認します。
      </p>
      <div className="filter-panel wbs-filters">
        <label className="search-input">
          <Search size={18} />
          <input
            aria-label="WBSを検索"
            placeholder="WBS番号・工程名で検索"
            value={filters.search}
            onChange={(e) => change('search', e.target.value)}
          />
        </label>
        <div className="wbs-filter-selects">
          <select
            aria-label="大工程"
            value={filters.phase}
            onChange={(e) => change('phase', e.target.value)}
          >
            <option value="">すべての大工程</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.wbsCode}. {p.title}
              </option>
            ))}
          </select>
          <select
            aria-label="ステータス"
            value={filters.status}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">すべてのステータス</option>
            {Object.entries(statusLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="ポイント"
            value={filters.points}
            onChange={(e) => change('points', e.target.value)}
          >
            <option value="">すべてのポイント</option>
            {[...new Set(missions.map((m) => m.pointValue))]
              .sort((a, b) => a - b)
              .map((v) => (
                <option key={v} value={v}>
                  {v}pt
                </option>
              ))}
          </select>
          <select
            aria-label="担当者"
            value={filters.assignee}
            onChange={(e) => change('assignee', e.target.value)}
          >
            <option value="">すべての担当者</option>
            <option value="unassigned">未担当</option>
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="wbs-toolbar">
        <span>
          {groups.reduce((n, g) => n + g.visible.length, 0)} 中工程を表示
          <small>進捗は絞り込み前の全工程で集計</small>
        </span>
        <div>
          <Button size="sm" variant="outline" onClick={() => setExpanded(new Set(allIds))}>
            すべて展開
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set())}>
            すべて折りたたむ
          </Button>
        </div>
      </div>
      <Notice text={message} />
      {!groups.length ? (
        <Empty
          title="該当する工程がありません"
          description={
            phases.length
              ? '検索条件を変更してください。'
              : 'Ownerの管理画面から初期WBSを登録してください。'
          }
        />
      ) : (
        <div className="panel wbs-tree" role="table" aria-label="プロジェクトWBS">
          <div className="wbs-grid wbs-columns" role="row">
            {['WBS', '工程名', 'ポイント', 'ステータス', '担当', '前提', '進捗', '期限'].map(
              (c) => (
                <div role="columnheader" key={c}>
                  {c}
                </div>
              ),
            )}
          </div>
          {groups.map(({ phase, all, visible }) => {
            const done = all.filter((m) => m.status === 'COMPLETED').length,
              percent = Math.round((done / Math.max(1, all.length)) * 100);
            return (
              <Fragment key={phase.id}>
                <div className="wbs-phase-row" role="row" data-testid={`phase-${phase.wbsCode}`}>
                  <div role="cell" className="wbs-phase-title">
                    <button
                      aria-expanded={expanded.has(phase.id)}
                      aria-label={`${phase.wbsCode} ${phase.title}を開閉`}
                      onClick={() => toggle(phase.id)}
                    >
                      {expanded.has(phase.id) ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                      <span>{phase.wbsCode}.</span>
                      <strong>{phase.title}</strong>
                    </button>
                    {user.role === 'OWNER' && (
                      <button
                        className="icon-button"
                        aria-label={`${phase.wbsCode} 大工程名を編集`}
                        onClick={() => setPhaseEdit(phase)}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                  <div role="cell" className="wbs-phase-progress">
                    <span>
                      {done} / {all.length} 完了
                    </span>
                    <Progress value={percent} />
                    <strong>{percent}%</strong>
                  </div>
                </div>
                {expanded.has(phase.id) &&
                  visible.map((m) => {
                    const steps = children(m.id),
                      progress = progressOf(state, m),
                      status = effectiveStatus(m, state.wbsItems),
                      editable =
                        user.role === 'OWNER' ||
                        (m.assigneeIds.includes(user.id) && status !== 'LOCKED');
                    return (
                      <Fragment key={m.id}>
                        <div
                          className="wbs-grid wbs-mission-row"
                          role="row"
                          data-testid={`mission-${m.wbsCode}`}
                        >
                          <div role="cell" className="wbs-number">
                            <button
                              disabled={!steps.length}
                              aria-expanded={expanded.has(m.id)}
                              aria-label={`${m.wbsCode} 小工程を開閉`}
                              onClick={() => toggle(m.id)}
                            >
                              {expanded.has(m.id) ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                            </button>
                            {m.wbsCode}
                          </div>
                          <div role="cell" className="wbs-title">
                            <button onClick={() => open(m.id)}>{m.title}</button>
                          </div>
                          <div role="cell">
                            <strong className="point-value">{m.pointValue}pt</strong>
                          </div>
                          <div role="cell" className="wbs-status">
                            {status === 'LOCKED' && <LockKeyhole size={14} aria-label="ロック" />}
                            <Badge status={status} />
                          </div>
                          <div role="cell" data-label="担当">
                            <People item={m} />
                          </div>
                          <div role="cell" data-label="前提" className="wbs-prerequisites">
                            {m.dependencyIds.length
                              ? m.dependencyIds.map((id) => {
                                  const d = state.wbsItems.find((x) => x.id === id);
                                  return d ? (
                                    <button key={id} onClick={() => open(id)}>
                                      {d.wbsCode} {d.title}
                                      {d.status === 'COMPLETED' && ' ✓'}
                                    </button>
                                  ) : (
                                    <span key={id}>参照先不明</span>
                                  );
                                })
                              : '—'}
                          </div>
                          <div role="cell" data-label="進捗">
                            小工程 {progress.done} / {progress.total}
                            {progress.total > 0 && (
                              <Progress value={(progress.done / progress.total) * 100} />
                            )}
                          </div>
                          <div role="cell" data-label="期限">
                            {m.deadline}
                          </div>
                        </div>
                        {expanded.has(m.id) &&
                          steps.map((c) => (
                            <div
                              className="wbs-step-row"
                              role="row"
                              key={c.id}
                              data-testid={`step-${c.wbsCode}`}
                            >
                              <div role="cell" className="wbs-step-code">
                                {c.wbsCode}
                              </div>
                              <div role="cell" className="wbs-step-title">
                                {c.title}
                              </div>
                              <div role="cell" className="wbs-step-status">
                                {editable ? (
                                  <select
                                    aria-label={`${c.wbsCode} ステータス`}
                                    value={c.status}
                                    disabled={busy}
                                    onChange={async (e) => {
                                      try {
                                        await act({
                                          type: 'subtask',
                                          payload: { id: c.id, status: e.target.value },
                                        });
                                        setMessage('小工程の進捗を保存しました。');
                                      } catch (e) {
                                        setMessage((e as Error).message);
                                      }
                                    }}
                                  >
                                    {Object.entries(referenceLabels).map(([v, label]) => (
                                      <option key={v} value={v}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  (referenceLabels[c.status as keyof typeof referenceLabels] ??
                                  statusLabels[c.status])
                                )}
                              </div>
                            </div>
                          ))}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </div>
      )}
      {selected && <MissionPanel key={selected} id={selected} close={close} />}
      {phaseEdit && (
        <Modal title="大工程名を編集" close={() => setPhaseEdit(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await act({
                  type: 'phase',
                  payload: { id: phaseEdit.id, title: new FormData(e.currentTarget).get('title') },
                });
                setPhaseEdit(null);
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <Field label="大工程名">
              <input name="title" required defaultValue={phaseEdit.title} />
            </Field>
            <Button disabled={busy}>保存</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

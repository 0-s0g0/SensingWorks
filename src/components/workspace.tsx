'use client';
import { downloadCsv, weeklyCsv } from '@/lib/csv';
import { WeeklyMatrix } from './weekly-matrix';
import { weeklyFields, currentReportWeek, weeklyStart, weeklyEnd } from '@/lib/weekly';
import { LoginHistory } from './login-history';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Download,
  Radio,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  FolderTree,
  FileText,
  CalendarDays,
  Trophy,
  Settings2,
  Menu,
  LogOut,
  CheckCheck,
  Clock3,
  ArrowRight,
} from 'lucide-react';
import { addDays, addWeeks } from 'date-fns';
import { StoreProvider, useStore } from '@/lib/store';
import {
  earnedPoints,
  missionsOf,
  phaseName,
  progressOf,
  effectiveStatus,
  weekOf,
  inWeek,
  yen,
  type WeeklyReport,
  type WbsItem,
} from '@/lib/domain';
import { format, jstDate } from '@/lib/time';
import { loginGoogle, initializeProject, readAccess, saveAccess, updateUser } from '@/lib/firebase';
import { Button } from './ui/button';
import { PageHeading, Avatar, Progress, Badge, Empty, Field, Notice } from './ui/primitives';
import { WbsPage } from './wbs';
import { defaultAccess } from '@/lib/access-config';
import { People } from './mission-panel';
import { AvailabilityPage } from './availability';
const nav = [
  { href: '/', name: 'ホーム', icon: LayoutDashboard },
  { href: '/wbs', name: 'WBS', icon: FolderTree },
  { href: '/reports', name: '週報', icon: FileText },
  { href: '/availability', name: 'MID.予定', icon: CalendarDays },
  { href: '/profile', name: 'マイ実績', icon: Trophy },
];
export function Workspace() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
function Shell() {
  const { state, user, ready, authenticated, demo, error, switchUser, logout } = useStore(),
    pathname = usePathname(),
    path = pathname.replace(/\/$/, '') || '/',
    [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(false), [path]);
  if (!ready)
    return (
      <div className="loading">
        <Radio />
        <p>SensingWorksを準備しています…</p>
      </div>
    );
  if (!authenticated) return <Login error={error} />;
  const navigation =
    user.role === 'OWNER' ? [...nav, { href: '/admin', name: '管理', icon: Settings2 }] : nav;
  const missions = missionsOf(state),
    percent = Math.round(
      (missions.filter((m) => m.status === 'COMPLETED').length / Math.max(1, missions.length)) *
        100,
    );
  let content: ReactNode;
  if (path === '/') content = <Home />;
  else if (path === '/wbs') content = <WbsPage />;
  else if (path === '/reports') content = <ReportsPage />;
  else if (path === '/availability') content = <AvailabilityPage />;
  else if (path === '/profile') content = <ProfilePage />;
  else if (path === '/admin' && user.role === 'OWNER') content = <AdminPage />;
  else
    content = (
      <Empty title="この画面は利用できません" description="サイドバーから画面を選んでください。" />
    );
  return (
    <div className="workspace">
      {mobile && (
        <button
          className="sidebar-shade"
          aria-label="メニューを閉じる"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'visible' : ''}`}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Radio size={23} />
          </span>
          SensingWorks
          <span className="brand-dot" />
        </Link>
        <div className="project-switch">
          <span className="project-icon">
            <Radio size={19} />
          </span>
          <div>
            <strong>{state.projects[0]?.name ?? 'Wi-FiセンシングPoC'}</strong>
            <small>2026.09 — 2027.03</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">{user.role === 'OWNER' ? 'OWNER' : 'TEAM'}</div>
        <nav aria-label="メインナビゲーション">
          {navigation.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? 'active' : ''}>
              <n.icon size={19} />
              {n.name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="project-progress">
            <div>
              <span>プロジェクト進捗</span>
              <strong>{percent}%</strong>
            </div>
            <Progress value={percent} />
            <small>小さな発見を、大きな可能性へ。</small>
          </div>
          <div className="user-panel">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>{user.role === 'OWNER' ? 'プロジェクトオーナー' : 'チームメンバー'}</small>
            </div>
            {!demo && (
              <button className="icon-button" aria-label="ログアウト" onClick={logout}>
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="メニューを開く"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>ワークスペース</span>
            <ChevronRight size={13} />
            <strong>{navigation.find((n) => n.href === path)?.name ?? 'ワークスペース'}</strong>
          </div>
          <div className="top-actions">
            <span className="live-dot" />
            <span className="project-active">チームで研究開発</span>
            {demo && (
              <select
                aria-label="デモユーザー切替"
                value={user.id}
                onChange={(e) => switchUser(e.target.value)}
              >
                {state.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} / {u.role === 'OWNER' ? 'Owner' : 'Team'}
                  </option>
                ))}
              </select>
            )}
            <Avatar name={user.name} small />
          </div>
        </header>
        {demo && (
          <div className="demo-strip">
            デモモード <span>変更はこのブラウザに保存されます。実データとは接続していません。</span>
          </div>
        )}
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <main>{content}</main>
        <footer>
          SensingWorks <span>TEAM RESEARCH, SHARED DISCOVERY.</span>
          <span>Wi-FiセンシングPoC · 2026–2027</span>
        </footer>
      </div>
    </div>
  );
}
function Login({ error }: { error: string }) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <Radio />
          SensingWorks
        </div>
        <h1>チームのワークスペースへ</h1>
        <p>許可されたGoogle WorkspaceまたはGoogleアカウントでログインしてください。</p>
        <Notice text={message || error} />
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await loginGoogle();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Googleでログイン
        </Button>
      </div>
    </div>
  );
}
function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="panel compact-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function MissionTable({ items }: { items: WbsItem[] }) {
  const { state } = useStore();
  return items.length ? (
    <div className="panel work-table">
      <div className="work-row work-head">
        <span>WBS / 中工程</span>
        <span>状態</span>
        <span>ポイント</span>
        <span>担当</span>
        <span>期限 / 小工程</span>
      </div>
      {items.map((m) => {
        const p = progressOf(state, m);
        return (
          <div className="work-row" key={m.id}>
            <div>
              <Link className="work-title" href={`/wbs/#${m.id}`}>
                <small>{m.wbsCode}</small>
                <strong>{m.title}</strong>
              </Link>
              <p className="muted">{phaseName(state, m)}</p>
            </div>
            <Badge status={effectiveStatus(m, state.wbsItems)} />
            <strong className="point-value">{m.pointValue}pt</strong>
            <People item={m} />
            <div>
              {m.deadline}
              <p>
                小工程 {p.done} / {p.total}
              </p>
              <Progress value={(p.done / Math.max(1, p.total)) * 100} />
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <Empty
      title="現在の担当ミッションはありません"
      description="担当が決まると、ここに表示されます。"
    />
  );
}
function Home() {
  const { state, user } = useStore(),
    mine = missionsOf(state).filter(
      (m) => m.assigneeIds.includes(user.id) && m.status !== 'COMPLETED',
    ),
    week = currentReportWeek(),
    report = state.weeklyReports.find((r) => r.userId === user.id && r.weekStart === week),
    done = missionsOf(state).filter(
      (m) => m.assigneeIds.includes(user.id) && inWeek(m.completedAt),
    ),
    upcoming = state.availability
      .filter(
        (a) =>
          a.userId === user.id &&
          a.date >= format(new Date(), 'yyyy-MM-dd') &&
          a.status === 'AVAILABLE',
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour)
      .slice(0, 5);
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title={`おかえりなさい、${user.name.split(' ')[0]}さん`}
        description="自分の現在の仕事と、チームの進み具合を確認しましょう。"
      />
      <p className="muted" aria-label="自分の進捗サマリー">
        累計 <strong>{earnedPoints(state, user.id)}pt</strong> · 担当中 {mine.length}件 · 今週の完了{' '}
        {done.length}件
      </p>
      <div className="section-title">
        <h2>自分の担当ミッション</h2>
        <Link href="/wbs">
          全体をWBSで確認 <ArrowRight size={14} />
        </Link>
      </div>
      <MissionTable items={mine} />
      <div className="home-summary-grid">
        <section className="panel detail-section">
          <h2>週報</h2>
          <p>
            {format(week, 'M月d日')}の週：
            {report?.status === 'SUBMITTED' ? '提出済み' : report ? '下書き保存済み' : '未提出'}
          </p>
          <Link className="text-link" href="/reports">
            週報を開く →
          </Link>
        </section>
        <section className="panel detail-section">
          <h2>MID. 直近の参加可能予定</h2>
          {upcoming.length ? (
            upcoming.map((a) => (
              <p key={a.id}>
                {format(a.date, 'M/d')} {a.hour}:00〜{a.hour + 1}:00 ○
              </p>
            ))
          ) : (
            <p>直近の参加可能予定は未登録です。</p>
          )}
          <Link className="text-link" href="/availability">
            予定を確認・編集 →
          </Link>
        </section>
      </div>
    </>
  );
}
function ReportsPage() {
  const { state, user } = useStore(),
    [week, setWeek] = useState(currentReportWeek),
    [person, setPerson] = useState(user.id);
  const report = state.weeklyReports.find((r) => r.userId === person && r.weekStart === week);
  const done = missionsOf(state).filter(
      (m) => m.assigneeIds.includes(person) && inWeek(m.completedAt, week),
    ),
    submitted = state.completionReports.filter(
      (r) =>
        inWeek(r.submittedAt, week) &&
        state.wbsItems.some((m) => m.id === r.missionId && m.assigneeIds.includes(person)),
    );
  return (
    <>
      <PageHeading
        eyebrow="WEEKLY REFLECTION"
        title="週報"
        action={
          <Button
            variant="outline"
            title="表示中のメンバー・週の保存済み内容を出力します。編集中の内容は先に保存してください。"
            onClick={() =>
              downloadCsv(
                `SensingWorks-weekly-${week}.csv`,
                weeklyCsv(state, { userId: person, week }),
              )
            }
          >
            <Download size={16} />
            保存済み週報をCSV出力
          </Button>
        }
        description="週の振り返りをチームで共有します。編集できるのは本人だけです。"
      />
      <div className="filter-panel report-filters">
        <Button
          variant="outline"
          disabled={week <= weeklyStart}
          onClick={() => setWeek(format(addWeeks(jstDate(week), -1), 'yyyy-MM-dd'))}
        >
          前の週
        </Button>
        <strong>
          {week} 〜 {format(addDays(jstDate(week), 6), 'yyyy-MM-dd')}
        </strong>
        <Button
          variant="outline"
          disabled={week >= weeklyEnd}
          onClick={() => setWeek(format(addWeeks(jstDate(week), 1), 'yyyy-MM-dd'))}
        >
          次の週
        </Button>
        <select
          aria-label="週報のメンバー"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        >
          {state.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="home-summary-grid">
        <section className="panel detail-section">
          {person === user.id ? (
            <WeeklyEditor key={`${week}-${person}`} week={week} report={report} />
          ) : (
            <>
              <h2>{state.users.find((u) => u.id === person)?.name}の週報</h2>
              <p>{report?.status === 'SUBMITTED' ? '提出済み' : report ? '下書き' : '未提出'}</p>
              {report ? (
                weeklyFields.map(([key, label]) => (
                  <div className="report-read" key={key}>
                    <h3>{label}</h3>
                    <p className="prewrap">{report[key] || '—'}</p>
                  </div>
                ))
              ) : (
                <p>この週の週報はまだありません。</p>
              )}
            </>
          )}
        </section>
        <aside className="panel detail-section">
          <h2>今週の記録</h2>
          <h3>完了した担当ミッション</h3>
          {done.length ? (
            done.map((m) => (
              <p key={m.id}>
                <Link href={`/wbs/#${m.id}`}>
                  {m.wbsCode} {m.title}
                </Link>
              </p>
            ))
          ) : (
            <p>まだありません。</p>
          )}
          <h3>提出した終了報告</h3>
          {submitted.length ? (
            submitted.map((r) => (
              <p key={r.id}>
                <Link href={`/wbs/#${r.missionId}`}>
                  {state.wbsItems.find((m) => m.id === r.missionId)?.title}
                </Link>
              </p>
            ))
          ) : (
            <p>まだありません。</p>
          )}
        </aside>
      </div>
    </>
  );
}
function WeeklyEditor({ week, report }: { week: string; report?: WeeklyReport }) {
  const { act, busy, user } = useStore(),
    [message, setMessage] = useState(''),
    [errors, setErrors] = useState<string[]>([]);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const submit = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'submit';
        try {
          const fields = Object.fromEntries(
            weeklyFields.map(([k]) => [k, String(f.get(k) ?? '')]),
          ) as Pick<WeeklyReport, (typeof weeklyFields)[number][0]>;
          const missing = submit
            ? weeklyFields
                .slice(0, 3)
                .filter(([k]) => !fields[k].trim())
                .map(([k]) => k)
            : [];
          setErrors(missing);
          if (missing.length) {
            setMessage('必須の3項目を入力してください。');
            const input = e.currentTarget.elements.namedItem(missing[0]) as HTMLTextAreaElement;
            input.focus();
            return;
          }
          await act({
            type: 'report',
            payload: {
              report: {
                ...fields,
                id: '',
                userId: user.id,
                weekStart: week,
                status: submit ? 'SUBMITTED' : 'DRAFT',
                updatedAt: '',
              },
            },
          });
          setMessage(submit ? '週報を提出しました。' : '下書きを保存しました。');
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h2>自分の週報</h2>
      <p>締切：{format(week, 'yyyy/MM/dd')}（月）23:59（日本時間）。締切後も提出・修正できます。</p>
      <p>{report?.status === 'SUBMITTED' ? '提出済み' : report ? '下書き保存済み' : '未提出'}</p>
      {weeklyFields.map(([key, label], i) => (
        <label className="field" key={key}>
          <span>
            {label}
            {i < 3 && (
              <span className="required-mark" aria-hidden="true">
                {' '}
                ＊
              </span>
            )}
          </span>
          <textarea
            name={key}
            aria-label={label}
            aria-required={i < 3}
            aria-invalid={errors.includes(key)}
            aria-describedby={errors.includes(key) ? `weekly-error-${key}` : undefined}
            defaultValue={report?.[key] ?? ''}
            rows={4}
            onChange={(e) => {
              if (e.target.value.trim()) setErrors((old) => old.filter((k) => k !== key));
            }}
          />
          {errors.includes(key) && (
            <span id={`weekly-error-${key}`} className="field-error" role="alert">
              {label}を入力してください。
            </span>
          )}
        </label>
      ))}
      <Notice text={message} />
      <div className="panel-actions">
        <Button type="submit" value="draft" variant="outline" disabled={busy}>
          下書き保存
        </Button>
        <Button type="submit" value="submit" disabled={busy}>
          週報を提出
        </Button>
      </div>
    </form>
  );
}
function ProfilePage() {
  const { state, user } = useStore(),
    [person, setPerson] = useState(user.id),
    awards = state.pointAwards.filter((a) => a.userId === person),
    done = missionsOf(state).filter(
      (m) => m.status === 'COMPLETED' && m.assigneeIds.includes(person),
    );
  return (
    <>
      <PageHeading
        eyebrow="TEAM CONTRIBUTIONS"
        title="積み重ねた、チームの成果。"
        description="全メンバーの累計ポイントと担当実績を確認できます。"
      />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>メンバー</th>
              <th>累計獲得ポイント</th>
              <th>完了ミッション</th>
              <th>主担当件数</th>
              <th>共同担当件数</th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => {
              const all = missionsOf(state).filter((m) => m.assigneeIds.includes(u.id));
              return (
                <tr key={u.id}>
                  <td>
                    <button className="text-link" onClick={() => setPerson(u.id)}>
                      {u.name}
                    </button>
                  </td>
                  <td>
                    <strong>{earnedPoints(state, u.id)}pt</strong>
                  </td>
                  <td>{all.filter((m) => m.status === 'COMPLETED').length}</td>
                  <td>{all.filter((m) => m.primaryId === u.id).length}</td>
                  <td>{all.filter((m) => m.primaryId !== u.id).length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="panel detail-section">
        <h2>{state.users.find((u) => u.id === person)?.name}の確定ポイント</h2>
        <p>
          累計 {earnedPoints(state, person)}pt · 完了 {done.length}件
        </p>
        {awards.length ? (
          awards.map((a) => {
            const m = state.wbsItems.find((m) => m.id === a.missionId);
            return (
              <div className="award-row" key={a.id}>
                <Link href={`/wbs/#${a.missionId}`}>
                  {m?.wbsCode} {m?.title}
                </Link>
                <strong>{a.points}pt</strong>
                <span>{format(a.awardedAt, 'yyyy/MM/dd')}</span>
              </div>
            );
          })
        ) : (
          <p>承認済みのポイントはまだありません。</p>
        )}
      </section>
    </>
  );
}
function AdminPage() {
  const { state, user, demo, act, busy } = useStore(),
    [message, setMessage] = useState(''),
    [domains, setDomains] = useState(defaultAccess.allowedDomains.join('\n')),
    [emails, setEmails] = useState('');
  useEffect(() => {
    if (!demo)
      readAccess()
        .then((c) => {
          setDomains(c.allowedDomains.join('\n'));
          setEmails(c.allowedEmails.join('\n'));
        })
        .catch((e) => setMessage(e.message));
  }, [demo]);
  const waiting = missionsOf(state).filter((m) =>
    ['REPORT_SUBMITTED', 'REVIEW'].includes(m.status),
  );
  return (
    <>
      <PageHeading
        eyebrow="OWNER MANAGEMENT"
        title="管理"
        description="終了報告のレビュー、内部報酬、利用アカウントを管理します。"
      />
      <Notice text={message} />
      <WeeklyMatrix />
      <LoginHistory />
      {missionsOf(state).length < 24 && (
        <section className="panel detail-section">
          <h2>プロジェクトの初期設定</h2>
          <p>
            8大工程と24中工程のたたき台を登録します。既存の工程は保持し、未登録分のみ追加します。架空の実績は登録しません。
          </p>
          <Button
            disabled={busy || demo}
            onClick={() =>
              initializeProject()
                .then(() => setMessage('初期WBSを登録しました。'))
                .catch((e) => setMessage(e.message))
            }
          >
            初期WBSを登録
          </Button>
        </section>
      )}
      <section>
        <h2>レビュー待ち {waiting.length}件</h2>
        <MissionTable items={waiting} />
      </section>
      <section className="panel detail-section">
        <h2>Owner専用・内部報酬</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>中工程</th>
                <th>総ポイント</th>
                <th>内部総報酬</th>
                <th>内部実報酬配分</th>
                <th>支払状態</th>
              </tr>
            </thead>
            <tbody>
              {state.rewardPrivate.map((r) => {
                const m = state.wbsItems.find((m) => m.id === r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/wbs/#${r.id}`}>
                        {m?.wbsCode} {m?.title}
                      </Link>
                    </td>
                    <td>{m?.pointValue}pt</td>
                    <td>{yen(r.totalAmount)}</td>
                    <td>
                      {Object.entries(r.allocations).map(([id, amount]) => (
                        <p key={id}>
                          {state.users.find((u) => u.id === id)?.name} {yen(amount)}
                        </p>
                      ))}
                    </td>
                    <td>
                      {r.paymentStatus === 'PAID' ? (
                        '支払済み'
                      ) : r.paymentStatus === 'DRAFT' ? (
                        '未確定'
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            act({ type: 'paid', payload: { id: r.id } }).catch((e) =>
                              setMessage(e.message),
                            )
                          }
                        >
                          支払済みにする
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel detail-section">
        <h2>Googleアカウントの利用許可</h2>
        <p>許可ドメインに属するアカウント、または個別許可アカウントが参加できます。</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (demo) throw Error('デモでは変更できません。Firebase接続後に設定できます。');
              const lines = (v: string) =>
                v
                  .split(/\s+/)
                  .map((x) => x.trim().toLowerCase())
                  .filter(Boolean);
              await saveAccess(lines(domains), lines(emails));
              setMessage('利用許可を保存しました。');
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <div className="form-grid">
            <Field label="許可ドメイン（1行1件）">
              <textarea
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="example.ac.jp"
              />
            </Field>
            <Field label="個別許可メールアドレス（1行1件）">
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="member@gmail.com"
              />
            </Field>
          </div>
          <Button disabled={demo}>利用許可を保存</Button>
        </form>
        <p className="help-text">
          許可リストは新規参加を制御します。既存ユーザーを停止する場合は、下の利用状態を無効にしてください。
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>メンバー</th>
                <th>ロール</th>
                <th>利用状態</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>
                    <select
                      aria-label={`${u.name} ロール`}
                      disabled={demo || u.id === user.id}
                      value={u.role}
                      onChange={(e) =>
                        updateUser(u.id, {
                          role: e.target.value as 'TEAM' | 'OWNER',
                          active: u.active,
                        }).catch((e) => setMessage(e.message))
                      }
                    >
                      <option>TEAM</option>
                      <option>OWNER</option>
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${u.name} 利用状態`}
                      disabled={demo || u.id === user.id}
                      value={String(u.active)}
                      onChange={(e) =>
                        updateUser(u.id, { role: u.role, active: e.target.value === 'true' }).catch(
                          (e) => setMessage(e.message),
                        )
                      }
                    >
                      <option value="true">有効</option>
                      <option value="false">無効</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

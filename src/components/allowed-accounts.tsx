'use client';
import { useEffect, useState } from 'react';
import { subscribeLoginSessions, type LoginSession } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import { Button } from './ui/button';
import { Notice } from './ui/primitives';

export function AllowedAccounts({
  emails,
  loaded,
  busy,
  onRemove,
}: {
  emails: string[];
  loaded: boolean;
  busy: boolean;
  onRemove: (email: string) => Promise<void>;
}) {
  const { state, demo } = useStore();
  const [sessions, setSessions] = useState<LoginSession[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (demo) return;
    // Use all recorded logins: the latest 100 can omit an infrequent member.
    return subscribeLoginSessions(
      (rows) => {
        setSessions(rows);
        setError('');
      },
      setError,
      true,
    );
  }, [demo]);
  const rows = [...new Set(emails.map((email) => email.trim().toLowerCase()))].map((email) => {
    const session = sessions?.find((s) => s.email.toLowerCase() === email);
    const member = session && state.users.find((u) => u.id === session.userId);
    return { email, member, session };
  });
  return (
    <div>
      <h3>個別許可メール一覧</h3>
      <p className="help-text">
        保存済みのメールアドレスを表示します。上の追加ボタンで複数人を登録できます。招待メールは自動送信されません。
      </p>
      <Notice text={error} />
      {demo ? (
        <p>Firebase接続後に利用できます。</p>
      ) : !loaded ? (
        <p>利用許可を読み込み中です。読み込めない場合は管理画面を開き直してください。</p>
      ) : !rows.length ? (
        <p>個別許可メールはまだ登録されていません。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>個別許可メール</th>
                <th>状態</th>
                <th>メンバー</th>
                <th>権限</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ email, member, session }) => (
                <tr key={email}>
                  <td style={{ overflowWrap: 'anywhere' }}>{email}</td>
                  <td>
                    {error ? (
                      '確認できません'
                    ) : sessions === null ? (
                      '確認中…'
                    ) : member ? (
                      <span className={`badge status-${member.active ? 'completed' : 'on_hold'}`}>
                        {member.active ? '登録済み' : '無効'}
                      </span>
                    ) : session ? (
                      '登録情報なし'
                    ) : (
                      <span className="badge status-open">ログイン待ち</span>
                    )}
                  </td>
                  <td>{member?.name ?? '—'}</td>
                  <td>{member?.role ?? '—'}</td>
                  <td>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || demo}
                      aria-label={`${email} の個別許可を削除`}
                      onClick={() => void onRemove(email)}
                    >
                      許可を削除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="help-text">
        状態はアプリのログイン履歴と登録情報を照合しています。履歴のないアカウントはログイン待ちとして表示します。許可ドメイン経由の参加者は下のメンバー一覧で確認できます。
      </p>
    </div>
  );
}

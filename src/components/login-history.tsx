'use client';
import { AccordionCard } from './ui/accordion-card';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { subscribeLoginSessions, type LoginSession } from '@/lib/firebase';
import { format } from '@/lib/time';
import { Notice } from './ui/primitives';
export function LoginHistory() {
  const { state, demo } = useStore();
  const [rows, setRows] = useState<LoginSession[]>([]);
  const [error, setError] = useState('');
  useEffect(() => (demo ? undefined : subscribeLoginSessions(setRows, setError)), [demo]);
  return (
    <AccordionCard title="セッション管理・ログイン履歴">
      <p>直近100件のGoogleログインを表示します。日時は日本時間です。</p>
      <p className="muted">ログイン履歴であり、現在オンラインかどうかを示すものではありません。</p>
      <Notice text={error} />
      {demo ? (
        <p>デモモードでは実際のログイン履歴は記録されません。</p>
      ) : !rows.length ? (
        <p>ログイン履歴はまだありません。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>メンバー</th>
                <th>Googleアカウント</th>
                <th>ログイン日時</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{state.users.find((u) => u.id === row.userId)?.name ?? row.userId}</td>
                  <td>{row.email}</td>
                  <td>{format(new Date(row.authTime * 1000), 'yyyy/MM/dd HH:mm:ss')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccordionCard>
  );
}

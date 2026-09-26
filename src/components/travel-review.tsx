'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { yen } from '@/lib/domain';
import { travelStatusLabels, travelTotal } from '@/lib/travel';
import { format } from '@/lib/time';
import { Modal, Notice } from './ui/primitives';
import { Button } from './ui/button';

export function TravelReview({ claimId, close }: { claimId: string; close: () => void }) {
  const { state, user, act, busy } = useStore();
  const [message, setMessage] = useState('');
  const claim = state.travelClaims.find((c) => c.id === claimId);
  if (!claim) return null;
  const name = state.users.find((u) => u.id === claim.userId)?.name ?? 'メンバー';
  async function review(status: 'APPROVED' | 'REJECTED') {
    setMessage('');
    try {
      await act({ type: 'travelReview', payload: { id: claimId, status } });
      close();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <Modal title={`${name} · ${claim.date}の交通費`} close={close}>
      <p>状態：{travelStatusLabels[claim.status]}</p>
      <p>
        {claim.departure} → {claim.arrival}（{claim.trip === 'ROUND_TRIP' ? '往復' : '片道'}）
      </p>
      <p>
        バス片道 {yen(claim.busFare)} / 電車片道 {yen(claim.trainFare)} / 駐車場{' '}
        {yen(claim.parkingFee)}
      </p>
      <p>
        <strong>合計：{yen(travelTotal(claim))}</strong>
      </p>
      {claim.reviewedAt && (
        <p>
          審査：{state.users.find((u) => u.id === claim.reviewedBy)?.name ?? claim.reviewedBy} ·{' '}
          {format(claim.reviewedAt, 'yyyy/M/d HH:mm')}
        </p>
      )}
      {claim.status === 'SUBMITTED' &&
        (user.role === 'ADMIN' ? (
          <>
            <p>
              この日の来訪と申請内容を確認して、承認または不承認を選んでください。承認済みの交通費のみ精算に集計します。
            </p>
            <div className="form-actions">
              <Button disabled={busy} variant="outline" onClick={() => void review('REJECTED')}>
                不承認
              </Button>
              <Button disabled={busy} onClick={() => void review('APPROVED')}>
                承認
              </Button>
            </div>
          </>
        ) : (
          <p>ADMINによる承認待ちです。</p>
        ))}
      <Notice text={message} />
    </Modal>
  );
}

'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { WbsItem } from '@/lib/domain';
import { useStore } from '@/lib/store';
import { Modal, Field, Notice } from './ui/primitives';
import { Button } from './ui/button';
export function SubtaskEditButton({ item }: { item: WbsItem }) {
  const { act, busy } = useStore();
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState('');
  return (
    <>
      <button
        className="icon-button"
        aria-label={`${item.wbsCode} 小工程を編集`}
        onClick={() => {
          setMessage('');
          setOpen(true);
        }}
      >
        <Pencil size={14} />
      </button>
      {open && (
        <Modal title={`${item.wbsCode} 小工程を編集`} close={() => setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await act({
                  type: 'subtask',
                  payload: {
                    id: item.id,
                    operation: 'rename',
                    title: new FormData(e.currentTarget).get('title'),
                  },
                });
                setOpen(false);
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <Field label="小工程名">
              <input name="title" defaultValue={item.title} required autoFocus />
            </Field>
            <Notice text={message} />
            <Button disabled={busy}>保存</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

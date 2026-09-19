'use client';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, FolderGit2, X } from 'lucide-react';
import { Status, statusLabels } from '@/lib/domain';
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  caption,
  href,
  link = 'すべて見る',
}: {
  title: string;
  caption?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {caption && <p>{caption}</p>}
      </div>
      {href && (
        <Link href={href}>
          {link}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar ${small ? 'small' : ''}`}>{name.replace(/\s/g, '').slice(0, 1)}</span>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress-track">
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <span />
      {statusLabels[status]}
    </span>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <FolderGit2 size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Notice({ text }: { text: string }) {
  return text ? (
    <div className="notice" role="status">
      {text}
    </div>
  ) : null;
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={close}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}

'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function AccordionCard({
  title,
  children,
  className = '',
  collapsible = true,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  if (!collapsible) {
    return (
      <section className={`panel detail-section ${className}`}>
        <h2>{title}</h2>
        {children}
      </section>
    );
  }
  return (
    <section className={`panel detail-section accordion-card ${className}`}>
      <h2 className="accordion-heading">
        <button
          type="button"
          id={`${id}-heading`}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen(!open)}
        >
          <span>{title}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </h2>
      <div
        className="accordion-body"
        id={`${id}-body`}
        aria-labelledby={`${id}-heading`}
        hidden={!open}
      >
        {children}
      </div>
    </section>
  );
}

'use client';

import { useEffect } from 'react';

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-none tracking-wide text-ink">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'plain' }: { label: string; value: string; hint?: string; tone?: 'plain' | 'warn' | 'good' }) {
  const color = tone === 'warn' ? 'text-warn' : tone === 'good' ? 'text-brand-dark' : 'text-ink';
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`num mt-1 font-display text-4xl leading-none ${color}`}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}

type Tone = 'brand' | 'warn' | 'alert' | 'good' | 'gray';
const TONES: Record<Tone, string> = {
  brand: 'bg-brand-light text-brand-deep',
  warn: 'bg-warn-light text-warn',
  alert: 'bg-alert-light text-alert',
  good: 'bg-good-light text-good',
  gray: 'bg-paper text-ink-soft',
};

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function Bar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'warn' | 'gray' }) {
  const w = max === 0 ? 0 : Math.max(2, Math.round((value / max) * 100));
  const bg = tone === 'warn' ? 'bg-warn' : tone === 'gray' ? 'bg-ink-faint' : 'bg-brand';
  return (
    <div className="h-2 w-full rounded-full bg-paper">
      <div className={`h-2 rounded-full ${bg}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside role="dialog" aria-label={title} className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-2xl leading-tight tracking-wide">{title}</h2>
          <button onClick={onClose} className="btn-ghost px-2 py-1">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm text-ink-soft">
      <span className="num">Page {page + 1} of {pages}</span>
      <div className="flex gap-2">
        <button className="btn-ghost py-1" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn-ghost py-1" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

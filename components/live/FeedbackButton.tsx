'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { churchLabel } from '@/lib/live/match';
import { useLive } from '@/lib/live/store';
import { FEEDBACK_KINDS, personName, type FeedbackKind } from '@/lib/live/types';

/**
 * The Feedback button: always in the bottom corner of every Live tool page.
 * It sends what the person typed along with where they were when they typed
 * it, so nobody has to explain which screen they meant.
 */
export function FeedbackButton() {
  const path = usePathname();
  const { people, families, churches, sendFeedback } = useLive();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('Idea');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);

  // What this page is showing, in words: "Families" or "Family: Rivera family".
  const here = (): string => {
    const [, , section, id] = path.split('/');
    const lists: Record<string, string> = { people: 'People', families: 'Families', churches: 'Churches', experience: 'Experience follow-up', review: 'Data check', users: 'Users', account: 'Your account', feedback: 'Feedback' };
    if (!id) return lists[section] ?? 'Live tool';
    if (section === 'people') return `Person: ${personName(people.find((x) => x.id === id)) || 'unknown'}`;
    if (section === 'families') return `Family: ${families.find((x) => x.id === id)?.name ?? 'unknown'}`;
    const c = churches.find((x) => x.id === id);
    return `Church: ${c ? churchLabel(c) : 'unknown'}`;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await sendFeedback({ kind, message, pagePath: `${path}${window.location.search}`, pageLabel: here() });
    setBusy(false);
    if (!ok) return;
    setMessage('');
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 1800);
  }

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div role="dialog" aria-label="Send feedback" className="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-white p-4 shadow-2xl">
          {sent ? (
            <p role="status" className="py-6 text-center text-sm font-semibold text-good">Thank you. That has been sent.</p>
          ) : (
            <form onSubmit={submit}>
              <h2 className="font-display text-2xl leading-none tracking-wide">Feedback</h2>
              <p className="mt-1 text-xs text-ink-soft">Anything that is confusing, missing, wrong or would make this easier. It goes to Zane with a note of the page you are on: <span className="font-semibold text-ink">{here()}</span>.</p>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="What kind of feedback">
                {FEEDBACK_KINDS.map((k) => (
                  <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${kind === k ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}>
                    {k}
                  </button>
                ))}
              </div>
              <label htmlFor="fb-message" className="label mt-3">What would you like to say?</label>
              <textarea id="fb-message" autoFocus className="field" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button type="submit" className="btn-primary flex-1" disabled={busy || !message.trim()}>{busy ? 'Sending…' : 'Send'}</button>
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
      <button
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-ink px-4 py-2.5 font-display text-lg tracking-wider text-white shadow-lg ring-2 ring-white hover:bg-brand-dark"
      >
        {open ? 'Close' : 'Feedback'}
      </button>
    </div>
  );
}

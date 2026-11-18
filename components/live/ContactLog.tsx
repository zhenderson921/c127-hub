'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui';
import { useLive } from '@/lib/live/store';
import { METHODS, type Interaction, type Method } from '@/lib/live/types';
import { ago, fmtDateLong } from '@/lib/util';

/** Methods where you did not actually speak with anyone. */
const NOT_REACHED: Method[] = ['Voicemail'];

/**
 * The one contact log. A contact is typed once here and shows on the family or
 * church it is about, in place of the monthly spreadsheet columns.
 */
export function ContactLog({ about, entries }: { about: { familyId?: string; churchId?: string }; entries: Interaction[] }) {
  const { logContact, userNames } = useLive();
  const [method, setMethod] = useState<Method>('Call');
  const [reached, setReached] = useState(true);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await logContact({ ...about, method, reached, summary });
    setBusy(false);
    if (ok) setSummary('');
  }

  const shown = all ? entries : entries.slice(0, 5);
  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold">Contact log</h3>
      <form onSubmit={submit} className="mt-2 rounded-md border border-line bg-paper p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="cl-method" className="label">How</label>
            <select
              id="cl-method"
              className="field"
              value={method}
              onChange={(e) => {
                const m = e.target.value as Method;
                setMethod(m);
                setReached(!NOT_REACHED.includes(m));
              }}
            >
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={reached} onChange={(e) => setReached(e.target.checked)} />
            We connected
          </label>
        </div>
        <label htmlFor="cl-note" className="label mt-2">What happened</label>
        <textarea id="cl-note" className="field" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="A sentence or two is plenty" />
        <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">{busy ? 'Saving…' : 'Log this contact'}</button>
      </form>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Nothing logged yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {shown.map((i) => (
            <li key={i.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {i.method} <span className="font-normal text-ink-soft" title={fmtDateLong(new Date(i.at).getTime())}>· {ago(new Date(i.at).getTime())}</span>
                </span>
                {!i.reached && <Badge tone="warn">No answer yet</Badge>}
              </div>
              {i.summary && <p className="mt-0.5 whitespace-pre-wrap text-ink">{i.summary}</p>}
              {i.loggedBy && userNames[i.loggedBy] && <p className="mt-0.5 text-xs text-ink-soft">Logged by {userNames[i.loggedBy]}</p>}
            </li>
          ))}
        </ul>
      )}
      {entries.length > 5 && (
        <button className="mt-1 text-xs font-semibold text-brand-dark underline" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  );
}

/** The most recent time someone actually connected, and the most recent attempt. */
export function lastContact(entries: Interaction[]): { reached: number | null; attempt: number | null } {
  let reached: number | null = null;
  let attempt: number | null = null;
  for (const i of entries) {
    const t = new Date(i.at).getTime();
    if (attempt === null || t > attempt) attempt = t;
    if (i.reached && (reached === null || t > reached)) reached = t;
  }
  return { reached, attempt };
}

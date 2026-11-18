'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { useLive } from '@/lib/live/store';
import { supabaseBrowser } from '@/lib/supabase';
import { ago, fmtDateLong, num } from '@/lib/util';

// History: every change made in the hub, newest first, with who made it.
// Things done in one go (joining two people, matching a church name, a
// spreadsheet load) are shown as one change. An admin can put a change back.

interface Entry {
  id: number;
  at: string;
  who: string;
  batch: number;
  table: string;
  action: 'insert' | 'update' | 'delete';
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  undoes: number | null;
}
interface Change {
  batch: number;
  at: number;
  who: string;
  entries: Entry[];
  undoes: number | null;
}

const THING: Record<string, [string, string]> = {
  churches: ['church', 'churches'], church_aliases: ['church name spelling', 'church name spellings'], people: ['person', 'people'], person_roles: ['role', 'roles'],
  advocate_onboarding: ['advocate record', 'advocate records'], families: ['family', 'families'], family_members: ['family link', 'family links'], children: ['child', 'children'],
  care_communities: ['Care Community', 'Care Communities'], interactions: ['contact log entry', 'contact log entries'], tasks: ['follow-up', 'follow-ups'],
  vce_responses: ["guest's answer", "guests' answers"], visits: ['visit', 'visits'], next_step_options: ['follow-up rule', 'follow-up rules'], coaches: ['staff member', 'staff members'],
};
const VERB = { insert: 'Added', update: 'Changed', delete: 'Removed' } as const;
// Fields that change on their own and would only be noise in a list of what changed.
const QUIET = new Set(['created_at', 'done_at', 'done_by', 'resolved_at', 'lat', 'lng', 'id']);
const PAGE = 800;

/** A name for the record an entry is about, from whatever it has. */
function nameOf(e: Entry): string {
  const r = e.new ?? e.old ?? {};
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
  return s('name') || `${s('first_name')} ${s('last_name')}`.trim() || s('alias') || s('title') || s('label') || s('summary').slice(0, 60) || s('role') || '';
}
const show = (v: unknown): string => (v === null || v === undefined || v === '' ? 'blank' : Array.isArray(v) ? v.join(', ') || 'none' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v).slice(0, 80));
const field = (k: string) => k.replace(/_id$/, '').replace(/_on$/, ' date').replace(/_/g, ' ');

function diff(e: Entry): { key: string; from: string; to: string }[] {
  if (e.action !== 'update' || !e.old || !e.new) return [];
  return Object.keys(e.old)
    .filter((k) => !QUIET.has(k) && JSON.stringify(e.old![k]) !== JSON.stringify(e.new![k]))
    .map((k) => ({ key: field(k), from: show(e.old![k]), to: show(e.new![k]) }));
}

/** One line saying what a change did. */
function summarise(c: Change): string {
  if (c.entries.length === 1) {
    const e = c.entries[0];
    const [one] = THING[e.table] ?? [e.table];
    const n = nameOf(e);
    return `${VERB[e.action]} ${one === 'Care Community' ? 'a' : /^[aeiou]/i.test(one) ? 'an' : 'a'} ${one}${n ? `: ${n}` : ''}`;
  }
  const groups = new Map<string, number>();
  for (const e of c.entries) groups.set(`${e.action}|${e.table}`, (groups.get(`${e.action}|${e.table}`) ?? 0) + 1);
  return [...groups]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => {
      const [action, table] = k.split('|') as [Entry['action'], string];
      const [one, many] = THING[table] ?? [table, table];
      return `${VERB[action].toLowerCase()} ${num(n)} ${n === 1 ? one : many}`;
    })
    .join(', ')
    .replace(/^./, (ch) => ch.toUpperCase());
}

export default function HistoryPage() {
  const { profile, undoBatch } = useLive();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async (before?: number) => {
    const sb = supabaseBrowser();
    if (!sb) return;
    setLoading(true);
    let query = sb.from('change_log').select('id, at, changed_by_name, batch, table_name, action, old_row, new_row, undoes_batch').order('id', { ascending: false }).limit(PAGE);
    if (before) query = query.lt('id', before);
    const { data, error: err } = await query;
    setLoading(false);
    if (err) return setError(`Could not load the history: ${err.message}`);
    const rows: Entry[] = (data ?? []).map((r) => ({ id: r.id, at: r.at, who: r.changed_by_name ?? '', batch: r.batch, table: r.table_name, action: r.action, old: r.old_row, new: r.new_row, undoes: r.undoes_batch }));
    setMore(rows.length === PAGE);
    setEntries((prev) => (before ? [...prev, ...rows] : rows));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const changes = useMemo<Change[]>(() => {
    const m = new Map<number, Change>();
    for (const e of entries) {
      const c = m.get(e.batch) ?? { batch: e.batch, at: new Date(e.at).getTime(), who: e.who, entries: [], undoes: e.undoes };
      c.entries.push(e);
      m.set(e.batch, c);
    }
    return [...m.values()].sort((a, b) => b.at - a.at || b.batch - a.batch);
  }, [entries]);
  const putBack = useMemo(() => new Set(changes.map((c) => c.undoes).filter((b): b is number => b !== null)), [changes]);
  const needle = q.trim().toLowerCase();
  const shown = changes.filter((c) => !needle || c.who.toLowerCase().includes(needle) || summarise(c).toLowerCase().includes(needle) || c.entries.some((e) => nameOf(e).toLowerCase().includes(needle)));

  if (profile?.role !== 'staff' && profile?.role !== 'coach') return null;

  async function undo(c: Change) {
    const big = c.entries.length > 1 ? `\n\nThis was one action that touched ${num(c.entries.length)} records, and all of them will be put back.` : '';
    if (!window.confirm(`Put this back?\n\n${summarise(c)}${big}\n\nYou can undo this again from the history if it is not what you wanted.`)) return;
    setBusy(c.batch);
    const ok = await undoBatch(c.batch);
    setBusy(null);
    if (ok) load();
  }

  return (
    <>
      <PageHeader title="History" sub="Every change made in the hub, newest first, with who made it. If something was changed or removed by mistake, an admin can put it back from here." />
      {error && <div role="alert" className="mb-4 rounded-md border border-alert/20 bg-alert-light px-4 py-2 text-sm text-alert">{error}</div>}
      <Panel>
        <div className="border-b border-line p-4">
          <label htmlFor="hi-q" className="label">Search</label>
          <input id="hi-q" className="field max-w-md" placeholder="A name, who changed it, or what was changed" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="divide-y divide-line">
          {shown.map((c) => {
            const single = c.entries.length === 1 ? c.entries[0] : null;
            const changesMade = single ? diff(single) : [];
            const done = putBack.has(c.batch);
            return (
              <li key={c.batch} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{summarise(c)}</span>
                      {c.undoes !== null && <Badge tone="brand">Put back an earlier change</Badge>}
                      {done && <Badge>Put back since</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft" title={`${fmtDateLong(c.at)} ${new Date(c.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}>{c.who || 'A load or the system'} · {ago(c.at)}, {new Date(c.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                    {changesMade.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-sm">
                        {changesMade.slice(0, 8).map((d) => (
                          <li key={d.key}><span className="capitalize text-ink-soft">{d.key}:</span> <span className="text-ink-soft line-through">{d.from}</span> → <span className="font-medium">{d.to}</span></li>
                        ))}
                      </ul>
                    )}
                    {!single && (
                      <button className="mt-1 text-xs font-semibold text-brand-dark underline" aria-expanded={open === c.batch} onClick={() => setOpen(open === c.batch ? null : c.batch)}>
                        {open === c.batch ? 'Hide the records' : `Show the ${num(c.entries.length)} records`}
                      </button>
                    )}
                    {!single && open === c.batch && (
                      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-md border border-line bg-paper p-2 text-sm">
                        {c.entries.slice(0, 200).map((e) => (
                          <li key={e.id}>
                            <span className="text-ink-soft">{VERB[e.action]} {(THING[e.table] ?? [e.table])[0]}</span> {nameOf(e)}
                            {diff(e).slice(0, 3).map((d) => <span key={d.key} className="text-ink-soft"> · {d.key}: {d.from} → {d.to}</span>)}
                          </li>
                        ))}
                        {c.entries.length > 200 && <li className="text-ink-soft">and {num(c.entries.length - 200)} more</li>}
                      </ul>
                    )}
                  </div>
                  {profile.isAdmin && !done && (
                    <button className="btn-ghost shrink-0" disabled={busy !== null} onClick={() => undo(c)}>{busy === c.batch ? 'Putting it back…' : 'Put this back'}</button>
                  )}
                </div>
              </li>
            );
          })}
          {!loading && shown.length === 0 && <li className="p-10 text-center text-sm text-ink-soft">{changes.length === 0 ? 'No changes recorded yet. They appear here from the moment the history is switched on.' : 'Nothing matches that search.'}</li>}
          {loading && <li className="p-6 text-center text-sm text-ink-soft">Loading…</li>}
        </ul>
        {more && !loading && (
          <div className="border-t border-line p-3 text-center">
            <button className="btn-ghost" onClick={() => load(entries[entries.length - 1]?.id)}>Show older changes</button>
          </div>
        )}
      </Panel>
    </>
  );
}

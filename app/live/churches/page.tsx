'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { lastContact } from '@/components/live/ContactLog';
import { ChurchLink } from '@/components/live/links';
import { Badge, Drawer, PageHeader, Panel } from '@/components/ui';
import { useSticky } from '@/lib/live/sticky';
import { useLive } from '@/lib/live/store';
import { CHURCH_STATUSES, SERVING_STATUSES, type ChurchStatus } from '@/lib/live/types';
import { ago, daysSince, fmtDateLong, num } from '@/lib/util';

const statusTone = (s: ChurchStatus) =>
  SERVING_STATUSES.includes(s) ? 'good' : s === 'Active Prospect' || s === 'Informed' ? 'brand' : s === 'On Hold' || s === 'Needs Re-engagement' ? 'warn' : s === 'Closed' || s === 'Not Interested' ? 'alert' : 'gray';
/** Statuses where nobody is expected to be in regular contact. */
const QUIET: ChurchStatus[] = ['Potential Prospect', 'Closed', 'Not Interested'];
const day = (d: string) => (d ? fmtDateLong(new Date(`${d}T12:00:00`).getTime()) : '');
const overdue = (d: string) => !!d && new Date(`${d}T23:59:59`).getTime() < Date.now();

export default function LiveChurchesPage() {
  const { churches, staff, families, roles, interactions } = useLive();
  const router = useRouter();
  const [q, setQ] = useSticky('churches.q', '');
  const [status, setStatus] = useSticky('churches.status', 'All');
  const [coach, setCoach] = useSticky('churches.coach', 'All');
  const [adding, setAdding] = useState(false);

  const staffName = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.name])), [staff]);
  const famCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of families) if (f.servingChurchId && f.familyStatus !== 'Closed') m[f.servingChurchId] = (m[f.servingChurchId] || 0) + 1;
    return m;
  }, [families]);
  const advocateCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of roles) if (r.churchId && r.role === 'Advocate' && r.status === 'Active') m[r.churchId] = (m[r.churchId] || 0) + 1;
    return m;
  }, [roles]);
  const contactBy = useMemo(() => {
    const groups: Record<string, typeof interactions> = {};
    for (const i of interactions) if (i.churchId) (groups[i.churchId] ||= []).push(i);
    return groups;
  }, [interactions]);

  const needle = q.trim().toLowerCase();
  const rows = churches.filter(
    (c) =>
      (status === 'All' || c.status === status) &&
      (coach === 'All' || (coach === 'none' ? !c.coachId : c.coachId === coach)) &&
      (!needle || c.name.toLowerCase().includes(needle) || c.campus.toLowerCase().includes(needle) || c.city.toLowerCase().includes(needle)),
  );

  return (
    <>
      <PageHeader title="Churches" sub="Every church from first conversation to an active Family Advocacy Ministry. This is the real list: what you add or change here is saved for the whole team.">
        <button className="btn-primary" onClick={() => setAdding(true)}>Add a church</button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-2 lg:grid-cols-9">
        {CHURCH_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? 'All' : s)} aria-pressed={status === s} className={`rounded-lg border px-3 py-2 text-left ${status === s ? 'border-brand bg-brand-light' : 'border-line bg-white hover:border-brand'}`}>
            <div className="num font-display text-3xl leading-none">{churches.filter((c) => c.status === s).length}</div>
            <div className="mt-1 text-xs font-semibold leading-tight text-ink-soft">{s}</div>
          </button>
        ))}
      </div>

      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lc-q" className="label">Search</label>
            <input id="lc-q" className="field" placeholder="Church, campus or city" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label htmlFor="lc-coach" className="label">FAM coach</label>
            <select id="lc-coach" className="field" value={coach} onChange={(e) => setCoach(e.target.value)}>
              <option value="All">All coaches</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="none">No coach yet</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-paper">
              <tr><th className="th">Church</th><th className="th">Status</th><th className="th">FAM coach</th><th className="th text-right">Families</th><th className="th text-right">Advocates</th><th className="th">Next contact</th><th className="th">Last connected</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const lc = lastContact(contactBy[c.id] ?? []);
                const stale = !QUIET.includes(c.status) && (lc.reached === null || daysSince(lc.reached) >= 28);
                return (
                  <tr key={c.id} onClick={() => router.push(`/live/churches/${c.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-light/50">
                    <td className="td"><div><ChurchLink id={c.id}>{c.name}</ChurchLink>{c.campus && <span className="font-normal text-ink-soft"> · {c.campus}</span>}</div><div className="text-xs text-ink-soft">{c.city}</div></td>
                    <td className="td"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                    <td className="td">{c.coachId ? staffName[c.coachId] : <span className="text-ink-faint">None yet</span>}{c.coachPriority === 'Low' && <span className="ml-2"><Badge>Low</Badge></span>}</td>
                    <td className="td num text-right">{famCount[c.id] || '–'}</td>
                    <td className="td num text-right">{advocateCount[c.id] || '–'}</td>
                    <td className={`td ${overdue(c.nextContactOn) ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{c.nextContactOn ? day(c.nextContactOn) : '–'}</td>
                    <td className={`td ${stale ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{lc.reached ? ago(lc.reached) : 'Never'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="td py-10 text-center text-ink-soft">
                  {churches.length === 0 ? 'No churches yet. Add the first one, or import the church spreadsheet when the importer is ready.' : 'No churches match those filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> {rows.length === 1 ? 'church' : 'churches'}</div>
      </Panel>

      <Drawer open={adding} onClose={() => setAdding(false)} title="Add a church">
        {adding && <AddChurch onDone={(id) => { setAdding(false); if (id) router.push(`/live/churches/${id}`); }} />}
      </Drawer>

    </>
  );
}

function AddChurch({ onDone }: { onDone: (id: string | null) => void }) {
  const { staff, addChurch } = useLive();
  const [f, setF] = useState({ name: '', campus: '', street: '', city: '', state: 'FL', zip: '', county: '', website: '' });
  const [status, setStatus] = useState<ChurchStatus>('Potential Prospect');
  const [coachId, setCoachId] = useState('');
  const [coachName, setCoachName] = useState('');
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const id = await addChurch({ ...f, status, coachId: coachId && coachId !== 'new' ? coachId : null, coachName: coachId === 'new' ? coachName : undefined });
    setBusy(false);
    if (id) onDone(id);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label htmlFor="ac-name" className="label">Church name</label><input id="ac-name" className="field" required {...field('name')} /></div>
      <div><label htmlFor="ac-campus" className="label">Campus (if it has more than one)</label><input id="ac-campus" className="field" {...field('campus')} /></div>
      <div>
        <label htmlFor="ac-status" className="label">Status</label>
        <select id="ac-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as ChurchStatus)}>
          {CHURCH_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ac-coach" className="label">FAM coach</label>
        <select id="ac-coach" className="field" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          <option value="">None yet</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="new">Someone new…</option>
        </select>
        {coachId === 'new' && <input aria-label="New coach's name" className="field mt-2" placeholder="Coach's full name" required value={coachName} onChange={(e) => setCoachName(e.target.value)} />}
      </div>
      <fieldset className="rounded-md border border-line p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Address</legend>
        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-6"><label htmlFor="ac-st" className="label">Street</label><input id="ac-st" className="field" {...field('street')} /></div>
          <div className="col-span-3"><label htmlFor="ac-ci" className="label">City</label><input id="ac-ci" className="field" {...field('city')} /></div>
          <div className="col-span-1"><label htmlFor="ac-sa" className="label">State</label><input id="ac-sa" className="field" {...field('state')} /></div>
          <div className="col-span-2"><label htmlFor="ac-zi" className="label">Zip</label><input id="ac-zi" className="field" {...field('zip')} /></div>
          <div className="col-span-6"><label htmlFor="ac-co" className="label">County</label><input id="ac-co" className="field" {...field('county')} /></div>
        </div>
      </fieldset>
      <div><label htmlFor="ac-web" className="label">Website</label><input id="ac-web" className="field" placeholder="https://" {...field('website')} /></div>
      <button type="submit" disabled={busy || !f.name.trim()} className="btn-primary w-full">{busy ? 'Saving…' : 'Add this church'}</button>
    </form>
  );
}

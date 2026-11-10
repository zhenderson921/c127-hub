'use client';

import { useMemo, useState } from 'react';
import { Badge, Drawer, PageHeader, Panel, Row } from '@/components/ui';
import { familiesNear, isServing } from '@/lib/match';
import { useStore } from '@/lib/store';
import type { ChurchStage } from '@/lib/types';
import { ago, daysSince, fmtDateLong, num } from '@/lib/util';

const STAGES: ChurchStage[] = ['Prospect', 'Exploring', 'Clinic scheduled', 'Launching', 'Active FAM', 'Paused'];
const stageTone = (s: ChurchStage) => (s === 'Active FAM' ? 'good' : s === 'Launching' || s === 'Clinic scheduled' ? 'brand' : s === 'Paused' ? 'alert' : 'gray');

export default function ChurchesPage() {
  const { churches, coaches, families, volunteers, guests, now, logChurchContact, connectFamily } = useStore();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('All');
  const [coach, setCoach] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const coachName = useMemo(() => Object.fromEntries(coaches.map((c) => [c.id, c.name])), [coaches]);
  const famCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of families) if (f.churchId) m[f.churchId] = (m[f.churchId] || 0) + 1;
    return m;
  }, [families]);
  const volCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of volunteers) m[v.churchId] = (m[v.churchId] || 0) + 1;
    return m;
  }, [volunteers]);

  const rows = churches
    .filter((c) => (stage === 'All' || c.stage === stage) && (coach === 'All' || c.coachId === coach) && (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || c.town.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) || a.name.localeCompare(b.name));

  const open = churches.find((c) => c.id === openId);
  const nearby = open && isServing(open) ? familiesNear(open, families).slice(0, 6) : [];
  const openGuests = open ? guests.filter((g) => g.churchId === open.id) : [];

  return (
    <>
      <PageHeader title="Churches" sub="Every church from first conversation to an active Family Advocacy Ministry, with its coach, its people and when someone last spoke with them." />

      <div className="mb-4 grid grid-cols-3 gap-2 lg:grid-cols-6">
        {STAGES.map((s) => (
          <button key={s} onClick={() => setStage(stage === s ? 'All' : s)} className={`rounded-lg border px-3 py-2 text-left ${stage === s ? 'border-brand bg-brand-light' : 'border-line bg-white hover:border-brand'}`}>
            <div className="num font-display text-3xl leading-none">{churches.filter((c) => c.stage === s).length}</div>
            <div className="mt-1 text-xs font-semibold text-ink-soft">{s}</div>
          </button>
        ))}
      </div>

      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ch-q" className="label">Search</label>
            <input id="ch-q" className="field" placeholder="Church or town" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ch-coach" className="label">Coach</label>
            <select id="ch-coach" className="field" value={coach} onChange={(e) => setCoach(e.target.value)}>
              <option value="All">All coaches</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-paper">
              <tr><th className="th">Church</th><th className="th">Stage</th><th className="th">Coach</th><th className="th text-right">Families</th><th className="th text-right">Volunteers</th><th className="th">Last contact</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const stale = c.stage !== 'Paused' && daysSince(c.lastContact, now) >= 28;
                return (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-light/50">
                    <td className="td"><div className="font-semibold text-brand-deep">{c.name}</div><div className="text-xs text-ink-soft">{c.town}</div></td>
                    <td className="td"><Badge tone={stageTone(c.stage)}>{c.stage}</Badge></td>
                    <td className="td">{coachName[c.coachId]}</td>
                    <td className="td num text-right">{famCount[c.id] ? `${famCount[c.id]} of ${c.capacity}` : '–'}</td>
                    <td className="td num text-right">{volCount[c.id] || '–'}</td>
                    <td className={`td ${stale ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{ago(c.lastContact, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> churches</div>
      </Panel>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        {open && (
          <>
            <div className="mb-3"><Badge tone={stageTone(open.stage)}>{open.stage}</Badge></div>
            <Row label="Town">{open.town}, {open.county} County</Row>
            <Row label="C127 coach">{coachName[open.coachId]}</Row>
            <Row label="Advocate">{open.advocate}</Row>
            {open.launched && <Row label="FAM launched">{fmtDateLong(open.launched)}</Row>}
            <Row label="Families served">{famCount[open.id] || 0}{open.capacity ? ` of ${open.capacity}` : ''}</Row>
            <Row label="Volunteers">{volCount[open.id] || 0}</Row>
            <Row label="Experience guests from this church">{openGuests.length}</Row>
            <Row label="Last contact">{ago(open.lastContact, now)}</Row>
            <button className="btn-primary mt-3 w-full" onClick={() => logChurchContact(open.id)}>Log a check-in today</button>
            <p className="mt-2 text-xs text-ink-soft">Logging a check-in clears the 4 week reminder on the coach&rsquo;s list.</p>

            {isServing(open) && (
              <div className="mt-6">
                <h3 className="text-sm font-bold">Families nearby with no church yet</h3>
                {nearby.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">No unconnected families within 6 miles.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {nearby.map(({ family, miles }) => (
                      <li key={family.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{family.name}</div>
                          <div className="num text-xs text-ink-soft">{family.type} · {miles.toFixed(1)} miles · {family.children} children</div>
                        </div>
                        <button className="btn-ghost shrink-0 py-1.5" onClick={() => connectFamily(family.id, open.id)}>Connect</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}

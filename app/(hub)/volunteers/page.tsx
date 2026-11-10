'use client';

import { useMemo, useState } from 'react';
import { Badge, PageHeader, Pager, Panel, Stat } from '@/components/ui';
import { useStore } from '@/lib/store';
import { ago, num } from '@/lib/util';

const PER = 20;

export default function VolunteersPage() {
  const { volunteers, churches, gifts, now } = useStore();
  const [q, setQ] = useState('');
  const [flag, setFlag] = useState('All');
  const [page, setPage] = useState(0);

  const churchName = useMemo(() => Object.fromEntries(churches.map((c) => [c.id, c.name])), [churches]);
  const donors = useMemo(() => new Set(gifts.map((g) => g.donor)), [gifts]);
  const attention = (v: (typeof volunteers)[number]) => v.background === 'Pending' || v.background === 'Expired' || v.training !== 'Complete';

  const rows = volunteers
    .filter((v) => {
      const needle = q.trim().toLowerCase();
      const hit = !needle || v.name.toLowerCase().includes(needle) || churchName[v.churchId]?.toLowerCase().includes(needle);
      const f = flag === 'All' || (flag === 'Needs attention' && attention(v)) || (flag === 'Advocates' && v.role === 'Advocate') || (flag === 'Also give' && donors.has(v.name));
      return hit && f;
    })
    .sort((a, b) => b.hours - a.hours);
  const shown = rows.slice(page * PER, page * PER + PER);

  return (
    <>
      <PageHeader title="Volunteers" sub="Every volunteer across every church roster, with clearance, training and hours in one list. A volunteer who also gives is one person here, not two records." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Volunteers" value={num(volunteers.length)} />
        <Stat label="Hours served, 6 months" value={num(Math.round(volunteers.reduce((s, v) => s + v.hours, 0)))} tone="good" />
        <Stat label="Background check pending or expired" value={num(volunteers.filter((v) => v.background === 'Pending' || v.background === 'Expired').length)} tone="warn" />
        <Stat label="Training not finished" value={num(volunteers.filter((v) => v.training !== 'Complete').length)} />
      </div>

      <Panel className="mt-6">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="vo-q" className="label">Search</label>
            <input id="vo-q" className="field" placeholder="Volunteer or church" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label htmlFor="vo-flag" className="label">Show</label>
            <select id="vo-flag" className="field" value={flag} onChange={(e) => { setFlag(e.target.value); setPage(0); }}>
              <option>All</option><option>Needs attention</option><option>Advocates</option><option>Also give</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-paper">
              <tr><th className="th">Volunteer</th><th className="th">Church</th><th className="th">Role</th><th className="th">Background check</th><th className="th">Training</th><th className="th text-right">Hours</th><th className="th">Last served</th></tr>
            </thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.id} className="border-b border-line last:border-0">
                  <td className="td font-semibold">{v.name}{donors.has(v.name) && <span className="ml-2"><Badge tone="brand">Also gives</Badge></span>}</td>
                  <td className="td">{churchName[v.churchId]}</td>
                  <td className="td">{v.role}</td>
                  <td className="td"><Badge tone={v.background === 'Cleared' ? 'good' : v.background === 'Pending' ? 'warn' : v.background === 'Expired' ? 'alert' : 'gray'}>{v.background}</Badge></td>
                  <td className="td"><Badge tone={v.training === 'Complete' ? 'good' : v.training === 'In progress' ? 'warn' : 'gray'}>{v.training}</Badge></td>
                  <td className="td num text-right">{v.hours.toFixed(1)}</td>
                  <td className="td text-ink-soft">{v.lastServed ? ago(v.lastServed, now) : 'Not yet'}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="td py-8 text-center text-ink-soft">No volunteers match.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={Math.ceil(rows.length / PER)} onPage={setPage} />
      </Panel>
    </>
  );
}

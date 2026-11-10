'use client';

import { useMemo, useState } from 'react';
import { Badge, Drawer, PageHeader, Pager, Panel, Row } from '@/components/ui';
import { nearestChurches } from '@/lib/match';
import { useStore } from '@/lib/store';
import type { Family } from '@/lib/types';
import { ago, daysSince, downloadCsv, fmtDateLong, num } from '@/lib/util';

const PER = 20;

export default function FamiliesPage() {
  const { families, churches, needs, now, connectFamily, logFamilyContact } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [conn, setConn] = useState('All');
  const [county, setCounty] = useState('All');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const churchById = useMemo(() => Object.fromEntries(churches.map((c) => [c.id, c])), [churches]);
  const counties = useMemo(() => Array.from(new Set(families.map((f) => f.county))).sort(), [families]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return families.filter(
      (f) =>
        (type === 'All' || f.type === type) &&
        (county === 'All' || f.county === county) &&
        (conn === 'All' || (conn === 'Connected' ? !!f.churchId : !f.churchId)) &&
        (!needle || f.name.toLowerCase().includes(needle) || f.town.toLowerCase().includes(needle) || (f.churchId && churchById[f.churchId]?.name.toLowerCase().includes(needle))),
    );
  }, [families, q, type, conn, county, churchById]);

  const pages = Math.ceil(rows.length / PER);
  const shown = rows.slice(page * PER, page * PER + PER);
  const open: Family | undefined = families.find((f) => f.id === openId);
  const matches = open && !open.churchId ? nearestChurches(open, churches, families) : [];
  const openNeeds = open ? needs.filter((n) => n.familyId === open.id).sort((a, b) => b.date - a.date).slice(0, 5) : [];

  const set = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <>
      <PageHeader title="Families" sub="All of the families C127 walks alongside, whether or not a church is serving them yet. MyFam only holds the ones already connected to a church.">
        <button
          className="btn-ghost"
          onClick={() =>
            downloadCsv('c127-families.csv', [
              ['Family', 'Type', 'Town', 'County', 'Children', 'Church', 'Care Community', 'Last contact'],
              ...rows.map((f) => [f.name, f.type, f.town, f.county, f.children, f.churchId ? churchById[f.churchId]?.name ?? '' : '', f.careCommunity ? 'Yes' : 'No', fmtDateLong(f.lastContact)]),
            ])
          }
        >
          Export this list
        </button>
      </PageHeader>

      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="fam-q" className="label">Search</label>
            <input id="fam-q" className="field" placeholder="Family, town or church" value={q} onChange={(e) => set(() => setQ(e.target.value))} />
          </div>
          <div>
            <label htmlFor="fam-conn" className="label">Church connection</label>
            <select id="fam-conn" className="field" value={conn} onChange={(e) => set(() => setConn(e.target.value))}>
              <option>All</option><option>Connected</option><option>Not connected</option>
            </select>
          </div>
          <div>
            <label htmlFor="fam-type" className="label">Family type</label>
            <select id="fam-type" className="field" value={type} onChange={(e) => set(() => setType(e.target.value))}>
              <option>All</option><option>Foster</option><option>Adoptive</option><option>Kinship</option><option>Reunification</option>
            </select>
          </div>
          <div>
            <label htmlFor="fam-county" className="label">County</label>
            <select id="fam-county" className="field" value={county} onChange={(e) => set(() => setCounty(e.target.value))}>
              <option>All</option>
              {counties.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> families</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-paper">
              <tr><th className="th">Family</th><th className="th">Type</th><th className="th">Town</th><th className="th text-right">Children</th><th className="th">Church</th><th className="th">Last contact</th></tr>
            </thead>
            <tbody>
              {shown.map((f) => {
                const stale = daysSince(f.lastContact, now) >= 30;
                return (
                  <tr key={f.id} onClick={() => setOpenId(f.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-light/50">
                    <td className="td font-semibold text-brand-deep">{f.name}</td>
                    <td className="td">{f.type}</td>
                    <td className="td">{f.town}</td>
                    <td className="td num text-right">{f.children}</td>
                    <td className="td">{f.churchId ? churchById[f.churchId]?.name : <Badge tone="warn">No church yet</Badge>}</td>
                    <td className={`td ${stale ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{ago(f.lastContact, now)}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-ink-soft">No families match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} onPage={setPage} />
      </Panel>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        {open && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="brand">{open.type}</Badge>
              <Badge tone={open.status === 'Active' ? 'good' : 'gray'}>{open.status}</Badge>
              {open.careCommunity && <Badge tone="brand">Has a Care Community</Badge>}
            </div>
            <Row label="Town">{open.town}, {open.county} County</Row>
            <Row label="Children in the home">{open.children}</Row>
            <Row label="With C127 since">{fmtDateLong(open.since)}</Row>
            <Row label="Record came from">{open.source}</Row>
            <Row label="Last contact">{ago(open.lastContact, now)}</Row>
            <Row label="Church">{open.churchId ? churchById[open.churchId]?.name : 'Not connected'}</Row>
            <button className="btn-ghost mt-3 w-full" onClick={() => logFamilyContact(open.id)}>Log a contact today</button>

            {!open.churchId && (
              <div className="mt-6">
                <h3 className="text-sm font-bold">Closest churches with room</h3>
                <p className="mt-1 text-xs text-ink-soft">Ranked by distance from the family&rsquo;s home, churches with open capacity first.</p>
                <ul className="mt-3 space-y-2">
                  {matches.map((m) => (
                    <li key={m.church.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{m.church.name}</div>
                        <div className="num text-xs text-ink-soft">{m.miles.toFixed(1)} miles · serving {m.serving} of {m.church.capacity}</div>
                      </div>
                      <button className="btn-primary shrink-0 py-1.5" onClick={() => connectFamily(open.id, m.church.id)}>Connect</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {openNeeds.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold">Recent care requests</h3>
                <ul className="mt-2 divide-y divide-line">
                  {openNeeds.map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>{n.title}</span>
                      <Badge tone={n.status === 'Completed' ? 'good' : n.status === 'Claimed' ? 'brand' : 'warn'}>{n.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}

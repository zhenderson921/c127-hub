'use client';

import { useMemo, useState } from 'react';
import { Badge, PageHeader, Panel, Stat } from '@/components/ui';
import { useStore } from '@/lib/store';
import type { NeedType } from '@/lib/types';
import { DAY, fmtDate, monthKey, num, pct } from '@/lib/util';

const TYPES: NeedType[] = ['Meal', 'Childcare', 'Transportation', 'Tangible item', 'Home & yard', 'Tutoring', 'Prayer'];

export default function CarePage() {
  const { needs, families, churches, volunteers, now, claimNeed, completeNeed } = useStore();
  const [type, setType] = useState('All');
  const [church, setChurch] = useState('All');

  const famName = useMemo(() => Object.fromEntries(families.map((f) => [f.id, f.name])), [families]);
  const churchName = useMemo(() => Object.fromEntries(churches.map((c) => [c.id, c.name])), [churches]);
  const volName = useMemo(() => Object.fromEntries(volunteers.map((v) => [v.id, v.name])), [volunteers]);

  const match = (n: { type: string; churchId: string }) => (type === 'All' || n.type === type) && (church === 'All' || n.churchId === church);
  const upcoming = needs.filter((n) => n.status !== 'Completed' && n.date >= now - DAY && match(n)).sort((a, b) => a.date - b.date);
  const openList = upcoming.filter((n) => n.status === 'Open');
  const claimed = upcoming.filter((n) => n.status === 'Claimed');
  const done = needs.filter((n) => n.status === 'Completed' && match(n)).sort((a, b) => b.date - a.date);
  const month = monthKey(now);
  const doneThisMonth = done.filter((n) => monthKey(n.date) === month);
  const past = needs.filter((n) => n.date < now && match(n));
  const servingChurches = churches.filter((c) => needs.some((n) => n.churchId === c.id)).sort((a, b) => a.name.localeCompare(b.name));

  const firstCleared = (churchId: string) => volunteers.find((v) => v.churchId === churchId && v.background !== 'Pending' && v.background !== 'Expired');

  return (
    <>
      <PageHeader title="Care requests" sub="Meals, rides, childcare and the rest, across every church at once. Churches and volunteers enter these on the church side of the hub, so C127 sees all of them without an export.">
        <select aria-label="Filter by type" className="field w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="All">All types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select aria-label="Filter by church" className="field w-auto max-w-[14rem]" value={church} onChange={(e) => setChurch(e.target.value)}>
          <option value="All">All churches</option>
          {servingChurches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open, needs a volunteer" value={num(openList.length)} tone={openList.length ? 'warn' : 'plain'} />
        <Stat label="Claimed, coming up" value={num(claimed.length)} />
        <Stat label="Completed this month" value={num(doneThisMonth.length)} hint={`${num(Math.round(doneThisMonth.reduce((s, n) => s + n.hours, 0)))} volunteer hours`} tone="good" />
        <Stat label="Requests met, 6 months" value={pct(past.filter((n) => n.status === 'Completed').length, past.length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title={`Open (${openList.length})`}>
          <NeedList
            empty="Every upcoming request has a volunteer."
            items={openList.slice(0, 30).map((n) => {
              const v = firstCleared(n.churchId);
              return {
                id: n.id, title: n.title, type: n.type, when: fmtDate(n.date), line: `${famName[n.familyId]} · ${churchName[n.churchId]}`,
                action: v ? <button className="btn-primary py-1" onClick={() => claimNeed(n.id, v.id)}>Assign {v.name.split(' ')[0]}</button> : null,
              };
            })}
          />
        </Panel>
        <Panel title={`Claimed (${claimed.length})`}>
          <NeedList
            empty="Nothing claimed in this view."
            items={claimed.slice(0, 30).map((n) => ({
              id: n.id, title: n.title, type: n.type, when: fmtDate(n.date), line: `${famName[n.familyId]} · ${n.volunteerId ? volName[n.volunteerId] : ''}`,
              action: <button className="btn-ghost py-1" onClick={() => completeNeed(n.id)}>Mark done</button>,
            }))}
          />
        </Panel>
        <Panel title="Recently completed">
          <NeedList
            empty="Nothing completed in this view."
            items={done.slice(0, 30).map((n) => ({
              id: n.id, title: n.title, type: n.type, when: fmtDate(n.date), line: `${famName[n.familyId]} · ${n.volunteerId ? volName[n.volunteerId] : ''}`,
              action: <span className="num text-xs text-ink-soft">{n.hours} hr</span>,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

function NeedList({ items, empty }: { items: { id: string; title: string; type: string; when: string; line: string; action: React.ReactNode }[]; empty: string }) {
  if (items.length === 0) return <p className="px-4 py-6 text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
      {items.map((n) => (
        <li key={n.id} className="px-4 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{n.title}</div>
              <div className="truncate text-xs text-ink-soft">{n.line}</div>
            </div>
            <span className="num shrink-0 text-xs text-ink-soft">{n.when}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Badge tone="gray">{n.type}</Badge>
            {n.action}
          </div>
        </li>
      ))}
    </ul>
  );
}

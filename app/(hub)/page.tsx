'use client';

import Link from 'next/link';
import { Bar, PageHeader, Panel, Stat } from '@/components/ui';
import { isServing } from '@/lib/match';
import { useStore } from '@/lib/store';
import type { ChurchStage } from '@/lib/types';
import { DAY, ago, daysSince, monthKey, num, pct } from '@/lib/util';

const STAGES: ChurchStage[] = ['Prospect', 'Exploring', 'Clinic scheduled', 'Launching', 'Active FAM', 'Paused'];

export default function Dashboard() {
  const { families, churches, guests, needs, volunteers, coaches, allTasks, log, now } = useStore();

  const active = families.filter((f) => f.status !== 'Closed');
  const connected = active.filter((f) => f.churchId);
  const waitingGuests = guests.filter((g) => g.stage === 'Needs follow-up');
  const staleChurches = churches.filter((c) => c.stage !== 'Paused' && daysSince(c.lastContact, now) >= 28);
  const thisMonth = monthKey(now);
  const hoursThisMonth = needs.filter((n) => n.status === 'Completed' && monthKey(n.date) === thisMonth).reduce((s, n) => s + n.hours, 0);
  const unclaimedSoon = needs.filter((n) => n.status === 'Open' && n.date >= now - DAY && n.date <= now + 7 * DAY);

  // Experience guests by week, split by whether anyone has followed up
  const weeks = Array.from({ length: 7 }, (_, i) => {
    const end = now - (6 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const inWeek = guests.filter((g) => g.visit > start && g.visit <= end);
    return { label: new Date(start + DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), total: inWeek.length, waiting: inWeek.filter((g) => g.stage === 'Needs follow-up').length };
  });
  const weekMax = Math.max(...weeks.map((w) => w.total), 1);

  const stageCounts = STAGES.map((s) => ({ stage: s, n: churches.filter((c) => c.stage === s).length }));
  const stageMax = Math.max(...stageCounts.map((s) => s.n));

  return (
    <>
      <PageHeader title="Dashboard" sub="Every number here is counted from the same records the team works in, so nobody re-keys anything to produce it." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Families we walk alongside" value={num(active.length)} hint={`${num(connected.length)} connected to a church (${pct(connected.length, active.length)})`} />
        <Stat label="Churches" value={num(churches.length)} hint={`${churches.filter(isServing).length} serving families today`} />
        <Stat label="Experience guests, 45 days" value={num(guests.length)} hint={`${num(guests.filter((g) => g.stage === 'Step taken').length)} have taken their next step`} />
        <Stat label="Volunteer hours this month" value={num(Math.round(hoursThisMonth))} hint={`${num(volunteers.length)} volunteers on church rosters`} tone="good" />
      </div>

      <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-widest text-ink-soft">Needs attention</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Attention href="/experience" n={waitingGuests.length} label="guests waiting on a second touch" detail="They got the first email and nothing since." />
        <Attention href="/map" n={active.length - connected.length} label="families with no church yet" detail="Each one has a closest serving church on the map." />
        <Attention href="/my-work" n={staleChurches.length} label="churches not contacted in 4 weeks" detail="A reminder is already on each coach's list." />
        <Attention href="/care" n={unclaimedSoon.length} label="care requests unclaimed this week" detail="Open requests dated in the next 7 days." />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Experience guests by week">
          <div className="px-4 py-4">
            <div className="flex h-40 items-end gap-2">
              {weeks.map((w) => (
                <div key={w.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="num text-xs font-semibold text-ink">{w.total}</span>
                  <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${(w.total / weekMax) * 80}%` }}>
                    <div className="bg-warn" style={{ height: `${w.total ? (w.waiting / w.total) * 100 : 0}%` }} />
                    <div className="flex-1 bg-brand" />
                  </div>
                  <span className="truncate text-[11px] text-ink-soft">{w.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand" />Followed up</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-warn" />Still waiting</span>
            </div>
          </div>
        </Panel>

        <Panel title="Churches by stage" action={<Link href="/churches" className="text-xs font-semibold text-brand-dark hover:underline">All churches</Link>}>
          <div className="space-y-3 px-4 py-4">
            {stageCounts.map((s) => (
              <div key={s.stage} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3 text-sm">
                <span>{s.stage}</span>
                <Bar value={s.n} max={stageMax} tone={s.stage === 'Paused' ? 'gray' : 'brand'} />
                <span className="num text-right font-semibold">{s.n}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Coach workload" action={<Link href="/my-work" className="text-xs font-semibold text-brand-dark hover:underline">Open my work</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line">
                <tr><th className="th">Coach</th><th className="th text-right">Churches</th><th className="th text-right">Families</th><th className="th text-right">Open to-dos</th><th className="th text-right">Overdue check-ins</th></tr>
              </thead>
              <tbody>
                {coaches.map((c) => {
                  const mine = churches.filter((ch) => ch.coachId === c.id);
                  const ids = new Set(mine.map((m) => m.id));
                  const overdue = mine.filter((m) => m.stage !== 'Paused' && daysSince(m.lastContact, now) >= 28).length;
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="td font-medium">{c.name}</td>
                      <td className="td num text-right">{mine.length}</td>
                      <td className="td num text-right">{families.filter((f) => f.churchId && ids.has(f.churchId)).length}</td>
                      <td className="td num text-right">{allTasks.filter((t) => t.coachId === c.id && !t.done).length}</td>
                      <td className={`td num text-right font-semibold ${overdue ? 'text-warn' : 'text-ink-soft'}`}>{overdue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent activity">
          {log.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-soft">Nothing yet in this session. Connect a family on the map, send a follow-up or claim a care request, and it shows up here for the whole team.</p>
          ) : (
            <ul className="divide-y divide-line">
              {log.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>{l.text}</span>
                  <span className="whitespace-nowrap text-xs text-ink-soft">{ago(l.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function Attention({ href, n, label, detail }: { href: string; n: number; label: string; detail: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-line border-l-4 border-l-warn bg-white px-4 py-3 hover:border-brand hover:border-l-brand">
      <div className="flex items-baseline gap-2">
        <span className="num font-display text-3xl leading-none text-warn group-hover:text-brand-dark">{num(n)}</span>
        <span className="text-sm font-semibold leading-tight">{label}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">{detail}</p>
    </Link>
  );
}

'use client';

import { useMemo } from 'react';
import { Badge, Bar, PageHeader, Panel, Stat } from '@/components/ui';
import { useStore } from '@/lib/store';
import { DAY, fmtDateLong, money, monthKey, num } from '@/lib/util';

export default function GivingPage() {
  const { gifts, volunteers, guests, now } = useStore();

  const year = gifts.filter((g) => g.date >= now - 365 * DAY);
  const total = year.reduce((s, g) => s + g.amount, 0);
  const donors = useMemo(() => {
    const m = new Map<string, { total: number; last: number; recurring: boolean; count: number }>();
    for (const g of year) {
      const d = m.get(g.donor) || { total: 0, last: 0, recurring: false, count: 0 };
      d.total += g.amount;
      d.count += 1;
      d.last = Math.max(d.last, g.date);
      d.recurring = d.recurring || g.recurring;
      m.set(g.donor, d);
    }
    return [...m.entries()].map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);
  }, [year]);
  const volNames = useMemo(() => new Set(volunteers.map((v) => v.name)), [volunteers]);
  const guestNames = useMemo(() => new Set(guests.map((g) => g.name)), [guests]);
  const lapsed = donors.filter((d) => !d.recurring && d.last < now - 180 * DAY);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (5 - i), 1);
    const key = monthKey(d.getTime());
    return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), total: gifts.filter((g) => monthKey(g.date) === key).reduce((s, g) => s + g.amount, 0) };
  });
  const monthMax = Math.max(...months.map((m) => m.total), 1);
  const funds = ['General', 'Center for Care & Calling', 'Church Launch Fund'].map((f) => ({ fund: f, total: year.filter((g) => g.fund === f).reduce((s, g) => s + g.amount, 0) }));

  return (
    <>
      <PageHeader title="Giving" sub="Gifts stay in Aplos, where the accounting lives. The hub reads them each night so a donor, a volunteer and an Experience guest who are the same person show up as one." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Given, last 12 months" value={money(total)} tone="good" />
        <Stat label="Donors" value={num(donors.length)} hint={`${donors.filter((d) => d.recurring).length} give monthly`} />
        <Stat label="Donors who also serve" value={num(donors.filter((d) => volNames.has(d.name)).length)} />
        <Stat label="Lapsed, 6 months" value={num(lapsed.length)} hint="One-time donors with no gift since" tone="warn" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Panel title="By month">
            <div className="flex h-36 items-end gap-3 px-4 py-4">
              {months.map((m) => (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="num text-[11px] font-semibold">{money(m.total)}</span>
                  <div className="w-full rounded-t bg-brand" style={{ height: `${(m.total / monthMax) * 70}%` }} />
                  <span className="text-[11px] text-ink-soft">{m.label}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="By fund, last 12 months">
            <div className="space-y-3 px-4 py-4">
              {funds.map((f) => (
                <div key={f.fund} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3"><span>{f.fund}</span><span className="num font-semibold">{money(f.total)}</span></div>
                  <Bar value={f.total} max={total} />
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Donors">
          <div className="max-h-[34rem] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-line bg-paper">
                <tr><th className="th">Donor</th><th className="th text-right">12 months</th><th className="th text-right">Gifts</th><th className="th">Last gift</th></tr>
              </thead>
              <tbody>
                {donors.slice(0, 60).map((d) => (
                  <tr key={d.name} className="border-b border-line last:border-0">
                    <td className="td">
                      <span className="font-semibold">{d.name}</span>
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {d.recurring && <Badge tone="good">Monthly</Badge>}
                        {volNames.has(d.name) && <Badge tone="brand">Volunteer</Badge>}
                        {guestNames.has(d.name) && <Badge tone="gray">Experience guest</Badge>}
                      </span>
                    </td>
                    <td className="td num text-right font-semibold">{money(d.total)}</td>
                    <td className="td num text-right">{d.count}</td>
                    <td className="td text-ink-soft">{fmtDateLong(d.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { PageHeader, Panel, Stat } from '@/components/ui';
import { isServing } from '@/lib/match';
import { useStore } from '@/lib/store';
import { downloadCsv, monthKey, monthLabel, num } from '@/lib/util';

export default function ReportsPage() {
  const { needs, families, churches, volunteers, guests, now } = useStore();

  const months = useMemo(() => {
    const out: string[] = [];
    const d = new Date(now);
    for (let i = 0; i < 6; i++) {
      out.push(monthKey(d.getTime()));
      d.setMonth(d.getMonth() - 1, 1);
    }
    return out;
  }, [now]);
  const [month, setMonth] = useState(months[0]);

  const report = useMemo(() => {
    const done = needs.filter((n) => n.status === 'Completed' && monthKey(n.date) === month);
    const famById = Object.fromEntries(families.map((f) => [f.id, f]));
    const churchById = Object.fromEntries(churches.map((c) => [c.id, c]));
    const servedIds = new Set(done.map((n) => n.familyId));
    const volIds = new Set(done.map((n) => n.volunteerId).filter(Boolean));
    const hours = done.reduce((s, n) => s + n.hours, 0);
    const children = [...servedIds].reduce((s, id) => s + (famById[id]?.children ?? 0), 0);
    const byType: Record<string, number> = {};
    for (const n of done) byType[n.type] = (byType[n.type] || 0) + 1;

    const counties = Array.from(new Set(churches.map((c) => c.county))).sort();
    const byCounty = counties.map((county) => {
      const rows = done.filter((n) => churchById[n.churchId]?.county === county);
      return {
        county,
        churches: churches.filter((c) => c.county === county && isServing(c)).length,
        families: new Set(rows.map((r) => r.familyId)).size,
        services: rows.length,
        hours: rows.reduce((s, r) => s + r.hours, 0),
      };
    });
    const guestsInMonth = guests.filter((g) => monthKey(g.visit) === month);
    return {
      done, hours, children, byType, byCounty,
      families: servedIds.size,
      volunteers: volIds.size,
      newFamilies: families.filter((f) => monthKey(f.since) === month).length,
      fosterInterest: guestsInMonth.filter((g) => g.interests.includes('Foster or adopt')).length,
      guests: guestsInMonth.length,
      launched: churches.filter((c) => c.launched && monthKey(c.launched) === month).length,
    };
  }, [month, needs, families, churches, guests]);

  function exportCsv() {
    downloadCsv(`c127-grant-report-${month}.csv`, [
      ['Commission 127 monthly report', monthLabel(month)],
      [],
      ['Measure', 'Value'],
      ['Families served', report.families],
      ['Children in those homes', report.children],
      ['Services delivered', report.done.length],
      ['Volunteer hours', report.hours],
      ['Volunteers who served', report.volunteers],
      ['Churches serving families', churches.filter(isServing).length],
      ['Experience guests', report.guests],
      ['Guests interested in fostering or adopting', report.fosterInterest],
      [],
      ['County', 'Churches serving', 'Families served', 'Services', 'Volunteer hours'],
      ...report.byCounty.map((c) => [c.county, c.churches, c.families, c.services, c.hours]),
      [],
      ['Service type', 'Count'],
      ...Object.entries(report.byType),
    ]);
  }

  return (
    <>
      <PageHeader title="Grant report" sub="The monthly numbers a state grant asks for, counted from the records the team already keeps. Choose a month and export; nobody assembles it by hand.">
        <select aria-label="Report month" className="field w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <button className="btn-primary" onClick={exportCsv}>Export for the grant</button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Families served" value={num(report.families)} hint={`${num(report.children)} children in those homes`} />
        <Stat label="Services delivered" value={num(report.done.length)} hint="Meals, rides, childcare and more" />
        <Stat label="Volunteer hours" value={num(Math.round(report.hours))} hint={`${num(report.volunteers)} volunteers served`} tone="good" />
        <Stat label="Recruitment" value={num(report.fosterInterest)} hint={`of ${num(report.guests)} Experience guests want to foster or adopt`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel title={`By county, ${monthLabel(month)}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-paper">
                <tr><th className="th">County</th><th className="th text-right">Churches serving</th><th className="th text-right">Families served</th><th className="th text-right">Services</th><th className="th text-right">Volunteer hours</th></tr>
              </thead>
              <tbody>
                {report.byCounty.map((c) => (
                  <tr key={c.county} className="border-b border-line">
                    <td className="td font-semibold">{c.county}</td>
                    <td className="td num text-right">{c.churches}</td>
                    <td className="td num text-right">{c.families}</td>
                    <td className="td num text-right">{c.services}</td>
                    <td className="td num text-right">{c.hours.toFixed(1)}</td>
                  </tr>
                ))}
                <tr className="bg-paper font-semibold">
                  <td className="td">Total</td>
                  <td className="td num text-right">{churches.filter(isServing).length}</td>
                  <td className="td num text-right">{report.families}</td>
                  <td className="td num text-right">{report.done.length}</td>
                  <td className="td num text-right">{report.hours.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Services by type">
          <ul className="divide-y divide-line">
            {Object.entries(report.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <li key={t} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{t}</span><span className="num font-semibold">{n}</span></li>
            ))}
            {report.done.length === 0 && <li className="px-4 py-6 text-sm text-ink-soft">No completed services recorded in this month.</li>}
          </ul>
          <p className="border-t border-line px-4 py-3 text-xs text-ink-soft">
            Also this month: {report.newFamilies} new families, {report.launched} FAM launched, {num(volunteers.length)} volunteers on rosters.
          </p>
        </Panel>
      </div>
    </>
  );
}

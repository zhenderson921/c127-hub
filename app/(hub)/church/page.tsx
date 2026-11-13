'use client';

import { useMemo, useState } from 'react';
import { Badge, PageHeader, Panel, Stat } from '@/components/ui';
import { familiesNear, isServing } from '@/lib/match';
import { useStore } from '@/lib/store';
import { canServe, careTeam } from '@/lib/team';
import type { NeedType } from '@/lib/types';
import { DAY, fmtDate, monthKey, num } from '@/lib/util';

const TYPES: NeedType[] = ['Meal', 'Childcare', 'Transportation', 'Tangible item', 'Home & yard', 'Tutoring', 'Prayer'];

export default function ChurchViewPage() {
  const { churches, families, volunteers, needs, coaches, now, claimNeed, addNeed, startCareCommunity, setTraining, connectFamily } = useStore();
  const serving = useMemo(() => churches.filter(isServing).sort((a, b) => a.name.localeCompare(b.name)), [churches]);
  const { profile, mode } = useStore();
  const locked = mode === 'live' && profile?.role === 'advocate';
  const [churchId, setChurchId] = useState(() => {
    if (locked && profile?.churchId) return profile.churchId;
    const load = (id: string) => families.filter((f) => f.churchId === id).length;
    return (serving.find((c) => c.stage === 'Active FAM' && load(c.id) >= 6 && load(c.id) < c.capacity) ?? serving[0] ?? churches[0])?.id ?? '';
  });
  const church = churches.find((c) => c.id === churchId);
  const [famId, setFamId] = useState('');
  const [type, setType] = useState<NeedType>('Meal');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  if (!church) {
    return (
      <>
        <PageHeader title="Church view" sub="What a FAM advocate sees when they sign in." />
        <Panel><p className="px-4 py-8 text-sm text-ink-soft">No churches are serving families yet. Import your church list, and any church marked Launching or Active FAM appears here.</p></Panel>
      </>
    );
  }


  const myFamilies = families.filter((f) => f.churchId === churchId);
  const roster = volunteers.filter((v) => v.churchId === churchId);
  const volName = Object.fromEntries(roster.map((v) => [v.id, v.name]));
  const famName = Object.fromEntries(myFamilies.map((f) => [f.id, f.name]));
  const mine = needs.filter((n) => n.churchId === churchId);
  const upcoming = mine.filter((n) => n.status !== 'Completed' && n.date >= now - DAY).sort((a, b) => a.date - b.date);
  const hours = mine.filter((n) => n.status === 'Completed' && monthKey(n.date) === monthKey(now)).reduce((s, n) => s + n.hours, 0);
  const waiting = familiesNear(church, families, 5).slice(0, 5);
  const coach = coaches.find((c) => c.id === church.coachId);

  return (
    <>
      <PageHeader title="Church view" sub="What a FAM advocate sees when they sign in: their own families, Care Communities, requests and volunteers. This is the part of the hub that takes the place of MyFam.">
        <label htmlFor="cv-church" className="text-sm text-ink-soft">Signed in as the advocate at</label>
        <select id="cv-church" disabled={locked} className="field w-auto max-w-[18rem]" value={churchId} onChange={(e) => { setChurchId(e.target.value); setFamId(''); }}>
          {(locked ? [church] : serving).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Families we serve" value={`${myFamilies.length}`} hint={`Room for ${Math.max(0, church.capacity - myFamilies.length)} more`} />
        <Stat label="Volunteers" value={num(roster.length)} hint={`${roster.filter((v) => v.training !== 'Complete').length} still in orientation`} />
        <Stat label="Requests needing someone" value={num(upcoming.filter((n) => n.status === 'Open').length)} tone={upcoming.some((n) => n.status === 'Open') ? 'warn' : 'plain'} />
        <Stat label="Hours served this month" value={num(Math.round(hours))} hint={`Advocate ${church.advocate} · coach ${coach?.name ?? ''}`} tone="good" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Care Communities">
          <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
            {myFamilies.map((f) => {
              const team = careTeam(f, volunteers);
              return (
                <li key={f.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold">{f.name}</span>
                      <span className="ml-2 text-xs text-ink-soft">{f.type} · {f.children} children</span>
                    </div>
                    {team.length === 0 && <button className="btn-primary shrink-0 py-1" onClick={() => startCareCommunity(f.id)}>Build a team</button>}
                  </div>
                  {team.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{team.map((v) => <Badge key={v.id} tone="brand">{v.name}</Badge>)}</div>
                  ) : (
                    <p className="mt-1 text-xs text-warn">No Care Community yet. Requests go to the whole roster.</p>
                  )}
                </li>
              );
            })}
            {myFamilies.length === 0 && <li className="px-4 py-6 text-sm text-ink-soft">No families connected yet. See the waiting list below.</li>}
          </ul>
        </Panel>

        <Panel title={`Requests coming up (${upcoming.length})`}>
          <form
            className="grid gap-2 border-b border-line p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!famId || !title.trim()) return;
              addNeed({ familyId: famId, churchId, type, title: title.trim(), date: date ? new Date(`${date}T12:00:00`).getTime() : Date.now() + 3 * DAY, status: 'Open', volunteerId: null, hours: type === 'Childcare' ? 3 : 1.5 });
              setTitle('');
            }}
          >
            <select aria-label="Family" className="field" value={famId} onChange={(e) => setFamId(e.target.value)}>
              <option value="">Which family?</option>
              {myFamilies.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select aria-label="Type of request" className="field" value={type} onChange={(e) => setType(e.target.value as NeedType)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input aria-label="What is needed" className="field" placeholder="What is needed" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex gap-2">
              <input aria-label="Date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
              <button type="submit" className="btn-primary shrink-0" disabled={!famId || !title.trim()}>Add</button>
            </div>
          </form>
          <ul className="max-h-[19rem] divide-y divide-line overflow-y-auto">
            {upcoming.map((n) => {
              const eligible = roster.filter((v) => canServe(v, n.type));
              return (
                <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{n.title}</div>
                    <div className="truncate text-xs text-ink-soft">{famName[n.familyId]} · {n.type} · {fmtDate(n.date)}</div>
                  </div>
                  {n.status === 'Claimed' ? (
                    <Badge tone="good">{n.volunteerId ? volName[n.volunteerId] : 'Claimed'}</Badge>
                  ) : (
                    <select aria-label={`Assign ${n.title}`} className="field w-auto max-w-[10rem] py-1" value="" onChange={(e) => e.target.value && claimNeed(n.id, e.target.value)}>
                      <option value="">Assign…</option>
                      {eligible.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                </li>
              );
            })}
            {upcoming.length === 0 && <li className="px-4 py-6 text-sm text-ink-soft">Nothing coming up. Add a request above.</li>}
          </ul>
        </Panel>

        <Panel title="Volunteer roster">
          <ul className="max-h-[24rem] divide-y divide-line overflow-y-auto">
            {roster.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{v.name}</div>
                  <div className="text-xs text-ink-soft">{v.role} · {v.hours.toFixed(1)} hours</div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {v.background !== 'Not required' && <Badge tone={v.background === 'Cleared' ? 'good' : v.background === 'Pending' ? 'warn' : 'alert'}>Check: {v.background}</Badge>}
                  {v.training === 'Complete' ? <Badge tone="good">Oriented</Badge> : <button className="btn-ghost py-1" onClick={() => setTraining(v.id, 'Complete')}>Mark oriented</button>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Families near us with no church yet">
          {waiting.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-soft">No unconnected families within 5 miles.</p>
          ) : (
            <ul className="divide-y divide-line">
              {waiting.map(({ family, miles }) => (
                <li key={family.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{family.name}</div>
                    <div className="num text-xs text-ink-soft">{family.type} · {family.children} children · {miles.toFixed(1)} miles away</div>
                  </div>
                  <button className="btn-ghost shrink-0 py-1" disabled={myFamilies.length >= church.capacity} onClick={() => connectFamily(family.id, churchId)}>{myFamilies.length >= church.capacity ? 'At capacity' : 'Take them on'}</button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line px-4 py-3 text-xs text-ink-soft">A church sees first names and a distance until C127 or the family approves the connection. The demo shows family names for clarity.</p>
        </Panel>
      </div>
    </>
  );
}

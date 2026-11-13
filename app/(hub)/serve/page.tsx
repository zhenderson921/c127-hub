'use client';

import { useMemo, useState } from 'react';
import { Badge, PageHeader } from '@/components/ui';
import { useStore } from '@/lib/store';
import { canServe, careTeam } from '@/lib/team';
import { DAY, fmtDate } from '@/lib/util';

export default function VolunteerViewPage() {
  const { volunteers, churches, families, needs, now, claimNeed, completeNeed, setTraining } = useStore();

  // Start on a volunteer who has something on their plate, so the screen is not empty.
  const first = useMemo(() => {
    const busy = needs.find((n) => n.status === 'Claimed' && n.date >= now && n.volunteerId);
    return busy?.volunteerId ?? volunteers[0]?.id ?? '';
  }, [needs, volunteers, now]);
  const [meId, setMeId] = useState(first);
  const me = volunteers.find((v) => v.id === meId) ?? volunteers[0];
  if (!me) {
    return (
      <>
        <PageHeader title="Volunteer view" sub="What a volunteer sees on their phone or computer." />
        <div className="rounded-lg border border-line bg-white px-4 py-8 text-sm text-ink-soft">No volunteers yet. Once a church has a roster, pick a volunteer here to see the hub the way they do.</div>
      </>
    );
  }
  const church = churches.find((c) => c.id === me.churchId) ?? { name: '' };
  const peers = volunteers.filter((v) => v.churchId === me.churchId);
  const famName = Object.fromEntries(families.map((f) => [f.id, f.name]));

  const mineUpcoming = needs.filter((n) => n.volunteerId === me.id && n.status === 'Claimed' && n.date >= now - DAY).sort((a, b) => a.date - b.date);
  const open = needs.filter((n) => n.churchId === me.churchId && n.status === 'Open' && n.date >= now - DAY).sort((a, b) => a.date - b.date);
  const myTeams = families.filter((f) => f.churchId === me.churchId && careTeam(f, volunteers).some((v) => v.id === me.id));
  const oriented = me.training === 'Complete';

  return (
    <>
      <PageHeader title="Volunteer view" sub="What a volunteer sees on their phone: what they signed up for, what their church still needs, and their orientation. No app store download; it opens from a link.">
        <select aria-label="Church" className="field w-auto max-w-[14rem]" value={me.churchId} onChange={(e) => setMeId(volunteers.find((v) => v.churchId === e.target.value)!.id)}>
          {churches.filter((c) => volunteers.some((v) => v.churchId === c.id)).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Volunteer" className="field w-auto max-w-[12rem]" value={me.id} onChange={(e) => setMeId(e.target.value)}>
          {peers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </PageHeader>

      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border-8 border-ink bg-white shadow-xl">
        <div className="bg-ink px-5 pb-4 pt-5 text-white">
          <div className="text-xs uppercase tracking-widest text-white/60">{church.name}</div>
          <div className="font-display text-3xl tracking-wide">Hi, {me.name.split(' ')[0]}</div>
          <div className="mt-1 flex gap-4 text-xs text-white/70">
            <span><b className="num text-base text-white">{me.hours.toFixed(1)}</b> hours served</span>
            <span><b className="num text-base text-white">{myTeams.length}</b> Care {myTeams.length === 1 ? 'Community' : 'Communities'}</span>
          </div>
        </div>

        <div className="max-h-[34rem] space-y-5 overflow-y-auto px-5 py-4">
          {!oriented && (
            <div className="rounded-lg bg-warn-light p-3">
              <div className="text-sm font-bold text-warn">Finish your orientation</div>
              <ol className="mt-1.5 space-y-1 text-sm">
                <li className="text-ink-soft line-through">1. Welcome from your advocate</li>
                <li className={me.training === 'In progress' ? 'text-ink-soft line-through' : ''}>2. Care Community basics (20 min video)</li>
                <li>3. Caring for kids from hard places</li>
              </ol>
              <button className="btn-primary mt-2 w-full py-1.5" onClick={() => setTraining(me.id, 'Complete')}>Mark orientation complete</button>
            </div>
          )}
          {(me.background === 'Pending' || me.background === 'Expired') && (
            <p className="rounded-lg bg-alert-light p-3 text-sm text-alert">Your background check is {me.background.toLowerCase()}. You can bring meals and help around the house now. Childcare and rides open up once it clears.</p>
          )}

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">You signed up for</h2>
            {mineUpcoming.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Nothing on your calendar. Pick something below.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {mineUpcoming.map((n) => (
                  <li key={n.id} className="rounded-lg border border-brand bg-brand-light p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{n.title}</span>
                      <span className="num text-xs font-semibold text-brand-deep">{fmtDate(n.date)}</span>
                    </div>
                    <div className="text-xs text-ink-soft">{famName[n.familyId]} · {n.type}</div>
                    <button className="btn-ghost mt-2 w-full py-1" onClick={() => completeNeed(n.id)}>I did this</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Your church needs</h2>
            {open.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Every request is covered right now.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {open.slice(0, 8).map((n) => {
                  const ok = canServe(me, n.type);
                  return (
                    <li key={n.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{n.title}</span>
                        <span className="num text-xs text-ink-soft">{fmtDate(n.date)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft"><Badge tone="gray">{n.type}</Badge>{famName[n.familyId]}</div>
                      {ok ? (
                        <button className="btn-primary mt-2 w-full py-1.5" onClick={() => claimNeed(n.id, me.id)}>I can do this</button>
                      ) : (
                        <p className="mt-2 text-xs text-ink-soft">Needs a cleared background check.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {myTeams.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Your Care {myTeams.length === 1 ? 'Community' : 'Communities'}</h2>
              <ul className="mt-2 space-y-2">
                {myTeams.slice(0, 3).map((f) => (
                  <li key={f.id} className="rounded-lg border border-line p-3">
                    <div className="text-sm font-semibold">{f.name}</div>
                    <div className="mt-1 text-xs text-ink-soft">With {careTeam(f, volunteers).filter((v) => v.id !== me.id).map((v) => v.name.split(' ')[0]).join(', ')}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

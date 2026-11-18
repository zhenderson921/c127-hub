'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ContactLog, lastContact } from '@/components/live/ContactLog';
import { ChurchSelect, HomeTypePicker } from '@/components/live/fields';
import { ChurchLink, NotFound, PersonLink } from '@/components/live/links';
import { Badge, Panel, Row } from '@/components/ui';
import { churchLabel } from '@/lib/live/match';
import { useLive } from '@/lib/live/store';
import { CARE_STATUSES, CC_STATUSES, CHILD_RELATIONSHIPS, FAMILY_STATUSES, SERVING_STATUSES, ageBand, careLabel, personName, type CareStatus, type CcStatus, type ChildRelationship, type Family, type FamilyStatus } from '@/lib/live/types';
import { ago, fmtDateLong } from '@/lib/util';

const careTone = (label: string) => (label === 'Active Care Community' ? 'good' : label === 'Priority Care' ? 'alert' : label === 'Care Requested' || label === 'Building team' ? 'warn' : 'gray');
const day = (d: string) => (d ? fmtDateLong(new Date(`${d}T12:00:00`).getTime()) : '');

export default function FamilyPage() {
  const { id } = useParams<{ id: string }>();
  const { families } = useLive();
  const family = families.find((f) => f.id === id);
  if (!family) return <NotFound what="family" href="/live/families" list="Families" />;
  return <FamilyRecord key={family.id} family={family} />;
}

function FamilyRecord({ family }: { family: Family }) {
  const { churches, people, members, children, careCommunities, interactions, updateFamily, addChild, removeChild, startCareCommunity, updateCareCommunity } = useLive();
  const churchById = useMemo(() => new Map(churches.map((c) => [c.id, c])), [churches]);
  const adults = members
    .filter((m) => m.familyId === family.id)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((m) => ({ m, p: people.find((p) => p.id === m.personId) }));
  const kids = children.filter((c) => c.familyId === family.id);
  const ccs = careCommunities.filter((c) => c.familyId === family.id);
  const openCc = ccs.some((c) => c.status !== 'Closed');
  const log = interactions.filter((i) => i.familyId === family.id);
  const lc = lastContact(log);
  const serving = churches.filter((c) => SERVING_STATUSES.includes(c.status) || c.id === family.servingChurchId);
  const home = family.homeChurchId ? churchById.get(family.homeChurchId) : undefined;
  const served = family.servingChurchId ? churchById.get(family.servingChurchId) : undefined;

  const [kid, setKid] = useState<{ firstName: string; birthYear: string; relationship: ChildRelationship }>({ firstName: '', birthYear: '', relationship: 'Foster' });
  const [prayer, setPrayer] = useState(family.prayerRequest);
  const [notes, setNotes] = useState(family.notes);
  const label = careLabel(family, careCommunities);
  const address = [family.street, family.unit].filter(Boolean).join(', ');
  const cityLine = [family.city, [family.state, family.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  async function submitKid(e: React.FormEvent) {
    e.preventDefault();
    const year = kid.birthYear ? Number(kid.birthYear) : null;
    if (await addChild({ familyId: family.id, firstName: kid.firstName, birthYear: year, relationship: kid.relationship })) setKid({ firstName: '', birthYear: '', relationship: kid.relationship });
  }

  return (
    <>
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Family</div>
        <h1 className="font-display text-4xl leading-none tracking-wide text-ink">{family.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {family.homeTypes.map((t) => <Badge key={t} tone="brand">{t}</Badge>)}
          <Badge tone={family.familyStatus === 'Active' ? 'good' : 'gray'}>{family.familyStatus}</Badge>
          <Badge tone={careTone(label)}>{label}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Adults in the home">
            {adults.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft">No adults recorded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {adults.map(({ m, p }) => (
                  <li key={m.personId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <span><PersonLink id={m.personId}>{personName(p) || 'Unnamed'}</PersonLink> <span className="text-ink-soft">· {m.relationship}{m.isPrimary ? ' · main contact' : ''}</span></span>
                    <span className="text-ink-soft">
                      {p?.phone && <a className="underline" href={`tel:${p.phone}`}>{p.phone}</a>}
                      {p?.phone && p?.email && ' · '}
                      {p?.email && <a className="underline" href={`mailto:${p.email}`}>{p.email}</a>}
                      {!p?.phone && !p?.email && 'No phone or email yet'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Churches">
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fd-home" className="label">Home church (where they attend)</label>
                <ChurchSelect id="fd-home" value={family.homeChurchId} onChange={(homeChurchId) => updateFamily(family.id, { homeChurchId })} churches={churches} empty={family.homeChurchText ? `Not in the list: ${family.homeChurchText}` : 'None, or not in the list'} />
                <p className="mt-1.5 text-sm">
                  {home ? <ChurchLink id={home.id}>Open {churchLabel(home)}</ChurchLink> : family.homeChurchText ? <span className="text-ink-soft">Typed as &ldquo;{family.homeChurchText}&rdquo;. Confirm it on the Data check page, or pick the church here.</span> : <span className="text-ink-faint">None recorded</span>}
                </p>
              </div>
              <div>
                <label htmlFor="fd-serv" className="label">Serving church (whose FAM serves them)</label>
                <ChurchSelect id="fd-serv" value={family.servingChurchId} onChange={(servingChurchId) => updateFamily(family.id, { servingChurchId })} churches={serving} empty={family.servingChurchText ? `To confirm: ${family.servingChurchText}` : 'None yet'} />
                <p className="mt-1.5 text-sm">
                  {served ? <ChurchLink id={served.id}>Open {churchLabel(served)}</ChurchLink> : family.servingChurchText ? <span className="text-warn">Typed as &ldquo;{family.servingChurchText}&rdquo;, to confirm.</span> : <span className="text-ink-faint">Not being served by a church yet</span>}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Children">
            <p className="px-4 pt-3 text-xs text-ink-soft">First name and year of birth only. Ages are worked out, so they stay right as the children grow.</p>
            {kids.length > 0 && (
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {kids.map((c) => {
                  const { age, band } = ageBand(c.birthYear);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span><span className="font-semibold">{c.firstName || 'Name not recorded'}</span> <span className="text-ink-soft">· {c.relationship} · {age === null ? c.notes || 'age unknown' : `about ${age}, ${band}`}</span></span>
                      <button className="text-xs text-ink-soft underline hover:text-alert" onClick={() => { if (window.confirm(`Remove ${c.firstName || 'this child'} from the family?`)) removeChild(c.id); }}>Remove</button>
                    </li>
                  );
                })}
              </ul>
            )}
            <form onSubmit={submitKid} className="grid grid-cols-6 items-end gap-2 p-4 sm:grid-cols-12">
              <div className="col-span-3 sm:col-span-4"><label htmlFor="kid-n" className="label">First name</label><input id="kid-n" className="field" value={kid.firstName} onChange={(e) => setKid({ ...kid, firstName: e.target.value })} /></div>
              <div className="col-span-3 sm:col-span-3"><label htmlFor="kid-y" className="label">Born (year)</label><input id="kid-y" className="field" type="number" min={1980} max={new Date().getFullYear()} placeholder="2019" value={kid.birthYear} onChange={(e) => setKid({ ...kid, birthYear: e.target.value })} /></div>
              <div className="col-span-3 sm:col-span-3">
                <label htmlFor="kid-r" className="label">Type</label>
                <select id="kid-r" className="field" value={kid.relationship} onChange={(e) => setKid({ ...kid, relationship: e.target.value as ChildRelationship })}>
                  {CHILD_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" disabled={!kid.firstName.trim() && !kid.birthYear} className="btn-ghost col-span-3 sm:col-span-2">Add</button>
            </form>
          </Panel>

          <Panel title="Care Community">
            <div className="p-4">
              {ccs.length === 0 && <p className="text-sm text-ink-soft">This family has not had a Care Community.</p>}
              <ul className="space-y-2">
                {ccs.map((c) => (
                  <li key={c.id} className="rounded-md border border-line p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span>{c.churchId && churchById.get(c.churchId) ? <ChurchLink id={c.churchId}>{churchLabel(churchById.get(c.churchId)!)}</ChurchLink> : <span className="font-semibold text-ink-soft">No church set</span>}</span>
                      <select aria-label="Care Community status" className="field w-auto py-1" value={c.status} onChange={(e) => updateCareCommunity(c.id, { status: e.target.value as CcStatus })}>
                        {CC_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div><label htmlFor={`cc-l-${c.id}`} className="label">Launched</label><input id={`cc-l-${c.id}`} type="date" className="field" value={c.launchedOn} onChange={(e) => updateCareCommunity(c.id, { launchedOn: e.target.value })} /></div>
                      <div><label htmlFor={`cc-c-${c.id}`} className="label">Closed</label><input id={`cc-c-${c.id}`} type="date" className="field" value={c.closedOn} onChange={(e) => updateCareCommunity(c.id, { closedOn: e.target.value })} /></div>
                    </div>
                    {c.status === 'Closed' && c.launchedOn && c.closedOn && <p className="mt-1 text-xs text-ink-soft">Served {day(c.launchedOn)} to {day(c.closedOn)}</p>}
                  </li>
                ))}
              </ul>
              {!openCc && <button className="btn-ghost mt-2" onClick={() => startCareCommunity(family.id)}>Start building a Care Community</button>}
            </div>
          </Panel>

          <Panel title="Prayer and notes">
            <div className="p-4">
              <label htmlFor="fd-prayer" className="label">Prayer request</label>
              <textarea id="fd-prayer" className="field" rows={2} value={prayer} onChange={(e) => setPrayer(e.target.value)} onBlur={() => prayer !== family.prayerRequest && updateFamily(family.id, { prayerRequest: prayer })} />
              <label htmlFor="fd-notes" className="label mt-3">Notes</label>
              <textarea id="fd-notes" className="field" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== family.notes && updateFamily(family.id, { notes })} />
              <p className="mt-1 text-xs text-ink-soft">These save when you click away.</p>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="At a glance">
            <div className="px-4 py-2">
              <Row label="Address">{address || cityLine ? <>{address}{address && cityLine && <br />}{cityLine}</> : 'Not recorded'}</Row>
              {family.county && <Row label="County">{family.county}</Row>}
              {family.maritalStatus && <Row label="Marital status">{family.maritalStatus}</Row>}
              <Row label="Last connected">{lc.reached ? ago(lc.reached) : 'Never'}</Row>
              {lc.attempt !== null && lc.attempt !== lc.reached && <Row label="Last attempt">{ago(lc.attempt)}</Row>}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
              <div>
                <label htmlFor="fd-status" className="label">Family status</label>
                <select id="fd-status" className="field" value={family.familyStatus} onChange={(e) => updateFamily(family.id, { familyStatus: e.target.value as FamilyStatus })}>
                  {FAMILY_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fd-care" className="label">Care</label>
                <select id="fd-care" className="field" value={family.careStatus} onChange={(e) => updateFamily(family.id, { careStatus: e.target.value as CareStatus })}>
                  {CARE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <span className="label">Home type</span>
                <HomeTypePicker value={family.homeTypes} onChange={(homeTypes) => updateFamily(family.id, { homeTypes })} />
              </div>
              <div className="col-span-2">
                <label htmlFor="fd-next" className="label">Next contact</label>
                <input id="fd-next" type="date" className="field" value={family.nextContactOn} onChange={(e) => updateFamily(family.id, { nextContactOn: e.target.value })} />
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="px-4 pb-4 [&>div]:mt-4"><ContactLog about={{ familyId: family.id }} entries={log} /></div>
          </Panel>
        </div>
      </div>
    </>
  );
}

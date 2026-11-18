'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ContactLog, lastContact } from '@/components/live/ContactLog';
import { FamilyLink, NotFound, PersonLink } from '@/components/live/links';
import { Badge, Panel, Row } from '@/components/ui';
import { useLive } from '@/lib/live/store';
import { CHURCH_ROLES, CHURCH_STATUSES, SERVING_STATUSES, careLabel, personName, type Church, type ChurchRole, type ChurchStatus } from '@/lib/live/types';
import { ago } from '@/lib/util';

const statusTone = (s: ChurchStatus) =>
  SERVING_STATUSES.includes(s) ? 'good' : s === 'Active Prospect' || s === 'Informed' ? 'brand' : s === 'On Hold' || s === 'Needs Re-engagement' ? 'warn' : s === 'Closed' || s === 'Not Interested' ? 'alert' : 'gray';

export default function ChurchPage() {
  const { id } = useParams<{ id: string }>();
  const { churches } = useLive();
  const church = churches.find((c) => c.id === id);
  if (!church) return <NotFound what="church" href="/live/churches" list="Churches" />;
  return <ChurchRecord key={church.id} church={church} />;
}

function ChurchRecord({ church }: { church: Church }) {
  const { staff, families, people, roles, careCommunities, interactions, updateChurch, addChurchPerson } = useLive();
  const log = interactions.filter((i) => i.churchId === church.id);
  const lc = lastContact(log);
  const served = families.filter((f) => f.servingChurchId === church.id && f.familyStatus !== 'Closed');
  const attending = families.filter((f) => f.homeChurchId === church.id && f.servingChurchId !== church.id && f.familyStatus !== 'Closed');
  const team = roles
    .filter((r) => r.churchId === church.id)
    .map((r) => ({ r, p: people.find((p) => p.id === r.personId) }))
    .sort((a, b) => CHURCH_ROLES.indexOf(a.r.role as ChurchRole) - CHURCH_ROLES.indexOf(b.r.role as ChurchRole) || personName(a.p).localeCompare(personName(b.p)));
  // People who attend here but hold no role at the church, for example parents in a family.
  const withRole = new Set(team.map((t) => t.r.personId));
  const attenders = people.filter((p) => p.homeChurchId === church.id && !withRole.has(p.id)).sort((a, b) => personName(a).localeCompare(personName(b)));

  const [nextStep, setNextStep] = useState(church.nextStep);
  const [activities, setActivities] = useState(church.famActivities.join(', '));
  const [notes, setNotes] = useState(church.notes);
  const [person, setPerson] = useState<{ firstName: string; lastName: string; email: string; phone: string; role: ChurchRole; title: string }>({ firstName: '', lastName: '', email: '', phone: '', role: 'Advocate', title: '' });
  const [addingPerson, setAddingPerson] = useState(false);
  const address = [church.street, [church.city, [church.state, church.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  const site = church.website && (/^https?:\/\//i.test(church.website) ? church.website : `https://${church.website}`);

  async function submitPerson(e: React.FormEvent) {
    e.preventDefault();
    if (await addChurchPerson(church.id, person)) {
      setPerson({ firstName: '', lastName: '', email: '', phone: '', role: person.role, title: '' });
      setAddingPerson(false);
    }
  }
  const saveActivities = () => {
    const list = activities.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.join('|') !== church.famActivities.join('|')) updateChurch(church.id, { famActivities: list });
  };

  return (
    <>
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Church</div>
        <h1 className="font-display text-4xl leading-none tracking-wide text-ink">{church.name}{church.campus && <span className="text-ink-soft"> · {church.campus}</span>}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={statusTone(church.status)}>{church.status}</Badge>
          {church.famActivities.map((a) => <Badge key={a} tone="brand">{a}</Badge>)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title={`People at this church (${team.length})`} action={!addingPerson && <button className="btn-ghost py-1" onClick={() => setAddingPerson(true)}>Add a person</button>}>
            {team.length === 0 && !addingPerson && <p className="p-4 text-sm text-ink-soft">No advocates, pastors or staff recorded yet.</p>}
            <ul className="divide-y divide-line">
              {team.map(({ r, p }) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span><PersonLink id={r.personId}>{personName(p) || 'Unnamed'}</PersonLink> <span className="text-ink-soft">· {r.role}{r.title ? `, ${r.title}` : ''}{r.status !== 'Active' ? ` · ${r.status}` : ''}</span></span>
                  <span className="text-ink-soft">
                    {p?.phone && <a className="underline" href={`tel:${p.phone}`}>{p.phone}</a>}
                    {p?.phone && p?.email && ' · '}
                    {p?.email && <a className="underline" href={`mailto:${p.email}`}>{p.email}</a>}
                  </span>
                </li>
              ))}
            </ul>
            {addingPerson && (
              <form onSubmit={submitPerson} className="grid grid-cols-2 gap-2 border-t border-line bg-paper p-4 sm:grid-cols-3">
                <div><label htmlFor="cp-fn" className="label">First name</label><input id="cp-fn" className="field" required value={person.firstName} onChange={(e) => setPerson({ ...person, firstName: e.target.value })} /></div>
                <div><label htmlFor="cp-ln" className="label">Last name</label><input id="cp-ln" className="field" value={person.lastName} onChange={(e) => setPerson({ ...person, lastName: e.target.value })} /></div>
                <div>
                  <label htmlFor="cp-role" className="label">Role</label>
                  <select id="cp-role" className="field" value={person.role} onChange={(e) => setPerson({ ...person, role: e.target.value as ChurchRole })}>
                    {CHURCH_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div><label htmlFor="cp-title" className="label">Title (optional)</label><input id="cp-title" className="field" placeholder="Lead Pastor" value={person.title} onChange={(e) => setPerson({ ...person, title: e.target.value })} /></div>
                <div><label htmlFor="cp-ph" className="label">Phone</label><input id="cp-ph" type="tel" className="field" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} /></div>
                <div><label htmlFor="cp-em" className="label">Email</label><input id="cp-em" type="email" className="field" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} /></div>
                <div className="col-span-2 flex gap-2 sm:col-span-3">
                  <button type="submit" className="btn-primary" disabled={!person.firstName.trim()}>Add</button>
                  <button type="button" className="btn-ghost" onClick={() => setAddingPerson(false)}>Cancel</button>
                </div>
              </form>
            )}
          </Panel>

          <Panel title={`Families served (${served.length})`}>
            {served.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft">This church is not serving a family yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {served.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span><FamilyLink id={f.id}>{f.name}</FamilyLink>{f.city && <span className="text-ink-soft"> · {f.city}</span>}</span>
                    <Badge tone="brand">{careLabel(f, careCommunities)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {(attending.length > 0 || attenders.length > 0) && (
            <Panel title="Who attends here">
              <ul className="divide-y divide-line">
                {attending.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span><FamilyLink id={f.id}>{f.name}</FamilyLink>{f.city && <span className="text-ink-soft"> · {f.city}</span>}</span>
                    <Badge>Family</Badge>
                  </li>
                ))}
              </ul>
              {attenders.length > 0 && (
                <p className="border-t border-line px-4 py-3 text-sm leading-relaxed">
                  {attenders.map((p, i) => <span key={p.id}>{i > 0 && ', '}<PersonLink id={p.id}>{personName(p)}</PersonLink></span>)}
                </p>
              )}
            </Panel>
          )}

          <Panel title="Notes">
            <div className="p-4">
              <textarea aria-label="Notes" className="field" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== church.notes && updateChurch(church.id, { notes })} />
              <p className="mt-1 text-xs text-ink-soft">Notes, next step and activities save when you click away.</p>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="At a glance">
            <div className="px-4 py-2">
              <Row label="Address">{address || 'Not recorded'}</Row>
              {church.county && <Row label="County">{church.county}</Row>}
              {site && <Row label="Website"><a className="underline" href={site} target="_blank" rel="noreferrer">{church.website}</a></Row>}
              <Row label="Last connected">{lc.reached ? ago(lc.reached) : 'Never'}</Row>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
              <div className="col-span-2">
                <label htmlFor="cd-status" className="label">Status</label>
                <select id="cd-status" className="field" value={church.status} onChange={(e) => updateChurch(church.id, { status: e.target.value as ChurchStatus })}>
                  {CHURCH_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cd-coach" className="label">FAM coach</label>
                <select id="cd-coach" className="field" value={church.coachId ?? ''} onChange={(e) => updateChurch(church.id, { coachId: e.target.value || null })}>
                  <option value="">None yet</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cd-pri" className="label">Coach priority</label>
                <select id="cd-pri" className="field" value={church.coachPriority} onChange={(e) => updateChurch(church.id, { coachPriority: e.target.value as 'Normal' | 'Low' })}>
                  <option>Normal</option><option>Low</option>
                </select>
              </div>
              <div>
                <label htmlFor="cd-agree" className="label">Agreement signed</label>
                <input id="cd-agree" type="date" className="field" value={church.agreementSignedOn} onChange={(e) => updateChurch(church.id, { agreementSignedOn: e.target.value })} />
              </div>
              <div>
                <label htmlFor="cd-start" className="label">FAM start date</label>
                <input id="cd-start" type="date" className="field" value={church.famStartedOn} onChange={(e) => updateChurch(church.id, { famStartedOn: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label htmlFor="cd-act" className="label">FAM activities (separate with commas)</label>
                <input id="cd-act" className="field" placeholder="Care Communities - Foster, CarePortal" value={activities} onChange={(e) => setActivities(e.target.value)} onBlur={saveActivities} />
              </div>
              <div className="col-span-2">
                <label htmlFor="cd-step" className="label">Next step</label>
                <input id="cd-step" className="field" value={nextStep} onChange={(e) => setNextStep(e.target.value)} onBlur={() => nextStep !== church.nextStep && updateChurch(church.id, { nextStep })} />
              </div>
              <div className="col-span-2">
                <label htmlFor="cd-next" className="label">Next contact</label>
                <input id="cd-next" type="date" className="field" value={church.nextContactOn} onChange={(e) => updateChurch(church.id, { nextContactOn: e.target.value })} />
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="px-4 pb-4 [&>div]:mt-4"><ContactLog about={{ churchId: church.id }} entries={log} /></div>
          </Panel>
        </div>
      </div>
    </>
  );
}

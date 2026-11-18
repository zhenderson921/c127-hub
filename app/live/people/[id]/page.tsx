'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ContactLog } from '@/components/live/ContactLog';
import { ChurchSelect } from '@/components/live/fields';
import { ChurchLink, FamilyLink, NotFound, PersonLink } from '@/components/live/links';
import { Badge, Panel } from '@/components/ui';
import { churchLabel } from '@/lib/live/match';
import { useLive } from '@/lib/live/store';
import { personName, type Person } from '@/lib/live/types';

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { people } = useLive();
  const person = people.find((p) => p.id === id);
  if (!person) return <NotFound what="person" href="/live/people" list="People" />;
  return <PersonRecord key={person.id} p={person} />;
}

function PersonRecord({ p }: { p: Person }) {
  const { churches, families, people, members, roles, interactions, updatePerson } = useLive();
  const [form, setForm] = useState({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, street: p.street, city: p.city, state: p.state, zip: p.zip, county: p.county, notes: p.notes });
  const churchById = new Map(churches.map((c) => [c.id, c]));
  const myFamilies = members.filter((m) => m.personId === p.id).map((m) => ({ m, f: families.find((f) => f.id === m.familyId) }));
  const myRoles = roles.filter((r) => r.personId === p.id);
  const log = interactions.filter((i) => i.personId === p.id);
  const home = p.homeChurchId ? churchById.get(p.homeChurchId) : undefined;
  const tags = [...new Set([...(myFamilies.length ? ['Family adult'] : []), ...myRoles.map((r) => r.role)])];

  // Each field saves when you click away from it, and only if it changed.
  const field = (k: keyof typeof form, label: string, extra: { type?: string; span?: string } = {}) => (
    <div className={extra.span ?? ''}>
      <label htmlFor={`pd-${k}`} className="label">{label}</label>
      <input
        id={`pd-${k}`}
        type={extra.type ?? 'text'}
        className="field"
        value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        onBlur={() => {
          if (form[k] === p[k]) return;
          if (k === 'firstName' && !form.firstName.trim()) return setForm({ ...form, firstName: p.firstName });
          updatePerson(p.id, { [k]: form[k] });
        }}
      />
    </div>
  );

  return (
    <>
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Person</div>
        <h1 className="font-display text-4xl leading-none tracking-wide text-ink">{personName(p)}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tags.length ? tags.map((t) => <Badge key={t} tone={t === 'Family adult' ? 'brand' : t === 'Advocate' || t === 'Point Person' ? 'good' : 'warn'}>{t}</Badge>) : <Badge>No tag yet</Badge>}
          {p.phone && <a className="btn-ghost py-1" href={`tel:${p.phone}`}>Call {p.phone}</a>}
          {p.email && <a className="btn-ghost py-1" href={`mailto:${p.email}`}>Email</a>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Connections">
            {myFamilies.length === 0 && myRoles.length === 0 && !home && <p className="p-4 text-sm text-ink-soft">Not linked to a family or a church yet.</p>}
            <ul className="divide-y divide-line">
              {myFamilies.map(({ m, f }) => {
                // The other adults in the same home, one click away.
                const others = members.filter((x) => x.familyId === m.familyId && x.personId !== p.id).map((x) => people.find((y) => y.id === x.personId)).filter((x): x is Person => !!x);
                const serving = f?.servingChurchId ? churchById.get(f.servingChurchId) : undefined;
                return (
                  <li key={m.familyId} className="px-4 py-3 text-sm">
                    <div>{m.relationship} in the <FamilyLink id={m.familyId}>{f?.name ?? 'family'}</FamilyLink>{m.isPrimary && <span className="text-ink-soft"> · main contact</span>}</div>
                    {others.length > 0 && <div className="mt-0.5 text-ink-soft">With {others.map((o, i) => <span key={o.id}>{i > 0 && ' and '}<PersonLink id={o.id}>{personName(o)}</PersonLink></span>)}</div>}
                    {serving && <div className="mt-0.5 text-ink-soft">Served by <ChurchLink id={serving.id}>{churchLabel(serving)}</ChurchLink></div>}
                  </li>
                );
              })}
              {myRoles.map((r) => {
                const c = r.churchId ? churchById.get(r.churchId) : undefined;
                return (
                  <li key={r.id} className="px-4 py-3 text-sm">
                    {r.role}{r.title ? `, ${r.title}` : ''}
                    {c ? <> at <ChurchLink id={c.id}>{churchLabel(c)}</ChurchLink></> : p.homeChurchText ? <> at &ldquo;{p.homeChurchText}&rdquo; <span className="text-warn">(to confirm on the Data check page)</span></> : null}
                    {r.status !== 'Active' && <span className="text-ink-soft"> · {r.status}</span>}
                  </li>
                );
              })}
              {home && <li className="px-4 py-3 text-sm">Attends <ChurchLink id={home.id}>{churchLabel(home)}</ChurchLink></li>}
            </ul>
          </Panel>

          <Panel title="Details">
            <div className="grid grid-cols-6 gap-2 p-4">
              {field('firstName', 'First name', { span: 'col-span-3' })}
              {field('lastName', 'Last name', { span: 'col-span-3' })}
              {field('phone', 'Phone', { type: 'tel', span: 'col-span-3' })}
              {field('email', 'Email', { type: 'email', span: 'col-span-3' })}
              {field('street', 'Street', { span: 'col-span-6' })}
              {field('city', 'City', { span: 'col-span-3' })}
              {field('state', 'State', { span: 'col-span-1' })}
              {field('zip', 'Zip', { span: 'col-span-2' })}
              {field('county', 'County', { span: 'col-span-3' })}
              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="pd-church" className="label">Home church (where they attend)</label>
                <ChurchSelect id="pd-church" value={p.homeChurchId} onChange={(homeChurchId) => updatePerson(p.id, { homeChurchId })} churches={churches} empty={p.homeChurchText ? `Not in the list: ${p.homeChurchText}` : 'None, or not in the list'} />
              </div>
              <div className="col-span-6">
                <label htmlFor="pd-notes" className="label">Notes</label>
                <textarea id="pd-notes" className="field" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} onBlur={() => form.notes !== p.notes && updatePerson(p.id, { notes: form.notes })} />
              </div>
              <p className="col-span-6 text-xs text-ink-soft">Each field saves when you click away from it.</p>
            </div>
          </Panel>
        </div>

        <div>
          <Panel>
            <div className="px-4 pb-4 [&>div]:mt-4"><ContactLog about={{ personId: p.id }} entries={log} /></div>
          </Panel>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { ContactLog, lastContact } from '@/components/live/ContactLog';
import { Badge, Drawer, PageHeader, Pager, Panel, Row } from '@/components/ui';
import { useLive, type NewAdult } from '@/lib/live/store';
import {
  CARE_STATUSES, CC_STATUSES, CHILD_RELATIONSHIPS, FAMILY_STATUSES, HOME_TYPES, MARITAL_STATUSES, MEMBER_RELATIONSHIPS, SERVING_STATUSES,
  ageBand, careLabel, personName,
  type CareStatus, type CcStatus, type ChildRelationship, type Church, type Family, type FamilyStatus, type HomeType, type MaritalStatus, type MemberRelationship,
} from '@/lib/live/types';
import { ago, daysSince, downloadCsv, fmtDateLong, num } from '@/lib/util';

const PER = 25;
const careTone = (label: string) => (label === 'Active Care Community' ? 'good' : label === 'Priority Care' ? 'alert' : label === 'Care Requested' || label === 'Building team' ? 'warn' : 'gray');
const day = (d: string) => (d ? fmtDateLong(new Date(`${d}T12:00:00`).getTime()) : '');

function ChurchSelect({ id, value, onChange, churches, empty }: { id: string; value: string | null; onChange: (v: string | null) => void; churches: Church[]; empty: string }) {
  return (
    <select id={id} className="field" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{empty}</option>
      {churches.map((c) => <option key={c.id} value={c.id}>{c.name}{c.campus ? ` (${c.campus})` : ''}</option>)}
    </select>
  );
}

function HomeTypePicker({ value, onChange }: { value: HomeType[]; onChange: (v: HomeType[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {HOME_TYPES.map((t) => (
        <label key={t} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={value.includes(t)} onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))} />
          {t}
        </label>
      ))}
    </div>
  );
}

export default function LiveFamiliesPage() {
  const { families, churches, people, members, children, careCommunities, interactions } = useLive();
  const [q, setQ] = useState('');
  const [care, setCare] = useState('All');
  const [type, setType] = useState('All');
  const [county, setCounty] = useState('All');
  const [conn, setConn] = useState('All');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // A link from the Data check page opens a family directly: /live/families?open=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setOpenId(id);
  }, []);

  const churchById = useMemo(() => Object.fromEntries(churches.map((c) => [c.id, c])), [churches]);
  const personById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const counties = useMemo(() => Array.from(new Set(families.map((f) => f.county).filter(Boolean))).sort(), [families]);
  const kidCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of children) if (c.inHome) m[c.familyId] = (m[c.familyId] || 0) + 1;
    return m;
  }, [children]);
  const contactBy = useMemo(() => {
    const groups: Record<string, typeof interactions> = {};
    for (const i of interactions) if (i.familyId) (groups[i.familyId] ||= []).push(i);
    return groups;
  }, [interactions]);
  const adultsBy = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mem of members) m[mem.familyId] = `${m[mem.familyId] ?? ''} ${personName(personById[mem.personId])} ${personById[mem.personId]?.email ?? ''}`;
    return m;
  }, [members, personById]);
  // First names under the family name, so two families with the same last name can be told apart.
  const firstNames = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const mem of [...members].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))) {
      const p = personById[mem.personId];
      if (p) (m[mem.familyId] ||= []).push(p.firstName);
    }
    return m;
  }, [members, personById]);
  const labels = useMemo(() => Object.fromEntries(families.map((f) => [f.id, careLabel(f, careCommunities)])), [families, careCommunities]);
  const careOptions = useMemo(() => Array.from(new Set(['Active Care Community', 'Building team', ...CARE_STATUSES, ...Object.values(labels)])), [labels]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return families.filter(
      (f) =>
        !(f.familyStatus === 'Closed' && care !== 'Closed families') &&
        (care === 'All' || care === 'Closed families' ? care === 'All' || f.familyStatus === 'Closed' : labels[f.id] === care) &&
        (type === 'All' || f.homeTypes.includes(type as HomeType)) &&
        (county === 'All' || f.county === county) &&
        (conn === 'All' || (conn === 'Served by a church' ? !!f.servingChurchId : !f.servingChurchId)) &&
        (!needle ||
          f.name.toLowerCase().includes(needle) ||
          f.city.toLowerCase().includes(needle) ||
          (adultsBy[f.id] ?? '').toLowerCase().includes(needle) ||
          (f.servingChurchId && churchById[f.servingChurchId]?.name.toLowerCase().includes(needle)) ||
          f.servingChurchText.toLowerCase().includes(needle) ||
          f.homeChurchText.toLowerCase().includes(needle) ||
          (f.homeChurchId && churchById[f.homeChurchId]?.name.toLowerCase().includes(needle))),
    );
  }, [families, q, care, type, county, conn, labels, adultsBy, churchById]);

  const pages = Math.ceil(rows.length / PER);
  const shown = rows.slice(page * PER, page * PER + PER);
  const open = families.find((f) => f.id === openId);
  const set = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <>
      <PageHeader title="Families" sub="Every family C127 walks alongside. This is the real list: what you add or change here is saved for the whole team.">
        <button
          className="btn-ghost"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv('c127-families.csv', [
              ['Family', 'Home type', 'Family status', 'Care', 'City', 'County', 'Children in home', 'Home church', 'Serving church', 'Last connected'],
              ...rows.map((f) => {
                const lc = lastContact(contactBy[f.id] ?? []);
                return [
                  f.name, f.homeTypes.join('/'), f.familyStatus, labels[f.id], f.city, f.county, kidCount[f.id] || 0,
                  f.homeChurchId ? churchById[f.homeChurchId]?.name ?? '' : f.homeChurchText, f.servingChurchId ? churchById[f.servingChurchId]?.name ?? '' : '',
                  lc.reached ? fmtDateLong(lc.reached) : '',
                ];
              }),
            ])
          }
        >
          Export this list
        </button>
        <button className="btn-primary" onClick={() => setAdding(true)}>Add a family</button>
      </PageHeader>

      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="lf-q" className="label">Search</label>
            <input id="lf-q" className="field" placeholder="Family, parent, city or church" value={q} onChange={(e) => set(() => setQ(e.target.value))} />
          </div>
          <div>
            <label htmlFor="lf-care" className="label">Care</label>
            <select id="lf-care" className="field" value={care} onChange={(e) => set(() => setCare(e.target.value))}>
              <option>All</option>
              {careOptions.map((c) => <option key={c}>{c}</option>)}
              <option>Closed families</option>
            </select>
          </div>
          <div>
            <label htmlFor="lf-type" className="label">Home type</label>
            <select id="lf-type" className="field" value={type} onChange={(e) => set(() => setType(e.target.value))}>
              <option>All</option>
              {HOME_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lf-county" className="label">County</label>
            <select id="lf-county" className="field" value={county} onChange={(e) => set(() => setCounty(e.target.value))}>
              <option>All</option>
              {counties.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lf-conn" className="label">Serving church</label>
            <select id="lf-conn" className="field" value={conn} onChange={(e) => set(() => setConn(e.target.value))}>
              <option>All</option><option>Served by a church</option><option>No serving church</option>
            </select>
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> {rows.length === 1 ? 'family' : 'families'}</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-paper">
              <tr><th className="th">Family</th><th className="th">Home type</th><th className="th">City</th><th className="th text-right">Children</th><th className="th">Care</th><th className="th">Home church</th><th className="th">Serving church</th><th className="th">Last connected</th></tr>
            </thead>
            <tbody>
              {shown.map((f) => {
                const lc = lastContact(contactBy[f.id] ?? []);
                const stale = lc.reached === null || daysSince(lc.reached) >= 30;
                return (
                  <tr key={f.id} onClick={() => setOpenId(f.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-light/50">
                    <td className="td">
                      <div className="font-semibold text-brand-deep">{f.name}{f.familyStatus !== 'Active' && <span className="ml-2"><Badge>{f.familyStatus}</Badge></span>}</div>
                      {firstNames[f.id] && <div className="text-xs text-ink-soft">{firstNames[f.id].join(' & ')}</div>}
                    </td>
                    <td className="td">{f.homeTypes.join(' / ') || <span className="text-ink-faint">Not set</span>}</td>
                    <td className="td">{f.city}</td>
                    <td className="td num text-right">{kidCount[f.id] || '–'}</td>
                    <td className="td"><Badge tone={careTone(labels[f.id])}>{labels[f.id]}</Badge></td>
                    <td className="td">{f.homeChurchId ? churchById[f.homeChurchId]?.name : f.homeChurchText ? <span className="text-ink-soft" title="As typed in the spreadsheet. Confirm which church it is on the Data check page.">&ldquo;{f.homeChurchText}&rdquo;</span> : <span className="text-ink-faint">–</span>}</td>
                    <td className="td">{f.servingChurchId ? churchById[f.servingChurchId]?.name : f.servingChurchText ? <span className="text-warn" title="As typed in the spreadsheet. Confirm which church it is on the Data check page.">&ldquo;{f.servingChurchText}&rdquo; to confirm</span> : <span className="text-ink-faint">None yet</span>}</td>
                    <td className={`td ${stale ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{lc.reached ? ago(lc.reached) : 'Never'}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={8} className="td py-10 text-center text-ink-soft">
                  {families.length === 0 ? 'No families yet. Add the first one, or import the family spreadsheet when the importer is ready.' : 'No families match those filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} onPage={setPage} />
      </Panel>

      <Drawer open={adding} onClose={() => setAdding(false)} title="Add a family">
        {adding && <AddFamily onDone={(id) => { setAdding(false); if (id) setOpenId(id); }} />}
      </Drawer>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        {open && <FamilyDetail key={open.id} family={open} />}
      </Drawer>
    </>
  );
}

const blankAdult = (relationship: MemberRelationship): NewAdult => ({ firstName: '', lastName: '', email: '', phone: '', relationship });

function AddFamily({ onDone }: { onDone: (id: string | null) => void }) {
  const { churches, addFamily } = useLive();
  const [adults, setAdults] = useState<NewAdult[]>([blankAdult('Mom'), blankAdult('Dad')]);
  const [name, setName] = useState('');
  const [homeTypes, setHomeTypes] = useState<HomeType[]>([]);
  const [marital, setMarital] = useState<MaritalStatus | ''>('');
  const [care, setCare] = useState<CareStatus>('Community & Prayer');
  const [addr, setAddr] = useState({ street: '', unit: '', city: '', state: 'FL', zip: '', county: '' });
  const [homeChurchId, setHomeChurchId] = useState<string | null>(null);
  const [homeChurchText, setHomeChurchText] = useState('');
  const [servingChurchId, setServingChurchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setAdult = (i: number, patch: Partial<NewAdult>) => setAdults((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // The family's name defaults to the first adult's last name, and can be typed over.
  const suggested = adults[0].lastName.trim() ? `${adults[0].lastName.trim()} family` : '';
  const finalName = name.trim() || suggested;
  const serving = churches.filter((c) => SERVING_STATUSES.includes(c.status));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalName) return;
    setBusy(true);
    const id = await addFamily({ name: finalName, adults, homeTypes, maritalStatus: marital, careStatus: care, ...addr, homeChurchId, homeChurchText: homeChurchId ? '' : homeChurchText, servingChurchId });
    setBusy(false);
    if (id) onDone(id);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {adults.map((a, i) => (
        <fieldset key={i} className="rounded-md border border-line p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{i === 0 ? 'Main contact' : 'Second adult (optional)'}</legend>
          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor={`af-fn${i}`} className="label">First name</label><input id={`af-fn${i}`} className="field" required={i === 0} value={a.firstName} onChange={(e) => setAdult(i, { firstName: e.target.value })} /></div>
            <div><label htmlFor={`af-ln${i}`} className="label">Last name</label><input id={`af-ln${i}`} className="field" value={a.lastName} onChange={(e) => setAdult(i, { lastName: e.target.value })} /></div>
            <div><label htmlFor={`af-ph${i}`} className="label">Phone</label><input id={`af-ph${i}`} className="field" type="tel" value={a.phone} onChange={(e) => setAdult(i, { phone: e.target.value })} /></div>
            <div><label htmlFor={`af-em${i}`} className="label">Email</label><input id={`af-em${i}`} className="field" type="email" value={a.email} onChange={(e) => setAdult(i, { email: e.target.value })} /></div>
            <div className="col-span-2">
              <label htmlFor={`af-rel${i}`} className="label">Role in the home</label>
              <select id={`af-rel${i}`} className="field" value={a.relationship} onChange={(e) => setAdult(i, { relationship: e.target.value as MemberRelationship })}>
                {MEMBER_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </fieldset>
      ))}

      <div>
        <label htmlFor="af-name" className="label">Family name</label>
        <input id="af-name" className="field" value={name} placeholder={suggested || 'For example, Rivera family'} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <span className="label">Home type (tick all that apply)</span>
        <HomeTypePicker value={homeTypes} onChange={setHomeTypes} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="af-mar" className="label">Marital status</label>
          <select id="af-mar" className="field" value={marital} onChange={(e) => setMarital(e.target.value as MaritalStatus | '')}>
            <option value="">Not set</option>
            {MARITAL_STATUSES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="af-care" className="label">Care</label>
          <select id="af-care" className="field" value={care} onChange={(e) => setCare(e.target.value as CareStatus)}>
            {CARE_STATUSES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="rounded-md border border-line p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Home address</legend>
        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-4"><label htmlFor="af-st" className="label">Street</label><input id="af-st" className="field" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></div>
          <div className="col-span-2"><label htmlFor="af-un" className="label">Apt / unit</label><input id="af-un" className="field" value={addr.unit} onChange={(e) => setAddr({ ...addr, unit: e.target.value })} /></div>
          <div className="col-span-3"><label htmlFor="af-ci" className="label">City</label><input id="af-ci" className="field" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></div>
          <div className="col-span-1"><label htmlFor="af-sa" className="label">State</label><input id="af-sa" className="field" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} /></div>
          <div className="col-span-2"><label htmlFor="af-zi" className="label">Zip</label><input id="af-zi" className="field" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} /></div>
          <div className="col-span-6"><label htmlFor="af-co" className="label">County</label><input id="af-co" className="field" value={addr.county} onChange={(e) => setAddr({ ...addr, county: e.target.value })} /></div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="af-home" className="label">Home church (where they attend)</label>
        <ChurchSelect id="af-home" value={homeChurchId} onChange={setHomeChurchId} churches={churches} empty="None, or not in the list" />
        {!homeChurchId && <input aria-label="Home church, if it is not in the list" className="field mt-2" placeholder="Type the church if it is not in the list" value={homeChurchText} onChange={(e) => setHomeChurchText(e.target.value)} />}
      </div>
      <div>
        <label htmlFor="af-serv" className="label">Serving church (whose FAM serves them)</label>
        <ChurchSelect id="af-serv" value={servingChurchId} onChange={setServingChurchId} churches={serving} empty="None yet" />
        {serving.length === 0 && <p className="mt-1 text-xs text-ink-soft">Only Engaged and Equipped churches can serve a family. None are in the list yet.</p>}
      </div>

      <button type="submit" disabled={busy || !finalName} className="btn-primary w-full">{busy ? 'Saving…' : 'Add this family'}</button>
    </form>
  );
}

function FamilyDetail({ family }: { family: Family }) {
  const { churches, people, members, children, careCommunities, interactions, updateFamily, addChild, removeChild, startCareCommunity, updateCareCommunity } = useLive();
  const churchById = useMemo(() => Object.fromEntries(churches.map((c) => [c.id, c])), [churches]);
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
      <div className="mb-3 flex flex-wrap gap-2">
        {family.homeTypes.map((t) => <Badge key={t} tone="brand">{t}</Badge>)}
        <Badge tone={family.familyStatus === 'Active' ? 'good' : 'gray'}>{family.familyStatus}</Badge>
        <Badge tone={careTone(label)}>{label}</Badge>
      </div>

      <h3 className="text-sm font-bold">Adults in the home</h3>
      {adults.length === 0 ? (
        <p className="mt-1 text-sm text-ink-soft">No adults recorded.</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {adults.map(({ m, p }) => (
            <li key={m.personId} className="py-2 text-sm">
              <div className="font-semibold">{personName(p)} <span className="font-normal text-ink-soft">· {m.relationship}{m.isPrimary ? ' · main contact' : ''}</span></div>
              <div className="text-ink-soft">
                {p?.phone && <a className="underline" href={`tel:${p.phone}`}>{p.phone}</a>}
                {p?.phone && p?.email && ' · '}
                {p?.email && <a className="underline" href={`mailto:${p.email}`}>{p.email}</a>}
                {!p?.phone && !p?.email && 'No phone or email yet'}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Row label="Address">{address || cityLine ? <>{address}{address && cityLine && <br />}{cityLine}</> : 'Not recorded'}</Row>
        {family.county && <Row label="County">{family.county}</Row>}
        {family.maritalStatus && <Row label="Marital status">{family.maritalStatus}</Row>}
        <Row label="Last connected">{lc.reached ? ago(lc.reached) : 'Never'}</Row>
        {lc.attempt !== null && lc.attempt !== lc.reached && <Row label="Last attempt">{ago(lc.attempt)}</Row>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
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
          <label htmlFor="fd-home" className="label">Home church (where they attend)</label>
          <ChurchSelect id="fd-home" value={family.homeChurchId} onChange={(homeChurchId) => updateFamily(family.id, { homeChurchId })} churches={churches} empty={family.homeChurchText ? `Not in the list: ${family.homeChurchText}` : 'None, or not in the list'} />
        </div>
        <div className="col-span-2">
          <label htmlFor="fd-serv" className="label">Serving church (whose FAM serves them)</label>
          <ChurchSelect id="fd-serv" value={family.servingChurchId} onChange={(servingChurchId) => updateFamily(family.id, { servingChurchId })} churches={serving} empty={family.servingChurchText ? `To confirm: ${family.servingChurchText}` : 'None yet'} />
        </div>
        <div className="col-span-2">
          <label htmlFor="fd-next" className="label">Next contact</label>
          <input id="fd-next" type="date" className="field" value={family.nextContactOn} onChange={(e) => updateFamily(family.id, { nextContactOn: e.target.value })} />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold">Children</h3>
        <p className="mt-0.5 text-xs text-ink-soft">First name and year of birth only. Ages are worked out, so they stay right as the children grow.</p>
        {kids.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {kids.map((c) => {
              const { age, band } = ageBand(c.birthYear);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span><span className="font-semibold">{c.firstName || 'Name not recorded'}</span> <span className="text-ink-soft">· {c.relationship} · {age === null ? c.notes || 'age unknown' : `about ${age}, ${band}`}</span></span>
                  <button className="text-xs text-ink-soft underline hover:text-alert" onClick={() => { if (window.confirm(`Remove ${c.firstName || 'this child'} from the family?`)) removeChild(c.id); }}>Remove</button>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={submitKid} className="mt-2 grid grid-cols-6 items-end gap-2">
          <div className="col-span-2"><label htmlFor="kid-n" className="label">First name</label><input id="kid-n" className="field" value={kid.firstName} onChange={(e) => setKid({ ...kid, firstName: e.target.value })} /></div>
          <div className="col-span-2"><label htmlFor="kid-y" className="label">Born (year)</label><input id="kid-y" className="field" type="number" min={1980} max={new Date().getFullYear()} placeholder="2019" value={kid.birthYear} onChange={(e) => setKid({ ...kid, birthYear: e.target.value })} /></div>
          <div className="col-span-2">
            <label htmlFor="kid-r" className="label">Type</label>
            <select id="kid-r" className="field" value={kid.relationship} onChange={(e) => setKid({ ...kid, relationship: e.target.value as ChildRelationship })}>
              {CHILD_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" disabled={!kid.firstName.trim() && !kid.birthYear} className="btn-ghost col-span-6">Add a child</button>
        </form>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold">Care Community</h3>
        {ccs.length === 0 && <p className="mt-1 text-sm text-ink-soft">This family has not had a Care Community.</p>}
        <ul className="mt-2 space-y-2">
          {ccs.map((c) => (
            <li key={c.id} className="rounded-md border border-line p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{c.churchId ? churchById[c.churchId]?.name ?? 'Church' : 'No church set'}</span>
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
        {!openCc && <button className="btn-ghost mt-2 w-full" onClick={() => startCareCommunity(family.id)}>Start building a Care Community</button>}
      </div>

      <ContactLog about={{ familyId: family.id }} entries={log} />

      <div className="mt-6">
        <label htmlFor="fd-prayer" className="label">Prayer request</label>
        <textarea id="fd-prayer" className="field" rows={2} value={prayer} onChange={(e) => setPrayer(e.target.value)} onBlur={() => prayer !== family.prayerRequest && updateFamily(family.id, { prayerRequest: prayer })} />
        <label htmlFor="fd-notes" className="label mt-3">Notes</label>
        <textarea id="fd-notes" className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== family.notes && updateFamily(family.id, { notes })} />
        <p className="mt-1 text-xs text-ink-soft">Prayer requests and notes save when you click away.</p>
      </div>
    </>
  );
}

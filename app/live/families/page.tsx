'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { lastContact } from '@/components/live/ContactLog';
import { DateFilter, fitsAll, toMs, type DateConditions } from '@/components/live/DateFilter';
import { ChurchSelect, HomeTypePicker } from '@/components/live/fields';
import { ChurchLink, FamilyLink } from '@/components/live/links';
import { SortTh, sortRows, type SortState } from '@/components/live/sort';
import { Badge, Drawer, PageHeader, Pager, Panel } from '@/components/ui';
import { useSticky } from '@/lib/live/sticky';
import { useLive, type NewAdult } from '@/lib/live/store';
import { CARE_STATUSES, HOME_TYPES, MARITAL_STATUSES, MEMBER_RELATIONSHIPS, SERVING_STATUSES, AGE_BANDS, careLabel, childBand, personName, type CareStatus, type HomeType, type MaritalStatus, type MemberRelationship } from '@/lib/live/types';
import { ago, daysSince, downloadCsv, fmtDateLong, num } from '@/lib/util';

const PER = 25;
const careTone = (label: string) => (label === 'Active Care Community' ? 'good' : label === 'Priority Care' ? 'alert' : label === 'Care Requested' || label === 'Building team' ? 'warn' : 'gray');

export default function LiveFamiliesPage() {
  const { families, churches, people, members, children, careCommunities, interactions } = useLive();
  const router = useRouter();
  // Search, filters and page are kept while you click into a family and come back.
  const [q, setQ] = useSticky('families.q', '');
  const [care, setCare] = useSticky('families.care', 'All');
  const [type, setType] = useSticky('families.type', 'All');
  const [county, setCounty] = useSticky('families.county', 'All');
  const [conn, setConn] = useSticky('families.conn', 'All');
  const [dates, setDates] = useSticky<DateConditions>('families.dates', {});
  const [kids, setKids] = useSticky('families.kids', 'Any');
  const [age, setAge] = useSticky('families.age', 'Any');
  const [sort, setSort] = useSticky<SortState>('families.sort', { by: 'family', dir: 1 });
  const [page, setPage] = useSticky('families.page', 0);
  const [adding, setAdding] = useState(false);

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

  // The age bands of the children in each home, for the "Child age" filter.
  const bandsBy = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const c of children) if (c.inHome) (m[c.familyId] ||= new Set()).add(childBand(c));
    return m;
  }, [children]);
  const kidsMatch = (n: number) => (kids === 'Any' ? true : kids === 'None' ? n === 0 : kids === '4 or more' ? n >= 4 : n === Number(kids));

  // The most recent Care Community launch for each family, for the date filter.
  const launchedBy = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of careCommunities) {
      const t = toMs(c.launchedOn);
      if (t !== null && t > (m[c.familyId] ?? 0)) m[c.familyId] = t;
    }
    return m;
  }, [careCommunities]);
  const datesOf = (f: (typeof families)[number]) => {
    const lc = lastContact(contactBy[f.id] ?? []);
    return { connected: lc.reached, attempt: lc.attempt, next: toMs(f.nextContactOn), added: toMs(f.createdAt), launched: launchedBy[f.id] ?? null };
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return families.filter(
      (f) =>
        !(f.familyStatus === 'Closed' && care !== 'Closed families') &&
        (care === 'All' || care === 'Closed families' ? care === 'All' || f.familyStatus === 'Closed' : labels[f.id] === care) &&
        (type === 'All' || f.homeTypes.includes(type as HomeType)) &&
        (county === 'All' || f.county === county) &&
        kidsMatch(kidCount[f.id] || 0) &&
        fitsAll(datesOf(f), dates) &&
        (age === 'Any' || !!bandsBy[f.id]?.has(age)) &&
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families, q, care, type, county, conn, kids, age, dates, labels, adultsBy, churchById, kidCount, bandsBy, contactBy, launchedBy]);

  const rows = useMemo(() => {
    const churchOf = (id: string | null, typed: string) => (id && churchById[id] ? churchById[id].name : typed);
    const get: Record<string, (f: (typeof families)[number]) => string | number | null> = {
      family: (f) => f.name,
      type: (f) => f.homeTypes.join(' / '),
      city: (f) => f.city,
      children: (f) => kidCount[f.id] || 0,
      care: (f) => labels[f.id],
      home: (f) => churchOf(f.homeChurchId, f.homeChurchText),
      serving: (f) => churchOf(f.servingChurchId, f.servingChurchText),
      last: (f) => lastContact(contactBy[f.id] ?? []).reached,
    };
    return sortRows(filtered, get[sort.by] ?? get.family, sort.dir);
  }, [filtered, sort, churchById, kidCount, labels, contactBy]);

  const pages = Math.ceil(rows.length / PER);
  const shown = rows.slice(page * PER, page * PER + PER);
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
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
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
          <div>
            <label htmlFor="lf-kids" className="label">Children in the home</label>
            <select id="lf-kids" className="field" value={kids} onChange={(e) => set(() => setKids(e.target.value))}>
              <option>Any</option><option>None</option><option>1</option><option>2</option><option>3</option><option>4 or more</option>
            </select>
          </div>
          <div>
            <label htmlFor="lf-age" className="label">Child age</label>
            <select id="lf-age" className="field" value={age} onChange={(e) => set(() => setAge(e.target.value))} title="Families with at least one child in this age band. Ages loaded from the spreadsheet are as it listed them.">
              <option>Any</option>
              {AGE_BANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <DateFilter
              fields={[{ key: 'connected', label: 'Last connected' }, { key: 'attempt', label: 'Last attempt to reach them' }, { key: 'next', label: 'Next contact', kind: 'ahead' }, { key: 'launched', label: 'Care Community launched' }, { key: 'added', label: 'Added to the hub' }]}
              value={dates}
              onChange={(v) => set(() => setDates(v))}
            />
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> {rows.length === 1 ? 'family' : 'families'}</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-paper">
              <tr>
                <SortTh col="family" label="Family" sort={sort} onSort={setSort} />
                <SortTh col="type" label="Home type" sort={sort} onSort={setSort} />
                <SortTh col="city" label="City" sort={sort} onSort={setSort} />
                <SortTh col="children" label="Children" sort={sort} onSort={setSort} right />
                <SortTh col="care" label="Care" sort={sort} onSort={setSort} />
                <SortTh col="home" label="Home church" sort={sort} onSort={setSort} />
                <SortTh col="serving" label="Serving church" sort={sort} onSort={setSort} />
                <SortTh col="last" label="Last connected" sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => {
                const lc = lastContact(contactBy[f.id] ?? []);
                const stale = lc.reached === null || daysSince(lc.reached) >= 30;
                return (
                  <tr key={f.id} onClick={() => router.push(`/live/families/${f.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-light/50">
                    <td className="td">
                      <div><FamilyLink id={f.id}>{f.name}</FamilyLink>{f.familyStatus !== 'Active' && <span className="ml-2"><Badge>{f.familyStatus}</Badge></span>}</div>
                      {firstNames[f.id] && <div className="text-xs text-ink-soft">{firstNames[f.id].join(' & ')}</div>}
                    </td>
                    <td className="td">{f.homeTypes.join(' / ') || <span className="text-ink-faint">Not set</span>}</td>
                    <td className="td">{f.city}</td>
                    <td className="td num text-right">{kidCount[f.id] || '–'}</td>
                    <td className="td"><Badge tone={careTone(labels[f.id])}>{labels[f.id]}</Badge></td>
                    <td className="td">{f.homeChurchId && churchById[f.homeChurchId] ? <ChurchLink id={f.homeChurchId}>{churchById[f.homeChurchId].name}</ChurchLink> : f.homeChurchText ? <span className="text-ink-soft" title="As typed in the spreadsheet. Confirm which church it is on the Data check page.">&ldquo;{f.homeChurchText}&rdquo;</span> : <span className="text-ink-faint">–</span>}</td>
                    <td className="td">{f.servingChurchId && churchById[f.servingChurchId] ? <ChurchLink id={f.servingChurchId}>{churchById[f.servingChurchId].name}</ChurchLink> : f.servingChurchText ? <span className="text-warn" title="As typed in the spreadsheet. Confirm which church it is on the Data check page.">&ldquo;{f.servingChurchText}&rdquo; to confirm</span> : <span className="text-ink-faint">None yet</span>}</td>
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
        {adding && <AddFamily onDone={(id) => { setAdding(false); if (id) router.push(`/live/families/${id}`); }} />}
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

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChurchLink, PersonLink } from '@/components/live/links';
import { Badge, PageHeader, Pager, Panel } from '@/components/ui';
import { churchLabel } from '@/lib/live/match';
import { useSticky } from '@/lib/live/sticky';
import { useLive } from '@/lib/live/store';
import { personName, type Person } from '@/lib/live/types';
import { downloadCsv, num } from '@/lib/util';

// Every adult C127 knows, whatever they are to C127: a parent, an advocate, a
// pastor, a donor. One row per person, with filters that can be combined.

const PER = 50;
const NO_CHURCH = '__none';
const TO_CONFIRM = '__typed';
const NO_TAG = 'No tag yet';
type FilterKey = 'tags' | 'churches' | 'homeTypes' | 'counties' | 'cities' | 'contact';
const FILTERS: { key: FilterKey; label: string; search?: boolean }[] = [
  { key: 'tags', label: 'Tag or role' },
  { key: 'churches', label: 'Church', search: true },
  { key: 'homeTypes', label: 'Home type' },
  { key: 'counties', label: 'County' },
  { key: 'cities', label: 'City', search: true },
  { key: 'contact', label: 'Contact details' },
];
const CONTACT = ['Has an email', 'No email', 'Has a phone', 'No phone'];
const tagTone = (t: string) => (t === 'Family adult' ? 'brand' : t === 'Advocate' || t === 'Point Person' ? 'good' : t === NO_TAG ? 'gray' : 'warn');

interface Row {
  p: Person;
  tags: string[];
  homeTypes: string[];
  churchIds: string[];
  churchText: string; // what to show in the Church column
  sortChurch: string;
}
interface Option {
  value: string;
  label: string;
  count: number;
}

/** A filter button that opens a tick-list. Ticking several means "any of these". */
function FilterMenu({ label, options, selected, onChange, search }: { label: string; options: Option[]; selected: string[]; onChange: (v: string[]) => void; search?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const shown = options.filter((o) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold ${selected.length ? 'border-brand bg-brand-light text-brand-deep' : 'border-line bg-white text-ink hover:border-brand'}`}
      >
        {label}
        {selected.length > 0 && <span className="num rounded-full bg-brand px-1.5 text-xs text-white">{selected.length}</span>}
        <span aria-hidden className="text-xs text-ink-soft">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-72 rounded-md border border-line bg-white shadow-xl">
          {search && (
            <div className="border-b border-line p-2">
              <input autoFocus aria-label={`Search ${label.toLowerCase()}`} className="field" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto py-1">
            {shown.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-brand-light/60">
                  <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  <span className="num text-xs text-ink-soft">{num(o.count)}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">Nothing matches.</li>}
          </ul>
          {selected.length > 0 && (
            <div className="border-t border-line p-2 text-right">
              <button className="text-xs font-semibold text-brand-dark underline" onClick={() => onChange([])}>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LivePeoplePage() {
  const { people, churches, families, members, roles } = useLive();
  const router = useRouter();
  // Search, filters, sorting and page are kept while you click into a person and come back.
  const [q, setQ] = useSticky('people.q', '');
  const [filters, setFilters] = useSticky<Record<FilterKey, string[]>>('people.filters', { tags: [], churches: [], homeTypes: [], counties: [], cities: [], contact: [] });
  const [sort, setSort] = useSticky<{ by: 'name' | 'church' | 'city'; dir: 1 | -1 }>('people.sort', { by: 'name', dir: 1 });
  const [page, setPage] = useSticky('people.page', 0);

  const churchName = useMemo(() => new Map(churches.map((c) => [c.id, churchLabel(c)])), [churches]);

  // One row per person, with everything the filters need worked out once.
  const rows = useMemo<Row[]>(() => {
    const familyById = new Map(families.map((f) => [f.id, f]));
    const famOf = new Map<string, string[]>();
    for (const m of members) famOf.set(m.personId, [...(famOf.get(m.personId) ?? []), m.familyId]);
    const rolesOf = new Map<string, typeof roles>();
    for (const r of roles) rolesOf.set(r.personId, [...(rolesOf.get(r.personId) ?? []), r]);
    return people.map((p) => {
      const fams = (famOf.get(p.id) ?? []).map((id) => familyById.get(id)).filter((f) => !!f);
      const mine = rolesOf.get(p.id) ?? [];
      const tags = [...new Set([...(fams.length ? ['Family adult'] : []), ...mine.map((r) => r.role)])];
      const churchIds = [...new Set([...mine.map((r) => r.churchId), p.homeChurchId].filter((id): id is string => !!id))];
      const named = churchIds.map((id) => churchName.get(id) ?? '').filter(Boolean);
      return {
        p,
        tags: tags.length ? tags : [NO_TAG],
        homeTypes: [...new Set(fams.flatMap((f) => f.homeTypes))],
        churchIds,
        churchText: named.join(', '),
        sortChurch: (named[0] ?? p.homeChurchText ?? '').toLowerCase(),
      };
    });
  }, [people, families, members, roles, churchName]);

  // The choices each filter offers, with how many people each one covers.
  const options = useMemo<Record<FilterKey, Option[]>>(() => {
    const tally = (pick: (r: Row) => string[]) => {
      const m = new Map<string, number>();
      for (const r of rows) for (const v of pick(r)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    const list = (m: Map<string, number>, label: (v: string) => string = (v) => v) => [...m].map(([value, count]) => ({ value, label: label(value), count }));
    const byCount = (a: Option, b: Option) => b.count - a.count || a.label.localeCompare(b.label);
    const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);
    return {
      tags: list(tally((r) => r.tags)).sort(byCount),
      churches: [
        ...list(tally((r) => r.churchIds), (id) => churchName.get(id) ?? 'Church').sort(byLabel),
        { value: TO_CONFIRM, label: 'Church typed, to confirm', count: rows.filter((r) => !r.churchIds.length && r.p.homeChurchText).length },
        { value: NO_CHURCH, label: 'No church recorded', count: rows.filter((r) => !r.churchIds.length && !r.p.homeChurchText).length },
      ],
      homeTypes: list(tally((r) => r.homeTypes)).sort(byCount),
      counties: list(tally((r) => [r.p.county])).sort(byCount),
      cities: list(tally((r) => [r.p.city])).sort(byLabel),
      contact: CONTACT.map((c) => ({ value: c, label: c, count: rows.filter((r) => hasContact(r.p, c)).length })),
    };
  }, [rows, churchName]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    const any = (picked: string[], have: string[]) => picked.length === 0 || picked.some((v) => have.includes(v));
    const out = rows.filter(
      (r) =>
        any(filters.tags, r.tags) &&
        any(filters.homeTypes, r.homeTypes) &&
        any(filters.counties, [r.p.county]) &&
        any(filters.cities, [r.p.city]) &&
        (filters.churches.length === 0 ||
          filters.churches.some((v) => (v === NO_CHURCH ? !r.churchIds.length && !r.p.homeChurchText : v === TO_CONFIRM ? !r.churchIds.length && !!r.p.homeChurchText : r.churchIds.includes(v)))) &&
        // Contact details narrow the list: ticking "Has an email" and "Has a phone" means both.
        filters.contact.every((c) => hasContact(r.p, c)) &&
        (!needle ||
          personName(r.p).toLowerCase().includes(needle) ||
          r.p.email.toLowerCase().includes(needle) ||
          (digits.length >= 3 && r.p.phone.replace(/\D/g, '').includes(digits)) ||
          r.churchText.toLowerCase().includes(needle) ||
          r.p.homeChurchText.toLowerCase().includes(needle)),
    );
    const key = (r: Row) => (sort.by === 'name' ? `${r.p.lastName} ${r.p.firstName}`.toLowerCase() : sort.by === 'church' ? r.sortChurch || '￿' : r.p.city.toLowerCase() || '￿');
    return out.sort((a, b) => key(a).localeCompare(key(b)) * sort.dir || personName(a.p).localeCompare(personName(b.p)));
  }, [rows, q, filters, sort]);

  const pages = Math.ceil(shown.length / PER);
  const visible = shown.slice(page * PER, page * PER + PER);
  const active = FILTERS.flatMap((f) => filters[f.key].map((v) => ({ key: f.key, value: v, label: `${f.label}: ${options[f.key].find((o) => o.value === v)?.label ?? v}` })));
  const setFilter = (key: FilterKey, v: string[]) => {
    setFilters((f) => ({ ...f, [key]: v }));
    setPage(0);
  };
  const header = (by: 'name' | 'church' | 'city', label: string) => (
    <th className="th" aria-sort={sort.by === by ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="flex items-center gap-1 uppercase tracking-wide hover:text-ink" onClick={() => setSort((s) => ({ by, dir: s.by === by && s.dir === 1 ? -1 : 1 }))}>
        {label}
        <span aria-hidden className={sort.by === by ? 'text-ink' : 'text-ink-faint'}>{sort.by === by && sort.dir === -1 ? '▴' : '▾'}</span>
      </button>
    </th>
  );

  return (
    <>
      <PageHeader title="People" sub="Every adult C127 knows, one record each: parents, advocates, pastors and church staff. Combine the filters to pull any list you need.">
        <button
          className="btn-ghost"
          disabled={shown.length === 0}
          onClick={() =>
            downloadCsv('c127-people.csv', [
              ['First name', 'Last name', 'Tags', 'Church', 'Email', 'Phone', 'Street', 'City', 'State', 'Zip', 'County'],
              ...shown.map((r) => [r.p.firstName, r.p.lastName, r.tags.join('; '), r.churchText || r.p.homeChurchText, r.p.email, r.p.phone, r.p.street, r.p.city, r.p.state, r.p.zip, r.p.county]),
            ])
          }
        >
          Export this list
        </button>
      </PageHeader>

      <Panel>
        <div className="space-y-3 border-b border-line p-4">
          <input aria-label="Search people" className="field max-w-md" placeholder="Search by name, email, phone or church" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <FilterMenu key={f.key} label={f.label} search={f.search} options={options[f.key]} selected={filters[f.key]} onChange={(v) => setFilter(f.key, v)} />
            ))}
          </div>
          {active.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {active.map((a) => (
                <button key={`${a.key}:${a.value}`} onClick={() => setFilter(a.key, filters[a.key].filter((v) => v !== a.value))} className="flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-deep hover:bg-brand hover:text-white" title="Remove this filter">
                  {a.label} <span aria-hidden>×</span>
                </button>
              ))}
              <button className="ml-1 text-xs font-semibold text-ink-soft underline" onClick={() => { setFilters({ tags: [], churches: [], homeTypes: [], counties: [], cities: [], contact: [] }); setPage(0); }}>Clear all</button>
            </div>
          )}
        </div>
        <div className="px-4 py-2 text-xs text-ink-soft">
          <span className="num font-semibold text-ink">{num(shown.length)}</span> {shown.length === 1 ? 'person' : 'people'}
          {shown.length !== rows.length && <> of {num(rows.length)}</>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-paper">
              <tr>{header('name', 'Name')}<th className="th">Tags</th>{header('church', 'Church')}<th className="th">Email</th><th className="th">Phone</th>{header('city', 'City')}</tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.p.id} onClick={() => router.push(`/live/people/${r.p.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-light/50">
                  <td className="td"><PersonLink id={r.p.id}>{personName(r.p) || 'Unnamed'}</PersonLink></td>
                  <td className="td"><div className="flex flex-wrap gap-1">{r.tags.map((t) => <Badge key={t} tone={tagTone(t)}>{t}</Badge>)}</div></td>
                  <td className="td">{r.churchIds.length ? r.churchIds.map((id, i) => <span key={id}>{i > 0 && ', '}<ChurchLink id={id}>{churchName.get(id) ?? 'Church'}</ChurchLink></span>) : (r.p.homeChurchText ? <span className="text-warn" title="As typed in the spreadsheet. Confirm which church it is on the Data check page.">&ldquo;{r.p.homeChurchText}&rdquo; to confirm</span> : <span className="text-ink-faint">–</span>)}</td>
                  <td className="td">{r.p.email || <span className="text-ink-faint">–</span>}</td>
                  <td className="td num whitespace-nowrap">{r.p.phone || <span className="text-ink-faint">–</span>}</td>
                  <td className="td">{r.p.city}</td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-ink-soft">{rows.length === 0 ? 'No people yet.' : 'Nobody matches that search and those filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} onPage={setPage} />
      </Panel>

    </>
  );
}

function hasContact(p: Person, c: string): boolean {
  if (c === 'Has an email') return !!p.email;
  if (c === 'No email') return !p.email;
  if (c === 'Has a phone') return !!p.phone;
  return !p.phone;
}

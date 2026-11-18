'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { churchLabel, core, matchName, norm, type Confidence } from '@/lib/live/match';
import { useLive } from '@/lib/live/store';
import { personName, type Church, type Family, type Person } from '@/lib/live/types';
import { num } from '@/lib/util';

// The Data check page. Everything from the spreadsheets is already loaded; this
// lists the parts a person should confirm, most useful first. Nothing here has
// to be finished before the hub can be used.

const TABS = ['Church names', 'Same person?', 'Same family?', 'Same church?', 'Missing details'] as const;
type Tab = (typeof TABS)[number];

const CONFIDENCE: Record<Confidence, { label: string; tone: 'good' | 'warn' | 'gray' }> = {
  likely: { label: 'Likely the same', tone: 'good' },
  possible: { label: 'Possibly the same', tone: 'warn' },
  none: { label: 'No close match', tone: 'gray' },
};
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const pairKey = (ids: string[]) => [...ids].sort().join(':');

interface NameItem {
  key: string;
  name: string;
  home: number;
  serving: number;
  advocates: number;
  confidence: Confidence;
  candidates: Church[];
}

export default function DataCheckPage() {
  const { families, churches, people, members, roles, children, dismissed } = useLive();
  const [tab, setTab] = useState<Tab>('Church names');
  const gone = useMemo(() => new Set(dismissed), [dismissed]);

  // Church names still as typed, grouped so one answer fixes every record that uses the name.
  const names = useMemo<NameItem[]>(() => {
    const waiting = new Set(roles.filter((r) => !r.churchId && (r.role === 'Advocate' || r.role === 'Point Person')).map((r) => r.personId));
    const m = new Map<string, NameItem>();
    const add = (typed: string, field: 'home' | 'serving' | 'advocates') => {
      const key = typed.trim().toLowerCase();
      if (!key || gone.has(`church_name:${key}`)) return;
      const item = m.get(key) ?? { key, name: typed.trim(), home: 0, serving: 0, advocates: 0, confidence: 'none' as Confidence, candidates: [] };
      item[field] += 1;
      m.set(key, item);
    };
    for (const f of families) {
      if (!f.homeChurchId && f.homeChurchText) add(f.homeChurchText, 'home');
      if (!f.servingChurchId && f.servingChurchText) add(f.servingChurchText, 'serving');
    }
    for (const p of people) if (!p.homeChurchId && p.homeChurchText && waiting.has(p.id)) add(p.homeChurchText, 'advocates');
    const order: Record<Confidence, number> = { likely: 0, possible: 1, none: 2 };
    return [...m.values()]
      .map((item) => ({ ...item, ...matchName(item.name, churches) }))
      // Names that hold something up (a serving church, an advocate) come first, then the easy ones.
      .sort((a, b) => Number(b.serving + b.advocates > 0) - Number(a.serving + a.advocates > 0) || order[a.confidence] - order[b.confidence] || b.home + b.serving + b.advocates - (a.home + a.serving + a.advocates));
  }, [families, people, roles, churches, gone]);

  // People with the same first and last name.
  const peopleGroups = useMemo(() => {
    const m = new Map<string, Person[]>();
    for (const p of people) {
      if (!p.lastName.trim()) continue;
      const k = `${norm(p.firstName)}|${norm(p.lastName)}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.values()]
      .filter((g) => g.length > 1 && !gone.has(`people:${pairKey(g.map((p) => p.id))}`))
      .map((g) => {
        const shares = (pick: (p: Person) => string) => {
          const vals = g.map((p) => pick(p).toLowerCase().replace(/\s+/g, '')).filter(Boolean);
          return new Set(vals).size < vals.length;
        };
        const likely = shares((p) => p.email) || shares((p) => p.phone.replace(/\D/g, '')) || shares((p) => (p.street ? `${p.street}${p.zip}` : ''));
        return { people: g, likely };
      })
      .sort((a, b) => Number(b.likely) - Number(a.likely));
  }, [people, gone]);

  // Families at the same address, or with the same main contact email.
  const familyPairs = useMemo(() => {
    const personById = new Map(people.map((p) => [p.id, p]));
    const primaryEmail = new Map<string, string>();
    for (const mem of members) if (mem.isPrimary) primaryEmail.set(mem.familyId, personById.get(mem.personId)?.email.toLowerCase() ?? '');
    const groups = new Map<string, Family[]>();
    const add = (k: string, f: Family) => groups.set(k, [...(groups.get(k) ?? []), f]);
    for (const f of families) {
      if (f.street) add(`addr|${norm(f.street)}|${f.zip}`, f);
      if (primaryEmail.get(f.id)) add(`email|${primaryEmail.get(f.id)}`, f);
    }
    const seen = new Set<string>();
    const out: { families: Family[]; why: string; likely: boolean }[] = [];
    for (const [k, g] of groups) {
      if (g.length < 2) continue;
      const key = pairKey(g.map((f) => f.id));
      if (seen.has(key) || gone.has(`families:${key}`)) continue;
      seen.add(key);
      out.push({ families: g, why: k.startsWith('addr') ? 'Same home address' : 'Same main contact email', likely: new Set(g.map((f) => norm(f.name))).size === 1 });
    }
    return out;
  }, [families, members, people, gone]);

  // Churches at the same street address, or with the same name once filler words are dropped.
  const churchPairs = useMemo(() => {
    const groups = new Map<string, Church[]>();
    const add = (k: string, c: Church) => groups.set(k, [...(groups.get(k) ?? []), c]);
    for (const c of churches) {
      if (c.street) add(`addr|${norm(c.street)}|${c.zip}`, c);
      add(`name|${core(c.name)}|${norm(c.campus)}`, c);
    }
    const seen = new Set<string>();
    const out: { churches: Church[]; why: string; likely: boolean }[] = [];
    for (const [k, g] of groups) {
      if (g.length < 2) continue;
      const key = pairKey(g.map((c) => c.id));
      if (seen.has(key) || gone.has(`churches:${key}`)) continue;
      seen.add(key);
      out.push({ churches: g, why: k.startsWith('addr') ? 'Same street address' : 'Same name', likely: k.startsWith('name') });
    }
    return out;
  }, [churches, gone]);

  const missing = useMemo(() => {
    const open = families.filter((f) => f.familyStatus !== 'Closed');
    const withKids = new Set(children.map((c) => c.familyId));
    const withAdults = new Set(members.map((m) => m.familyId));
    return [
      { label: 'Families with no home type', list: open.filter((f) => f.homeTypes.length === 0) },
      { label: 'Families with no adult named', list: open.filter((f) => !withAdults.has(f.id)) },
      { label: 'Families with no home address', list: open.filter((f) => !f.street) },
      { label: 'Families with no county', list: open.filter((f) => !f.county) },
      { label: 'Families with no children recorded', list: open.filter((f) => !withKids.has(f.id)) },
    ].filter((g) => g.list.length > 0);
  }, [families, children, members]);

  const counts: Record<Tab, number> = {
    'Church names': names.length,
    'Same person?': peopleGroups.length,
    'Same family?': familyPairs.length,
    'Same church?': churchPairs.length,
    'Missing details': missing.reduce((s, g) => s + g.list.length, 0),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Data check"
        sub="Everything from the spreadsheets is loaded. These are the places where a person who knows the churches and families can confirm what the spreadsheet meant. Do them as you are able: nothing here has to be finished first."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg border px-3 py-2 text-left ${tab === t ? 'border-brand bg-brand-light' : 'border-line bg-white hover:border-brand'}`}>
            <div className="num font-display text-3xl leading-none">{num(counts[t])}</div>
            <div className="mt-1 text-xs font-semibold text-ink-soft">{t}</div>
          </button>
        ))}
      </div>

      {total === 0 && <Panel><p className="p-6 text-center text-sm text-ink-soft">Nothing needs checking right now.</p></Panel>}
      {tab === 'Church names' && total > 0 && <ChurchNames items={names} churches={churches} />}
      {tab === 'Same person?' && total > 0 && <SamePeople groups={peopleGroups} />}
      {tab === 'Same family?' && total > 0 && (
        <Pairs
          empty="No two families look alike."
          intro="These families share an address or a main contact email. If they are two records of one family, tell Zane which to keep: joining two families is not built yet."
          items={familyPairs.map((p) => ({ key: pairKey(p.families.map((f) => f.id)), kind: 'families' as const, why: p.why, likely: p.likely, rows: p.families.map((f) => ({ id: f.id, title: f.name, detail: [f.street, f.city].filter(Boolean).join(', '), href: `/live/families?open=${f.id}` })) }))}
        />
      )}
      {tab === 'Same church?' && total > 0 && (
        <Pairs
          empty="No two churches look alike."
          intro="These churches share a name or a street address. Two campuses of one church are fine: say they are different and they will stop showing here."
          items={churchPairs.map((p) => ({ key: pairKey(p.churches.map((c) => c.id)), kind: 'churches' as const, why: p.why, likely: p.likely, rows: p.churches.map((c) => ({ id: c.id, title: churchLabel(c), detail: [c.street, c.city].filter(Boolean).join(', '), href: '/live/churches' })) }))}
        />
      )}
      {tab === 'Missing details' && total > 0 && <Missing groups={missing} />}
    </>
  );
}

function ChurchNames({ items, churches }: { items: NameItem[]; churches: Church[] }) {
  const [filter, setFilter] = useState<'all' | Confidence>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const shown = items.filter((i) => (filter === 'all' || i.confidence === filter) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())));
  const count = (c: Confidence) => items.filter((i) => i.confidence === c).length;

  return (
    <Panel>
      <div className="border-b border-line p-4">
        <p className="max-w-3xl text-sm text-ink-soft">
          The spreadsheets name churches in shorthand. Each name below is kept exactly as it was typed until someone says which church it is. One answer fixes every family and advocate that uses the name, and the hub remembers it for next time.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {([['all', `All ${items.length}`], ['likely', `Likely the same ${count('likely')}`], ['possible', `Possibly the same ${count('possible')}`], ['none', `No close match ${count('none')}`]] as const).map(([v, label]) => (
              <button key={v} aria-pressed={filter === v} onClick={() => { setFilter(v); setLimit(30); }} className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === v ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}>
                {label}
              </button>
            ))}
          </div>
          <input aria-label="Search the names" className="field max-w-xs" placeholder="Search the names" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {shown.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">{items.length === 0 ? 'Every church name is matched.' : 'No names match that filter.'}</p>}
      <ul className="divide-y divide-line">
        {shown.slice(0, limit).map((item) => <NameRow key={item.key} item={item} churches={churches} />)}
      </ul>
      {shown.length > limit && <div className="border-t border-line p-3 text-center"><button className="btn-ghost" onClick={() => setLimit(limit + 30)}>Show 30 more of {shown.length - limit}</button></div>}
    </Panel>
  );
}

function NameRow({ item, churches }: { item: NameItem; churches: Church[] }) {
  const { matchChurchName, addChurchFromName, dismiss } = useLive();
  // A likely match is filled in ready to confirm. A possible one is left for the person to choose.
  const [choice, setChoice] = useState(item.confidence === 'likely' ? item.candidates[0].id : '');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const others = churches.filter((c) => !item.candidates.some((x) => x.id === c.id));
  const uses = [item.serving && `serving church for ${plural(item.serving, 'family', 'families')}`, item.advocates && `church of ${plural(item.advocates, 'advocate')}`, item.home && `home church for ${plural(item.home, 'family', 'families')}`].filter(Boolean).join(' · ');
  const c = CONFIDENCE[item.confidence];

  return (
    <li className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">&ldquo;{item.name}&rdquo;</span>
          <Badge tone={c.tone}>{c.label}</Badge>
        </div>
        <div className="mt-0.5 text-xs text-ink-soft">Typed as the {uses}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Which church is ${item.name}?`} className="field min-w-0 flex-1 basis-56" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Choose the church…</option>
          {item.candidates.length > 0 && (
            <optgroup label="Closest">
              {item.candidates.map((x) => <option key={x.id} value={x.id}>{churchLabel(x)}{x.city ? `, ${x.city}` : ''}</option>)}
            </optgroup>
          )}
          <optgroup label="All churches">
            {others.map((x) => <option key={x.id} value={x.id}>{churchLabel(x)}{x.city ? `, ${x.city}` : ''}</option>)}
          </optgroup>
        </select>
        <button className="btn-primary" disabled={busy || !choice} onClick={() => run(() => matchChurchName(item.name, choice))}>Same church</button>
        <button className="btn-ghost" disabled={busy} onClick={() => run(() => addChurchFromName(item.name))} title="Adds this name to the church list as a potential prospect">Add as new</button>
        <button className="btn-ghost" disabled={busy} onClick={() => run(() => dismiss('church_name', item.key))} title="Leaves the name as typed and stops asking">Leave as typed</button>
      </div>
    </li>
  );
}

function SamePeople({ groups }: { groups: { people: Person[]; likely: boolean }[] }) {
  const { families, members, roles, churches, mergePeople, dismiss } = useLive();
  const [busy, setBusy] = useState('');
  const familyName = new Map(families.map((f) => [f.id, f.name]));
  const churchName = new Map(churches.map((c) => [c.id, churchLabel(c)]));
  const about = (p: Person) =>
    [
      ...members.filter((m) => m.personId === p.id).map((m) => `${m.relationship} in the ${familyName.get(m.familyId) ?? 'family'}`),
      ...roles.filter((r) => r.personId === p.id).map((r) => `${r.role}${r.churchId ? ` at ${churchName.get(r.churchId) ?? 'a church'}` : p.homeChurchText ? ` at "${p.homeChurchText}"` : ''}`),
    ].join(' · ') || 'No family or role yet';
  // Keep the record that knows the most.
  const filled = (p: Person) => [p.email, p.phone, p.street, p.zip].filter(Boolean).length + members.filter((m) => m.personId === p.id).length;

  return (
    <Panel>
      <p className="max-w-3xl border-b border-line p-4 text-sm text-ink-soft">
        These records have the same first and last name. If they are one person, for example an advocate who is also a foster parent, join them so their family, church role and contact log sit together. Joining keeps everything from both.
      </p>
      {groups.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">No two people share a name.</p>}
      <ul className="divide-y divide-line">
        {groups.map((g) => {
          const sorted = [...g.people].sort((a, b) => filled(b) - filled(a));
          const key = pairKey(g.people.map((p) => p.id));
          return (
            <li key={key} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{personName(sorted[0])}</span>
                  <Badge tone={g.likely ? 'good' : 'warn'}>{g.likely ? 'Likely the same' : 'Possibly the same'}</Badge>
                  <span className="text-xs text-ink-soft">{g.likely ? 'Same name, and the same email, phone or address' : 'Same name only'}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {sorted.map((p) => (
                    <li key={p.id} className="rounded-md border border-line bg-paper px-3 py-2 text-sm">
                      <div>{about(p)}</div>
                      <div className="text-xs text-ink-soft">{[p.email, p.phone, [p.street, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'No contact details'}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 lg:flex-col">
                <button
                  className="btn-primary"
                  disabled={busy === key}
                  onClick={async () => {
                    setBusy(key);
                    for (const p of sorted.slice(1)) if (!(await mergePeople(sorted[0].id, p.id))) break;
                    setBusy('');
                  }}
                >
                  Same person, join them
                </button>
                <button className="btn-ghost" disabled={busy === key} onClick={() => dismiss('people', key)}>Different people</button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Pairs({ items, intro, empty }: { items: { key: string; kind: 'families' | 'churches'; why: string; likely: boolean; rows: { id: string; title: string; detail: string; href: string }[] }[]; intro: string; empty: string }) {
  const { dismiss } = useLive();
  return (
    <Panel>
      <p className="max-w-3xl border-b border-line p-4 text-sm text-ink-soft">{intro}</p>
      {items.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">{empty}</p>}
      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={it.key} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={it.likely ? 'good' : 'warn'}>{it.likely ? 'Likely the same' : 'Possibly the same'}</Badge>
                <span className="text-xs text-ink-soft">{it.why}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {it.rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-3 py-2 text-sm">
                    <span><span className="font-semibold">{r.title}</span>{r.detail && <span className="text-ink-soft"> · {r.detail}</span>}</span>
                    <Link className="shrink-0 text-xs font-semibold text-brand-dark underline" href={r.href}>Open</Link>
                  </li>
                ))}
              </ul>
            </div>
            <button className="btn-ghost" onClick={() => dismiss(it.kind, it.key)}>They are different</button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Missing({ groups }: { groups: { label: string; list: Family[] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel>
      <p className="max-w-3xl border-b border-line p-4 text-sm text-ink-soft">
        The spreadsheet left these blank. Open a family to fill it in. Children came across as counts only, so names and birth years can be added as you talk with each family.
      </p>
      {groups.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">Nothing is missing.</p>}
      <ul className="divide-y divide-line">
        {groups.map((g) => (
          <li key={g.label} className="p-4">
            <button className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open === g.label} onClick={() => setOpen(open === g.label ? null : g.label)}>
              <span className="font-semibold">{g.label}</span>
              <span className="num text-sm text-ink-soft">{num(g.list.length)} · {open === g.label ? 'hide' : 'show'}</span>
            </button>
            {open === g.label && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {g.list.map((f) => (
                  <li key={f.id}><Link className="inline-block rounded-full border border-line bg-white px-3 py-1 text-sm hover:border-brand" href={`/live/families?open=${f.id}`}>{f.name}{f.city ? `, ${f.city}` : ''}</Link></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

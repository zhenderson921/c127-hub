'use client';

import { useMemo, useState } from 'react';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { TOWNS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Family, FamilyType } from '@/lib/types';
import { num, parseCsv } from '@/lib/util';

type Field = 'name' | 'type' | 'town' | 'zip' | 'children' | 'church' | 'email' | 'skip';
const FIELDS: { key: Field; label: string; hints: string[] }[] = [
  { key: 'name', label: 'Family name', hints: ['family', 'household', 'last name', 'surname', 'name'] },
  { key: 'type', label: 'Family type', hints: ['type', 'placement', 'category'] },
  { key: 'town', label: 'Town', hints: ['city', 'town'] },
  { key: 'zip', label: 'Zip code', hints: ['zip', 'postal'] },
  { key: 'children', label: 'Children', hints: ['kids', 'children', 'child'] },
  { key: 'church', label: 'Church', hints: ['church', 'fam', 'congregation'] },
  { key: 'email', label: 'Email', hints: ['email', 'e-mail'] },
  { key: 'skip', label: 'Do not import', hints: [] },
];

// A deliberately untidy file, shaped like an export from an older system.
const SAMPLE = `Household (Last),Placement Type,City,Zip Code,# Kids,Home Church,Primary E-mail,Internal Notes
Okafor-Reed,foster,Oviedo,32765,3,,okafor.reed@example.com,called 9/12
"Marlowe, T. & J.",Adoptive,Winter Park,32789,2,,marlowe@example.com,
Santiago,KINSHIP,Kissimmee,34741,4,,santiago.fam@example.com,grandparents
Whitcombe,Foster,Sanford,32771,1,,whitcombe@example.com,new license
Baptiste,foster care,Apopka,32703,2,,baptiste@example.com,
Lindqvist,Adoption,Lake Mary,32746,3,,lindqvist@example.com,
Reyes Family,Foster,Orlando,32801,2,,reyes88@example.com,possible duplicate
Achebe,Kinship,Ocoee,34761,5,,achebe@example.com,`;

function guess(header: string): Field {
  const h = header.toLowerCase();
  for (const f of FIELDS) if (f.hints.some((x) => h.includes(x))) return f.key;
  return 'skip';
}

function cleanType(v: string): FamilyType {
  const s = v.toLowerCase();
  if (s.includes('adopt')) return 'Adoptive';
  if (s.includes('kin')) return 'Kinship';
  if (s.includes('reun') || s.includes('bio')) return 'Reunification';
  return 'Foster';
}

export default function ImportPage() {
  const { families, churches, importFamilies } = useStore();
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Field[]>([]);
  const [done, setDone] = useState<number | null>(null);

  function load(text: string) {
    const parsed = parseCsv(text);
    setRows(parsed);
    setMap(parsed[0]?.map(guess) ?? []);
    setDone(null);
  }

  const prepared = useMemo(() => {
    if (rows.length < 2 || !map.includes('name')) return [];
    const col = (f: Field) => map.indexOf(f);
    const existing = new Set(families.map((f) => `${f.name.toLowerCase()}|${f.zip}`));
    return rows.slice(1).map((r, i) => {
      const get = (f: Field) => (col(f) >= 0 ? (r[col(f)] ?? '').trim() : '');
      let name = get('name').replace(/\s+family$/i, '');
      if (name.includes(',')) name = name.split(',')[0];
      name = `${name.trim()} Family`;
      const townText = get('town');
      const zip = get('zip');
      const town = TOWNS.find((t) => t.name.toLowerCase() === townText.toLowerCase()) || TOWNS.find((t) => t.zip === zip) || TOWNS[0];
      const churchText = get('church').toLowerCase();
      const church = churchText ? churches.find((c) => c.name.toLowerCase().includes(churchText) || churchText.includes(c.name.toLowerCase())) : undefined;
      const jitter = (n: number) => ((((i + 1) * n) % 17) / 17 - 0.5) * 0.06;
      const family: Omit<Family, 'id'> = {
        name,
        type: cleanType(get('type')),
        town: town.name,
        county: town.county,
        zip: zip || town.zip,
        lat: town.lat + jitter(7),
        lng: town.lng + jitter(11),
        children: Math.max(1, parseInt(get('children'), 10) || 1),
        status: 'Active',
        churchId: church ? church.id : null,
        careCommunity: false,
        lastContact: Date.now(),
        since: Date.now(),
        email: get('email'),
        source: 'Import',
      };
      return { family, duplicate: existing.has(`${name.toLowerCase()}|${family.zip}`) };
    });
  }, [rows, map, families, churches]);

  const fresh = prepared.filter((p) => !p.duplicate);

  return (
    <>
      <PageHeader title="Import a spreadsheet" sub="Drop in an export from Promise Serves, MyFam or the team spreadsheet. The hub reads the headings, tidies the values and flags families it already has, so loading data is minutes of checking and not a day of mapping." />

      <Panel title="1. Choose a file">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) load(await f.text());
            }}
          />
          <span className="text-sm text-ink-soft">or</span>
          <button className="btn-ghost" onClick={() => load(SAMPLE)}>Use a sample export</button>
        </div>
      </Panel>

      {rows.length > 1 && (
        <>
          <Panel title="2. Check how the columns were read" className="mt-4">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {rows[0].map((h, i) => (
                <div key={i}>
                  <label htmlFor={`map-${i}`} className="label normal-case tracking-normal">&ldquo;{h}&rdquo; is</label>
                  <select id={`map-${i}`} className="field" value={map[i]} onChange={(e) => setMap(map.map((m, j) => (j === i ? (e.target.value as Field) : m)))}>
                    {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {!map.includes('name') && <p className="border-t border-line px-4 py-3 text-sm text-alert">Choose which column holds the family name to continue.</p>}
          </Panel>

          {prepared.length > 0 && (
            <Panel title={`3. Review ${prepared.length} rows`} className="mt-4" action={done === null ? <button className="btn-primary py-1.5" disabled={fresh.length === 0} onClick={() => { importFamilies(fresh.map((p) => p.family)); setDone(fresh.length); }}>Import {fresh.length} families</button> : <Badge tone="good">{done} imported</Badge>}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-line bg-paper">
                    <tr><th className="th">Family</th><th className="th">Type</th><th className="th">Town</th><th className="th text-right">Children</th><th className="th">Church</th><th className="th">Result</th></tr>
                  </thead>
                  <tbody>
                    {prepared.map((p, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="td font-semibold">{p.family.name}</td>
                        <td className="td">{p.family.type}</td>
                        <td className="td">{p.family.town}</td>
                        <td className="td num text-right">{p.family.children}</td>
                        <td className="td">{p.family.churchId ? churches.find((c) => c.id === p.family.churchId)?.name : <span className="text-ink-soft">None, will be matched on the map</span>}</td>
                        <td className="td">{p.duplicate ? <Badge tone="warn">Already in the hub, skipped</Badge> : <Badge tone="good">New</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {done !== null && <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">The hub now holds {num(families.length)} families. The new ones appear under Families and as orange dots on the church match map.</p>}
            </Panel>
          )}
        </>
      )}
    </>
  );
}

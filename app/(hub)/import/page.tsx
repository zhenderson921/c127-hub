'use client';

import { useMemo, useState } from 'react';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { TOWNS } from '@/lib/seed';
import { useStore, type NewChurch } from '@/lib/store';
import type { ChurchStage, Family, FamilyType } from '@/lib/types';
import { num, parseCsv } from '@/lib/util';

type Kind = 'families' | 'churches';
interface FieldDef {
  key: string;
  label: string;
  hints: string[];
}

const FIELDS: Record<Kind, FieldDef[]> = {
  families: [
    { key: 'name', label: 'Family name', hints: ['family', 'household', 'last name', 'surname', 'name'] },
    { key: 'type', label: 'Family type', hints: ['type', 'placement', 'category'] },
    { key: 'town', label: 'Town', hints: ['city', 'town'] },
    { key: 'zip', label: 'Zip code', hints: ['zip', 'postal'] },
    { key: 'children', label: 'Children', hints: ['kids', 'children', 'child'] },
    { key: 'church', label: 'Church', hints: ['church', 'fam', 'congregation'] },
    { key: 'email', label: 'Email', hints: ['email', 'e-mail'] },
    { key: 'skip', label: 'Do not import', hints: [] },
  ],
  churches: [
    { key: 'name', label: 'Church name', hints: ['church', 'congregation', 'name'] },
    { key: 'town', label: 'Town', hints: ['city', 'town'] },
    { key: 'zip', label: 'Zip code', hints: ['zip', 'postal'] },
    { key: 'coach', label: 'C127 coach', hints: ['coach', 'staff', 'owner', 'assigned'] },
    { key: 'stage', label: 'Stage', hints: ['stage', 'status', 'phase'] },
    { key: 'advocate', label: 'Advocate', hints: ['advocate', 'leader', 'contact'] },
    { key: 'capacity', label: 'Families it can serve', hints: ['capacity', 'families', 'max'] },
    { key: 'skip', label: 'Do not import', hints: [] },
  ],
};

// Deliberately untidy files, shaped like exports from an older system.
const SAMPLE: Record<Kind, string> = {
  families: `Household (Last),Placement Type,City,Zip Code,# Kids,Home Church,Primary E-mail,Internal Notes
Okafor-Reed,foster,Oviedo,32765,3,,okafor.reed@example.com,called 9/12
"Marlowe, T. & J.",Adoptive,Winter Park,32789,2,,marlowe@example.com,
Santiago,KINSHIP,Kissimmee,34741,4,,santiago.fam@example.com,grandparents
Whitcombe,Foster,Sanford,32771,1,,whitcombe@example.com,new license
Baptiste,foster care,Apopka,32703,2,,baptiste@example.com,
Lindqvist,Adoption,Lake Mary,32746,3,,lindqvist@example.com,
Reyes Family,Foster,Orlando,32801,2,,reyes88@example.com,possible duplicate
Achebe,Kinship,Ocoee,34761,5,,achebe@example.com,`,
  churches: `Church,City,Zip,Assigned Coach,Status,FAM Leader,Max Families
Riverbend Community Church,Oviedo,32765,Maria Santos,active,Dana Whitfield,12
Lakeside Fellowship,Winter Park,32789,Maria Santos,Launching,Sam Ortega,5
Hope Chapel Sanford,Sanford,32771,Jordan Ellis,exploring,,0
Kissimmee Bible Church,Kissimmee,34741,Jordan Ellis,Active FAM,Rosa Delgado,10
Apopka First Methodist,Apopka,32703,Maria Santos,clinic,,0`,
};

function cleanType(v: string): FamilyType {
  const s = v.toLowerCase();
  if (s.includes('adopt')) return 'Adoptive';
  if (s.includes('kin')) return 'Kinship';
  if (s.includes('reun') || s.includes('bio')) return 'Reunification';
  return 'Foster';
}

function cleanStage(v: string): ChurchStage {
  const s = v.toLowerCase();
  if (s.includes('active')) return 'Active FAM';
  if (s.includes('launch')) return 'Launching';
  if (s.includes('clinic')) return 'Clinic scheduled';
  if (s.includes('explor')) return 'Exploring';
  if (s.includes('pause')) return 'Paused';
  return 'Prospect';
}

const findTown = (townText: string, zip: string) => TOWNS.find((t) => t.name.toLowerCase() === townText.toLowerCase()) || TOWNS.find((t) => t.zip === zip) || TOWNS[0];
const jitter = (i: number, n: number) => ((((i + 1) * n) % 17) / 17 - 0.5) * 0.06;

export default function ImportPage() {
  const { families, churches, importFamilies, importChurches, mode } = useStore();
  const [kind, setKind] = useState<Kind>('families');
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);

  const guess = (k: Kind, header: string) => {
    const h = header.toLowerCase();
    return FIELDS[k].find((f) => f.hints.some((x) => h.includes(x)))?.key ?? 'skip';
  };

  function load(text: string, k: Kind = kind) {
    const parsed = parseCsv(text);
    setRows(parsed);
    // Each target is used once: the first matching column wins.
    const used = new Set<string>();
    setMap(
      (parsed[0] ?? []).map((h) => {
        const g = guess(k, h);
        if (g === 'skip' || used.has(g)) return 'skip';
        used.add(g);
        return g;
      }),
    );
    setDone(null);
  }

  function switchKind(k: Kind) {
    setKind(k);
    setRows([]);
    setMap([]);
    setDone(null);
  }

  const cell = (r: string[], f: string) => (map.indexOf(f) >= 0 ? (r[map.indexOf(f)] ?? '').trim() : '');

  const famPrepared = useMemo(() => {
    if (kind !== 'families' || rows.length < 2 || !map.includes('name')) return [];
    const existing = new Set(families.map((f) => `${f.name.toLowerCase()}|${f.zip}`));
    return rows.slice(1).map((r, i) => {
      let name = cell(r, 'name').replace(/\s+family$/i, '');
      if (name.includes(',')) name = name.split(',')[0];
      name = `${name.trim()} Family`;
      const zip = cell(r, 'zip');
      const town = findTown(cell(r, 'town'), zip);
      const churchText = cell(r, 'church').toLowerCase();
      const church = churchText ? churches.find((c) => c.name.toLowerCase().includes(churchText) || churchText.includes(c.name.toLowerCase())) : undefined;
      const family: Omit<Family, 'id'> = {
        name, type: cleanType(cell(r, 'type')), town: town.name, county: town.county, zip: zip || town.zip,
        lat: town.lat + jitter(i, 7), lng: town.lng + jitter(i, 11), children: Math.max(1, parseInt(cell(r, 'children'), 10) || 1),
        status: 'Active', churchId: church ? church.id : null, careCommunity: false, lastContact: Date.now(), since: Date.now(), email: cell(r, 'email'), source: 'Import',
      };
      return { family, duplicate: existing.has(`${name.toLowerCase()}|${family.zip}`) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, rows, map, families, churches]);

  const chPrepared = useMemo(() => {
    if (kind !== 'churches' || rows.length < 2 || !map.includes('name')) return [];
    const existing = new Set(churches.map((c) => c.name.toLowerCase()));
    return rows.slice(1).map((r, i) => {
      const zip = cell(r, 'zip');
      const town = findTown(cell(r, 'town'), zip);
      const stage = cleanStage(cell(r, 'stage'));
      const church: NewChurch = {
        name: cell(r, 'name'), town: town.name, county: town.county, lat: town.lat + jitter(i, 5), lng: town.lng + jitter(i, 13), stage,
        advocate: cell(r, 'advocate'), capacity: Math.max(0, parseInt(cell(r, 'capacity'), 10) || (stage === 'Active FAM' ? 10 : 0)), coachName: cell(r, 'coach'),
      };
      return { church, duplicate: !church.name || existing.has(church.name.toLowerCase()) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, rows, map, churches]);

  const freshFam = famPrepared.filter((p) => !p.duplicate);
  const freshCh = chPrepared.filter((p) => !p.duplicate);
  const count = kind === 'families' ? famPrepared.length : chPrepared.length;
  const fresh = kind === 'families' ? freshFam.length : freshCh.length;

  function run() {
    if (kind === 'families') importFamilies(freshFam.map((p) => p.family));
    else importChurches(freshCh.map((p) => p.church));
    setDone(fresh);
  }

  return (
    <>
      <PageHeader title="Import a spreadsheet" sub="Drop in an export from Promise Serves, MyFam or the team spreadsheet. The hub reads the headings, tidies the values and flags records it already has, so loading data is minutes of checking and not a day of mapping." />

      <Panel title="1. Choose what the file holds, then the file">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          {(['churches', 'families'] as Kind[]).map((k) => (
            <button key={k} onClick={() => switchKind(k)} className={kind === k ? 'btn-primary' : 'btn-ghost'}>{k === 'churches' ? 'Churches and coaches' : 'Families'}</button>
          ))}
          <span className="text-sm text-ink-soft">Load churches first, so families can be linked to them.</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <input
            key={kind}
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
          <button className="btn-ghost" onClick={() => load(SAMPLE[kind])}>Use a sample export</button>
        </div>
      </Panel>

      {rows.length > 1 && (
        <>
          <Panel title="2. Check how the columns were read" className="mt-4">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {rows[0].map((h, i) => (
                <div key={i}>
                  <label htmlFor={`map-${i}`} className="label normal-case tracking-normal">&ldquo;{h}&rdquo; is</label>
                  <select id={`map-${i}`} className="field" value={map[i]} onChange={(e) => { setMap(map.map((m, j) => (j === i ? e.target.value : m))); setDone(null); }}>
                    {FIELDS[kind].map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {!map.includes('name') && <p className="border-t border-line px-4 py-3 text-sm text-alert">Choose which column holds the {kind === 'families' ? 'family' : 'church'} name to continue.</p>}
          </Panel>

          {count > 0 && (
            <Panel
              title={`3. Review ${count} rows`}
              className="mt-4"
              action={done === null ? <button className="btn-primary py-1.5" disabled={fresh === 0} onClick={run}>Import {fresh} {kind}</button> : <Badge tone="good">{done} imported</Badge>}
            >
              <div className="overflow-x-auto">
                {kind === 'families' ? (
                  <table className="w-full">
                    <thead className="border-b border-line bg-paper">
                      <tr><th className="th">Family</th><th className="th">Type</th><th className="th">Town</th><th className="th text-right">Children</th><th className="th">Church</th><th className="th">Result</th></tr>
                    </thead>
                    <tbody>
                      {famPrepared.map((p, i) => (
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
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-line bg-paper">
                      <tr><th className="th">Church</th><th className="th">Town</th><th className="th">Stage</th><th className="th">Coach</th><th className="th">Advocate</th><th className="th text-right">Can serve</th><th className="th">Result</th></tr>
                    </thead>
                    <tbody>
                      {chPrepared.map((p, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="td font-semibold">{p.church.name}</td>
                          <td className="td">{p.church.town}</td>
                          <td className="td">{p.church.stage}</td>
                          <td className="td">{p.church.coachName || <span className="text-ink-soft">None</span>}</td>
                          <td className="td">{p.church.advocate || <span className="text-ink-soft">None</span>}</td>
                          <td className="td num text-right">{p.church.capacity}</td>
                          <td className="td">{p.duplicate ? <Badge tone="warn">Already in the hub, skipped</Badge> : <Badge tone="good">New</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {done !== null && (
                <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">
                  {kind === 'families'
                    ? `The hub now holds ${num(families.length)} families. The new ones appear under Families and as orange dots on the church match map.`
                    : `The hub now holds ${num(churches.length)} churches. Each coach named in the file has their churches under My work.`}
                  {mode === 'live' ? ' Saved for the whole team.' : ''}
                </p>
              )}
            </Panel>
          )}
        </>
      )}
    </>
  );
}

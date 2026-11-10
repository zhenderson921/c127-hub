'use client';

import { useState } from 'react';
import { PageHeader, Panel } from '@/components/ui';
import { nearestChurches } from '@/lib/match';
import { TOWNS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { FamilyType, NeedType } from '@/lib/types';
import { DAY } from '@/lib/util';

const TYPES: NeedType[] = ['Meal', 'Childcare', 'Transportation', 'Tangible item', 'Home & yard', 'Tutoring', 'Prayer'];

export default function RequestHelpPage() {
  const { families, churches, addNeed, addFamily } = useStore();
  const [known, setKnown] = useState(true);
  const [familyName, setFamilyName] = useState('');
  const [town, setTown] = useState(TOWNS[0].name);
  const [famType, setFamType] = useState<FamilyType>('Foster');
  const [children, setChildren] = useState(1);
  const [type, setType] = useState<NeedType>('Meal');
  const [what, setWhat] = useState('');
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);

  const match = known ? families.find((f) => f.name.toLowerCase() === familyName.trim().toLowerCase()) : undefined;
  const ready = what.trim() && familyName.trim() && (!known || match);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (known && match) {
      if (match.churchId) {
        const church = churches.find((c) => c.id === match.churchId);
        addNeed({ familyId: match.id, churchId: match.churchId, type, title: what.trim(), date: Date.now() + 3 * DAY, status: 'Open', volunteerId: null, hours: type === 'Childcare' ? 3 : 1.5 });
        setResult({ title: 'Your request is with your church', body: `${church?.name} has it now. The Care Community around your family sees it on their phones, and ${church?.advocate} will follow up.` });
      } else {
        const m = nearestChurches(match, churches, families, 1)[0];
        setResult({ title: 'We are finding you a church', body: `You are not connected to a church yet. The closest one with room is ${m.church.name}, ${m.miles.toFixed(1)} miles from you. A C127 coach will make the introduction.` });
      }
    } else {
      const t = TOWNS.find((x) => x.name === town)!;
      const row = {
        name: `${familyName.trim().replace(/\s+family$/i, '')} Family`, type: famType, town: t.name, county: t.county, zip: t.zip,
        lat: t.lat + 0.012, lng: t.lng - 0.009, children, status: 'Active' as const, churchId: null, careCommunity: false,
        lastContact: Date.now(), since: Date.now(), email: '', source: 'Intake form' as const,
      };
      const m = nearestChurches(row, churches, families, 1)[0];
      addFamily(row);
      setResult({ title: 'Thank you. You are not alone in this', body: `We have your request. The closest church with room is ${m.church.name}, ${m.miles.toFixed(1)} miles from you. A C127 coach will reach out and make the introduction.` });
    }
    setWhat('');
  }

  return (
    <>
      <PageHeader title="Family request" sub="The page a foster, adoptive or kinship family uses to ask for help. A family with a church goes straight to that church's team. A family without one is matched to the closest church with room, and nobody re-types anything." />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Ask for help">
          <form className="space-y-4 p-4" onSubmit={submit}>
            <fieldset className="flex gap-4 text-sm">
              <legend className="label">Have we met?</legend>
              <label className="flex items-center gap-2"><input type="radio" name="known" className="accent-brand" checked={known} onChange={() => { setKnown(true); setResult(null); }} />C127 already knows our family</label>
              <label className="flex items-center gap-2"><input type="radio" name="known" className="accent-brand" checked={!known} onChange={() => { setKnown(false); setResult(null); }} />We are new</label>
            </fieldset>
            <div>
              <label htmlFor="rh-name" className="label">Family name</label>
              <input id="rh-name" className="field" list={known ? 'rh-families' : undefined} placeholder={known ? 'Start typing, for example Reyes Family' : 'For example Morales'} value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
              {known && <datalist id="rh-families">{families.slice(0, 400).map((f) => <option key={f.id} value={f.name} />)}</datalist>}
              {known && familyName.trim() && !match && <p className="mt-1 text-xs text-ink-soft">Choose a family from the list, or pick &ldquo;We are new&rdquo;.</p>}
            </div>
            {!known && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label htmlFor="rh-town" className="label">Town</label><select id="rh-town" className="field" value={town} onChange={(e) => setTown(e.target.value)}>{TOWNS.map((t) => <option key={t.name}>{t.name}</option>)}</select></div>
                <div><label htmlFor="rh-ftype" className="label">We are a</label><select id="rh-ftype" className="field" value={famType} onChange={(e) => setFamType(e.target.value as FamilyType)}><option>Foster</option><option>Adoptive</option><option>Kinship</option><option>Reunification</option></select></div>
                <div><label htmlFor="rh-kids" className="label">Children</label><input id="rh-kids" type="number" min={1} max={12} className="field" value={children} onChange={(e) => setChildren(Math.max(1, Number(e.target.value) || 1))} /></div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <div><label htmlFor="rh-type" className="label">Kind of help</label><select id="rh-type" className="field" value={type} onChange={(e) => setType(e.target.value as NeedType)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label htmlFor="rh-what" className="label">What would help most?</label><input id="rh-what" className="field" placeholder="For example dinner on Thursday after court" value={what} onChange={(e) => setWhat(e.target.value)} /></div>
            </div>
            <button type="submit" disabled={!ready} className="btn-primary w-full">Send request</button>
          </form>
        </Panel>

        <Panel title="What happens next">
          {result ? (
            <div className="p-4">
              <h3 className="font-display text-2xl tracking-wide text-brand-dark">{result.title}</h3>
              <p className="mt-2 text-sm leading-relaxed">{result.body}</p>
              <p className="mt-4 text-xs text-ink-soft">In the hub this now shows under Care requests, in the Church view for that church, and on the church match map if the family has no church.</p>
            </div>
          ) : (
            <ol className="space-y-3 p-4 text-sm">
              <li><b>A family with a church:</b> the request appears for their Care Community and their advocate at once.</li>
              <li><b>A family without a church:</b> the hub finds the closest church with room and puts the introduction on a coach&rsquo;s list.</li>
              <li><b>A family C127 has never met:</b> they are added to the 702, with nothing typed twice, and matched the same way.</li>
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}

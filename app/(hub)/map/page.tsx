'use client';

import { useMemo, useState } from 'react';
import { MatchMap } from '@/components/MatchMap';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { isServing, nearestChurches } from '@/lib/match';
import { useStore } from '@/lib/store';
import { num } from '@/lib/util';

export default function MapPage() {
  const { families, churches, connectFamily } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [showConnected, setShowConnected] = useState(false);

  const active = useMemo(() => families.filter((f) => f.status === 'Active'), [families]);
  const unconnected = useMemo(() => active.filter((f) => !f.churchId), [active]);
  const connected = useMemo(() => (showConnected ? active.filter((f) => f.churchId) : []), [active, showConnected]);
  const serving = churches.filter(isServing);
  const picked = families.find((f) => f.id === sel) ?? null;
  const matches = useMemo(() => (picked && !picked.churchId ? nearestChurches(picked, churches, families) : []), [picked, churches, families]);

  // Work list: the unconnected families whose best match is closest
  const queue = useMemo(
    () =>
      unconnected
        .map((f) => ({ f, m: nearestChurches(f, churches, families, 1)[0] }))
        .filter((r) => r.m && r.m.open > 0)
        .sort((a, b) => a.m.miles - b.m.miles)
        .slice(0, 8),
    [unconnected, churches, families],
  );

  return (
    <>
      <PageHeader
        title="Church match map"
        sub="Pick any family that has no church yet and the hub shows the closest serving churches with room. This is the geographic matching the team described losing in the move to MyFam."
      >
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={showConnected} onChange={(e) => setShowConnected(e.target.checked)} className="h-4 w-4 accent-brand" />
          Show connected families
        </label>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Panel>
          <MatchMap churches={churches} unconnected={unconnected} connected={connected} picked={picked} matches={matches} onPick={setSel} />
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-3 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-warn" />Family with no church yet ({num(unconnected.length)})</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand" />Church serving families ({serving.length})</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-ink-faint bg-white" />Church not serving yet ({churches.length - serving.length})</span>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title={picked ? picked.name : 'Pick a family'}>
            {!picked ? (
              <p className="px-4 py-4 text-sm text-ink-soft">Click an orange dot on the map, or choose from the list below.</p>
            ) : picked.churchId ? (
              <p className="px-4 py-4 text-sm"><Badge tone="good">Connected</Badge> <span className="ml-1">to {churches.find((c) => c.id === picked.churchId)?.name}.</span></p>
            ) : (
              <div className="px-4 py-3">
                <p className="text-xs text-ink-soft">{picked.type} family in {picked.town} · {picked.children} children</p>
                <ul className="mt-3 space-y-2">
                  {matches.map((m, i) => (
                    <li key={m.church.id} className={`rounded-md border p-3 ${i === 0 ? 'border-brand bg-brand-light' : 'border-line'}`}>
                      <div className="text-sm font-semibold">{m.church.name}</div>
                      <div className="num mt-0.5 text-xs text-ink-soft">{m.miles.toFixed(1)} miles · {m.open > 0 ? `room for ${m.open} more` : 'at capacity'}</div>
                      <button className={`${i === 0 ? 'btn-primary' : 'btn-ghost'} mt-2 w-full py-1.5`} onClick={() => connectFamily(picked.id, m.church.id)}>
                        Connect to this church
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="Easiest matches to make">
            <ul className="divide-y divide-line">
              {queue.map(({ f, m }) => (
                <li key={f.id}>
                  <button onClick={() => setSel(f.id)} className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-light/50 ${sel === f.id ? 'bg-brand-light' : ''}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{f.name}</span>
                      <span className="block truncate text-xs text-ink-soft">{m.church.name}</span>
                    </span>
                    <span className="num shrink-0 text-xs font-semibold text-brand-dark">{m.miles.toFixed(1)} mi</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

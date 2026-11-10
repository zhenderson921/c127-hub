'use client';

import { useMemo, useState } from 'react';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { isServing, nearestChurches } from '@/lib/match';
import { TOWNS } from '@/lib/seed';
import { useStore } from '@/lib/store';
import { num } from '@/lib/util';

// Central Florida, drawn to scale from latitude and longitude. No map tiles needed.
const BOX = { minLat: 28.17, maxLat: 28.98, minLng: -81.86, maxLng: -81.06 };
const W = 900;
const H = Math.round((W * (BOX.maxLat - BOX.minLat)) / ((BOX.maxLng - BOX.minLng) * Math.cos((28.57 * Math.PI) / 180)));
const x = (lng: number) => ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * W;
const y = (lat: number) => ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * H;

export default function MapPage() {
  const { families, churches, connectFamily } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [showConnected, setShowConnected] = useState(false);

  const active = useMemo(() => families.filter((f) => f.status === 'Active'), [families]);
  const unconnected = active.filter((f) => !f.churchId);
  const serving = churches.filter(isServing);
  const picked = families.find((f) => f.id === sel) ?? null;
  const matches = picked && !picked.churchId ? nearestChurches(picked, churches, families) : [];

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
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[560px]" role="img" aria-label="Map of families and churches across Central Florida">
              <rect width={W} height={H} fill="#F6F8F8" />
              {showConnected &&
                active.filter((f) => f.churchId).map((f) => <circle key={f.id} cx={x(f.lng)} cy={y(f.lat)} r={2.5} fill="#B9C4C2" />)}
              {picked &&
                matches.map((m, i) => (
                  <line key={m.church.id} x1={x(picked.lng)} y1={y(picked.lat)} x2={x(m.church.lng)} y2={y(m.church.lat)} stroke="#00857C" strokeWidth={i === 0 ? 2.5 : 1.2} strokeDasharray={i === 0 ? undefined : '5 4'} />
                ))}
              {churches.map((c) => {
                const on = isServing(c);
                const hit = matches.some((m) => m.church.id === c.id);
                return (
                  <rect key={c.id} x={x(c.lng) - 5} y={y(c.lat) - 5} width={10} height={10} rx={2} fill={on ? '#00A499' : '#FFFFFF'} stroke={hit ? '#262626' : on ? '#005F59' : '#8A8F8E'} strokeWidth={hit ? 2.5 : 1.2}>
                    <title>{`${c.name} (${c.stage})`}</title>
                  </rect>
                );
              })}
              {unconnected.map((f) => (
                <circle
                  key={f.id}
                  cx={x(f.lng)}
                  cy={y(f.lat)}
                  r={f.id === sel ? 8 : 4}
                  fill="#C2620A"
                  fillOpacity={f.id === sel ? 1 : 0.7}
                  stroke={f.id === sel ? '#262626' : '#FFFFFF'}
                  strokeWidth={f.id === sel ? 2 : 0.8}
                  className="cursor-pointer"
                  onClick={() => setSel(f.id)}
                >
                  <title>{`${f.name} · ${f.town}`}</title>
                </circle>
              ))}
              {TOWNS.map((t) => (
                <text key={t.name} x={x(t.lng)} y={y(t.lat) - 30} textAnchor="middle" fontSize="12" fontWeight="700" fill="#5C5C5C" stroke="#F6F8F8" strokeWidth={4} style={{ textTransform: 'uppercase', letterSpacing: '0.08em', paintOrder: 'stroke', pointerEvents: 'none' }}>
                  {t.name}
                </text>
              ))}
            </svg>
          </div>
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

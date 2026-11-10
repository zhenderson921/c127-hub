'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import { isServing, type Match } from '@/lib/match';
import { TOWNS } from '@/lib/seed';
import type { Church, Family } from '@/lib/types';

export interface MatchMapProps {
  churches: Church[];
  unconnected: Family[];
  connected: Family[]; // empty unless the viewer asked to see them
  picked: Family | null;
  matches: Match[];
  onPick: (familyId: string) => void;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const BOX = { minLat: 28.17, maxLat: 28.98, minLng: -81.86, maxLng: -81.06 };

type FC = FeatureCollection;
const points = (rows: { id: string; lat: number; lng: number }[], props: (r: any) => Record<string, unknown>): FC => ({
  type: 'FeatureCollection',
  features: rows.map((r) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { id: r.id, ...props(r) } })),
});

function buildData(p: MatchMapProps) {
  const hit = new Set(p.matches.map((m) => m.church.id));
  return {
    churches: points(p.churches, (c: Church) => ({ name: c.name, stage: c.stage, serving: isServing(c), hit: hit.has(c.id) })),
    waiting: points(p.unconnected, (f: Family) => ({ name: f.name, town: f.town, picked: f.id === p.picked?.id })),
    connected: points(p.connected, () => ({})),
    lines: {
      type: 'FeatureCollection',
      features: p.picked
        ? p.matches.map((m, i) => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[p.picked!.lng, p.picked!.lat], [m.church.lng, m.church.lat]] },
            properties: { best: i === 0 },
          }))
        : [],
    } as FC,
  };
}

/** Street map when a Mapbox token is set; a drawn map otherwise, or if Mapbox cannot load. */
export function MatchMap(props: MatchMapProps) {
  const [failed, setFailed] = useState(false);
  if (!TOKEN || failed) return <DrawnMap {...props} note={failed ? 'Mapbox could not load with the current token, so this is the drawn map.' : undefined} />;
  return <StreetMap {...props} onFail={() => setFailed(true)} />;
}

function StreetMap(props: MatchMapProps & { onFail: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let cancelled = false;
    let instance: MapboxMap | null = null;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled || !el.current) return;
      mapboxgl.accessToken = TOKEN!;
      instance = new mapboxgl.Map({
        container: el.current,
        style: 'mapbox://styles/mapbox/light-v11',
        bounds: [[BOX.minLng, BOX.minLat], [BOX.maxLng, BOX.maxLat]],
        fitBoundsOptions: { padding: 24 },
        attributionControl: true,
      });
      instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      let loaded = false;
      instance.on('error', () => {
        if (!loaded) latest.current.onFail();
      });
      instance.on('load', () => {
        if (cancelled || !instance) return;
        loaded = true;
        const d = buildData(latest.current);
        instance.addSource('connected', { type: 'geojson', data: d.connected });
        instance.addSource('lines', { type: 'geojson', data: d.lines });
        instance.addSource('churches', { type: 'geojson', data: d.churches });
        instance.addSource('waiting', { type: 'geojson', data: d.waiting });
        instance.addLayer({ id: 'connected', type: 'circle', source: 'connected', paint: { 'circle-radius': 3, 'circle-color': '#9AA3A1', 'circle-opacity': 0.7 } });
        instance.addLayer({
          id: 'lines', type: 'line', source: 'lines',
          paint: { 'line-color': '#00857C', 'line-width': ['case', ['get', 'best'], 3, 1.5], 'line-dasharray': [2, 1.5] },
        });
        instance.addLayer({
          id: 'churches', type: 'circle', source: 'churches',
          paint: {
            'circle-radius': ['case', ['get', 'hit'], 9, 6],
            'circle-color': ['case', ['get', 'serving'], '#00A499', '#FFFFFF'],
            'circle-stroke-color': ['case', ['get', 'hit'], '#262626', ['get', 'serving'], '#005F59', '#8A8F8E'],
            'circle-stroke-width': ['case', ['get', 'hit'], 3, 1.5],
          },
        });
        instance.addLayer({
          id: 'waiting', type: 'circle', source: 'waiting',
          paint: {
            'circle-radius': ['case', ['get', 'picked'], 9, 5],
            'circle-color': '#C2620A',
            'circle-opacity': ['case', ['get', 'picked'], 1, 0.8],
            'circle-stroke-color': ['case', ['get', 'picked'], '#262626', '#FFFFFF'],
            'circle-stroke-width': ['case', ['get', 'picked'], 2.5, 1],
          },
        });
        instance.on('click', 'waiting', (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) latest.current.onPick(String(id));
        });
        const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
        for (const layer of ['waiting', 'churches']) {
          instance.on('mouseenter', layer, (e) => {
            instance!.getCanvas().style.cursor = layer === 'waiting' ? 'pointer' : '';
            const f = e.features?.[0];
            if (!f || f.geometry.type !== 'Point') return;
            const p = f.properties ?? {};
            popup.setLngLat(f.geometry.coordinates as [number, number]).setText(layer === 'waiting' ? `${p.name} · ${p.town}` : `${p.name} (${p.stage})`).addTo(instance!);
          });
          instance.on('mouseleave', layer, () => {
            instance!.getCanvas().style.cursor = '';
            popup.remove();
          });
        }
        map.current = instance;
        setReady(true);
      });
    })().catch(() => latest.current.onFail());
    return () => {
      cancelled = true;
      map.current = null;
      instance?.remove();
    };
  }, []);

  // Push new data to the map whenever the selection or the records change.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const d = buildData(props);
    (m.getSource('connected') as GeoJSONSource | undefined)?.setData(d.connected);
    (m.getSource('lines') as GeoJSONSource | undefined)?.setData(d.lines);
    (m.getSource('churches') as GeoJSONSource | undefined)?.setData(d.churches);
    (m.getSource('waiting') as GeoJSONSource | undefined)?.setData(d.waiting);
  }, [ready, props.churches, props.unconnected, props.connected, props.picked, props.matches]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="h-[34rem] w-full rounded-t-lg" role="img" aria-label="Street map of families and churches across Central Florida" />;
}

// Drawn to scale from latitude and longitude. Used when there is no Mapbox token.
const W = 900;
const H = Math.round((W * (BOX.maxLat - BOX.minLat)) / ((BOX.maxLng - BOX.minLng) * Math.cos((28.57 * Math.PI) / 180)));
const x = (lng: number) => ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * W;
const y = (lat: number) => ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * H;

function DrawnMap({ churches, unconnected, connected, picked, matches, onPick, note }: MatchMapProps & { note?: string }) {
  return (
    <>
      {note && <p className="border-b border-line bg-warn-light px-4 py-2 text-xs text-warn">{note}</p>}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[560px]" role="img" aria-label="Map of families and churches across Central Florida">
          <rect width={W} height={H} fill="#F6F8F8" />
          {connected.map((f) => <circle key={f.id} cx={x(f.lng)} cy={y(f.lat)} r={2.5} fill="#B9C4C2" />)}
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
              r={f.id === picked?.id ? 8 : 4}
              fill="#C2620A"
              fillOpacity={f.id === picked?.id ? 1 : 0.7}
              stroke={f.id === picked?.id ? '#262626' : '#FFFFFF'}
              strokeWidth={f.id === picked?.id ? 2 : 0.8}
              className="cursor-pointer"
              onClick={() => onPick(f.id)}
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
    </>
  );
}

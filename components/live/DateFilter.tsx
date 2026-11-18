'use client';

import { useEffect, useRef, useState } from 'react';

// Filtering a list by its dates: last contacted, added, next contact and so
// on. One button opens every date the list has; each can be set on its own,
// and they narrow the list together.

export interface DateField {
  key: string;
  label: string;
  /** 'ahead' for dates that are usually in the future, like a next contact. */
  kind?: 'ahead';
}
export interface DateCondition {
  preset: string;
  from?: string;
  to?: string;
}
export type DateConditions = Record<string, DateCondition>;

const DAY = 86_400_000;
const PAST: [string, string][] = [
  ['any', 'Any time'],
  ['last7', 'In the last 7 days'],
  ['last30', 'In the last 30 days'],
  ['last90', 'In the last 90 days'],
  ['thisYear', 'This year'],
  ['not30', 'Not in the last 30 days'],
  ['not90', 'Not in the last 90 days'],
  ['never', 'Never, or not set'],
  ['set', 'Has a date'],
  ['custom', 'Between two dates'],
];
const AHEAD: [string, string][] = [
  ['any', 'Any time'],
  ['overdue', 'Overdue'],
  ['next7', 'In the next 7 days'],
  ['next30', 'In the next 30 days'],
  ['never', 'Not set'],
  ['set', 'Has a date'],
  ['custom', 'Between two dates'],
];
const labelOf = (preset: string) => [...PAST, ...AHEAD].find(([k]) => k === preset)?.[1] ?? preset;
const startOfDay = (d: string) => new Date(`${d}T00:00:00`).getTime();
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999`).getTime();

/** Whether one date (in milliseconds, or null when there is none) fits a condition. */
export function fits(value: number | null, c: DateCondition | undefined, now = Date.now()): boolean {
  if (!c || c.preset === 'any') return true;
  const today = new Date(now).setHours(0, 0, 0, 0);
  switch (c.preset) {
    case 'never': return value === null;
    case 'set': return value !== null;
    // "Not in the last 30 days" includes never: both mean it is time to get in touch.
    case 'not30': return value === null || value < now - 30 * DAY;
    case 'not90': return value === null || value < now - 90 * DAY;
    case 'last7': return value !== null && value >= now - 7 * DAY && value <= now;
    case 'last30': return value !== null && value >= now - 30 * DAY && value <= now;
    case 'last90': return value !== null && value >= now - 90 * DAY && value <= now;
    case 'thisYear': return value !== null && new Date(value).getFullYear() === new Date(now).getFullYear();
    case 'overdue': return value !== null && value < today;
    case 'next7': return value !== null && value >= today && value < today + 8 * DAY;
    case 'next30': return value !== null && value >= today && value < today + 31 * DAY;
    case 'custom': return value !== null && (!c.from || value >= startOfDay(c.from)) && (!c.to || value <= endOfDay(c.to));
    default: return true;
  }
}

/** Whether a record fits every date condition that is switched on. */
export function fitsAll(values: Record<string, number | null>, conditions: DateConditions): boolean {
  for (const key of Object.keys(conditions)) if (!fits(values[key] ?? null, conditions[key])) return false;
  return true;
}

/** A calendar day ('YYYY-MM-DD') or a timestamp as milliseconds, or null. */
export const toMs = (v: string | null | undefined): number | null => (v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).getTime() : null);

const active = (c: DateCondition | undefined) => !!c && c.preset !== 'any' && !(c.preset === 'custom' && !c.from && !c.to);

export function DateFilter({ fields, value, onChange }: { fields: DateField[]; value: DateConditions; onChange: (v: DateConditions) => void }) {
  const [open, setOpen] = useState(false);
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
  const on = fields.filter((f) => active(value[f.key]));
  const set = (key: string, c: DateCondition) => {
    const next = { ...value, [key]: c };
    if (c.preset === 'any') delete next[key];
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        title={on.length ? on.map((f) => `${f.label}: ${labelOf(value[f.key].preset).toLowerCase()}`).join('; ') : 'Filter by a date'}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold ${on.length ? 'border-brand bg-brand-light text-brand-deep' : 'border-line bg-white text-ink hover:border-brand'}`}
      >
        Dates
        {on.length > 0 && <span className="num rounded-full bg-brand px-1.5 text-xs text-white">{on.length}</span>}
        <span aria-hidden className="text-xs text-ink-soft">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 max-w-[90vw] rounded-md border border-line bg-white p-3 shadow-xl">
          <div className="space-y-3">
            {fields.map((f) => {
              const c = value[f.key] ?? { preset: 'any' };
              return (
                <div key={f.key}>
                  <label htmlFor={`df-${f.key}`} className="label">{f.label}</label>
                  <select id={`df-${f.key}`} className="field" value={c.preset} onChange={(e) => set(f.key, { preset: e.target.value, from: c.from, to: c.to })}>
                    {(f.kind === 'ahead' ? AHEAD : PAST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  {c.preset === 'custom' && (
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <input aria-label={`${f.label} from`} type="date" className="field" value={c.from ?? ''} onChange={(e) => set(f.key, { ...c, from: e.target.value })} />
                      <input aria-label={`${f.label} to`} type="date" className="field" value={c.to ?? ''} onChange={(e) => set(f.key, { ...c, to: e.target.value })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {on.length > 0 && (
            <div className="mt-3 border-t border-line pt-2 text-right">
              <button className="text-xs font-semibold text-brand-dark underline" onClick={() => onChange({})}>Clear the dates</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

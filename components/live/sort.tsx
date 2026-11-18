'use client';

// Click a column heading to sort by it; click again to reverse. Used by every
// table in the Live tool so they all behave the same way.

export interface SortState {
  by: string;
  dir: 1 | -1;
}
export const flip = (s: SortState, col: string): SortState => ({ by: col, dir: s.by === col && s.dir === 1 ? -1 : 1 });

type Value = string | number | null | undefined;

/** Sorted copy of the rows. Blanks always go to the bottom, whichever way the column is sorted. */
export function sortRows<T>(rows: T[], get: (r: T) => Value, dir: 1 | -1): T[] {
  const blank = (v: Value) => v === null || v === undefined || v === '';
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (blank(x) || blank(y)) return blank(x) && blank(y) ? 0 : blank(x) ? 1 : -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
}

export function SortTh({ col, label, sort, onSort, right }: { col: string; label: string; sort: SortState; onSort: (s: SortState) => void; right?: boolean }) {
  const on = sort.by === col;
  return (
    <th className={`th ${right ? 'text-right' : ''}`} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${on ? 'text-ink' : ''}`} onClick={() => onSort(flip(sort, col))} title={`Sort by ${label.toLowerCase()}`}>
        {label}
        <span aria-hidden className={on ? 'text-brand-dark' : 'text-ink-faint'}>{on && sort.dir === -1 ? '▴' : '▾'}</span>
      </button>
    </th>
  );
}

/** The Table / Board switch shown above anything that moves through stages. */
export function ViewSwitch({ view, onChange }: { view: 'table' | 'board'; onChange: (v: 'table' | 'board') => void }) {
  return (
    <div className="inline-grid grid-cols-2 rounded-md border border-line bg-white p-0.5 text-sm font-semibold" role="group" aria-label="How to show this list">
      {(['table', 'board'] as const).map((v) => (
        <button key={v} aria-pressed={view === v} onClick={() => onChange(v)} className={`rounded px-3 py-1 capitalize ${view === v ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'}`}>
          {v}
        </button>
      ))}
    </div>
  );
}

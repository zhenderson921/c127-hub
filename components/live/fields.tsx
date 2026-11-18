'use client';

import { churchLabel } from '@/lib/live/match';
import { HOME_TYPES, type Church, type HomeType } from '@/lib/live/types';

export function ChurchSelect({ id, value, onChange, churches, empty }: { id: string; value: string | null; onChange: (v: string | null) => void; churches: Church[]; empty: string }) {
  return (
    <select id={id} className="field" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{empty}</option>
      {churches.map((c) => <option key={c.id} value={c.id}>{churchLabel(c)}</option>)}
    </select>
  );
}

export function HomeTypePicker({ value, onChange }: { value: HomeType[]; onChange: (v: HomeType[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {HOME_TYPES.map((t) => (
        <label key={t} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={value.includes(t)} onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))} />
          {t}
        </label>
      ))}
    </div>
  );
}

'use client';

import { useCallback, useState } from 'react';

// List screens keep their search, filters and page while you click into a
// record and come back. The values live here for as long as the tab is open.
const kept = new Map<string, unknown>();

export function useSticky<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (kept.has(key) ? (kept.get(key) as T) : initial));
  const set = useCallback(
    (v: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        kept.set(key, next);
        return next;
      }),
    [key],
  );
  return [value, set];
}

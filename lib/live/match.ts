import type { Church } from './types';

// Deciding whether a church name typed in a spreadsheet is a church in the list.
// The same rules as scripts/preload.mjs, so the page and the load agree.

export const norm = (v: string): string => v.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Staff shorthand for places, as it appears in the spreadsheets ("Summit Orl", "Discovery WG"). */
const PLACE_SHORTHAND: Record<string, string> = { orl: 'orlando', wp: 'winter park', wg: 'winter garden', lm: 'lake mary' };

/** A name boiled down: shorthand spelled out, "the", "of" and "church" dropped, spaces removed. */
export const core = (v: string): string =>
  norm(v)
    .split(' ')
    .map((w) => PLACE_SHORTHAND[w] ?? w)
    .join(' ')
    .split(' ')
    .filter((w) => w && !['the', 'of', 'church'].includes(w))
    .join('');

/** How alike two names are, 0 to 1, by the pairs of letters they share. */
export function alike(a: string, b: string): number {
  const grams = (s: string) => {
    const t = core(s);
    const m = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const A = grams(a);
  const B = grams(b);
  let shared = 0;
  let total = 0;
  for (const [g, n] of A) {
    shared += Math.min(n, B.get(g) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total ? (2 * shared) / total : 0;
}

export const churchLabel = (c: Church): string => (c.campus ? `${c.name} (${c.campus})` : c.name);

export type Confidence = 'likely' | 'possible' | 'none';

export interface NameMatch {
  confidence: Confidence;
  /** The closest churches, best first. Empty when nothing is close. */
  candidates: Church[];
}

/**
 * The churches a typed name might mean.
 *  - likely: one church is clearly closest
 *  - possible: something is close, but not clearly one church (for example the
 *    name fits several campuses), so a person has to choose
 *  - none: nothing in the list looks like it
 */
export function matchName(typed: string, churches: Church[]): NameMatch {
  const want = core(typed);
  if (!want) return { confidence: 'none', candidates: [] };
  const scored = churches
    .map((c) => {
      const names = [c.name, ...(c.campus ? [`${c.name} ${c.campus}`] : [])];
      let score = Math.max(...names.map((n) => alike(typed, n)));
      // "Discovery" for "Discovery Church (Sand Lake)": the typed name is the start of the church's.
      const starts = names.some((n) => core(n).startsWith(want) || want.startsWith(core(n)));
      if (starts && want.length >= 4) score = Math.max(score, 0.78);
      return { c, score };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { confidence: 'none', candidates: [] };
  const [first, second] = scored;
  const clear = first.score >= 0.8 && (!second || first.score - second.score >= 0.08);
  return { confidence: clear ? 'likely' : 'possible', candidates: scored.slice(0, 6).map((x) => x.c) };
}

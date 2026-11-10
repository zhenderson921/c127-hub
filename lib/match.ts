import type { Church, Family } from './types';
import { miles } from './util';

export interface Match {
  church: Church;
  miles: number;
  serving: number;
  open: number;
}

export function isServing(c: Church): boolean {
  return c.stage === 'Active FAM' || c.stage === 'Launching';
}

/**
 * The feature C127 lost in the move to MyFam: for a family with no church,
 * find the closest churches that are serving and still have room.
 */
export function nearestChurches(point: { lat: number; lng: number }, churches: Church[], families: Family[], limit = 3): Match[] {
  const load: Record<string, number> = {};
  for (const f of families) if (f.churchId) load[f.churchId] = (load[f.churchId] || 0) + 1;
  return churches
    .filter(isServing)
    .map((church) => {
      const serving = load[church.id] || 0;
      return { church, miles: miles(point.lat, point.lng, church.lat, church.lng), serving, open: Math.max(0, church.capacity - serving) };
    })
    .sort((a, b) => (a.open > 0 ? 0 : 1) - (b.open > 0 ? 0 : 1) || a.miles - b.miles)
    .slice(0, limit);
}

export function familiesNear(church: Church, families: Family[], radiusMiles = 6): { family: Family; miles: number }[] {
  return families
    .filter((f) => !f.churchId && f.status === 'Active')
    .map((family) => ({ family, miles: miles(church.lat, church.lng, family.lat, family.lng) }))
    .filter((x) => x.miles <= radiusMiles)
    .sort((a, b) => a.miles - b.miles);
}

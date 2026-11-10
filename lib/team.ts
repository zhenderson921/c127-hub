import type { Family, Volunteer } from './types';

/** Roles that may only be filled by a volunteer with a cleared background check. */
export const CLEARANCE_TYPES = ['Childcare', 'Transportation'];

export function canServe(v: Volunteer, needType: string): boolean {
  if (!CLEARANCE_TYPES.includes(needType)) return true;
  return v.background === 'Cleared';
}

/**
 * The Care Community around a family: a small standing team from the family's
 * church. In the demo the team is derived from the roster so it stays stable.
 */
export function careTeam(family: Family, volunteers: Volunteer[]): Volunteer[] {
  if (!family.churchId || !family.careCommunity) return [];
  const pool = volunteers.filter((v) => v.churchId === family.churchId && v.role !== 'Advocate' && v.role !== 'Prayer');
  if (pool.length === 0) return [];
  const n = parseInt(family.id.replace(/\D/g, ''), 10) || 1;
  const size = Math.min(pool.length, 4 + (n % 3));
  const team = new Map<string, Volunteer>();
  for (let i = 0; team.size < size && i < pool.length * 3; i++) {
    const v = pool[(n + i * 3) % pool.length];
    team.set(v.id, v);
  }
  return [...team.values()];
}

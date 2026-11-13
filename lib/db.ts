import type { SupabaseClient } from '@supabase/supabase-js';
import type { Church, Coach, Data, Family, Gift, Guest, LogEntry, Need, Task, Volunteer } from './types';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: 'staff' | 'coach' | 'advocate' | 'none';
  coachId: string | null;
  churchId: string | null;
}

// Dates are stored as calendar days; the app works in milliseconds at local noon.
const dayToMs = (d: string | null): number => (d ? new Date(`${d}T12:00:00`).getTime() : 0);
const tsToMs = (t: string | null): number => (t ? new Date(t).getTime() : 0);
export const msToDay = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const msToTs = (ms: number): string => new Date(ms).toISOString();

/** PostgREST returns at most 1,000 rows per request, so read in pages. */
async function all<T>(sb: SupabaseClient, table: string, order = 'created_at'): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').order(order, { ascending: false }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toChurch = (r: any): Church => ({
  id: r.id, name: r.name, town: r.town ?? '', county: r.county ?? '', lat: r.lat ?? 0, lng: r.lng ?? 0, coachId: r.coach_id ?? '',
  stage: r.stage, advocate: r.advocate_name ?? '', lastContact: tsToMs(r.last_contact_at) || tsToMs(r.created_at),
  launched: r.launched_on ? dayToMs(r.launched_on) : undefined, capacity: r.capacity ?? 0,
});
const toFamily = (r: any): Family => ({
  id: r.id, name: r.name, type: r.type, town: r.town ?? '', county: r.county ?? '', zip: r.zip ?? '', lat: r.lat ?? 0, lng: r.lng ?? 0,
  children: r.children, status: r.status, churchId: r.church_id, careCommunity: r.care_community,
  lastContact: tsToMs(r.last_contact_at) || tsToMs(r.created_at), since: dayToMs(r.since), email: r.email ?? '', source: r.source,
});
const toNeed = (r: any): Need => ({
  id: r.id, familyId: r.family_id, churchId: r.church_id, type: r.type, title: r.title, date: dayToMs(r.needed_on), status: r.status,
  volunteerId: r.volunteer_id, hours: Number(r.hours),
});
const toGuest = (r: any): Guest => ({
  id: r.id, name: r.name, email: r.email ?? '', visit: dayToMs(r.visited_on), churchId: r.church_id, churchName: r.church_name ?? '',
  interests: r.interests ?? [], stage: r.stage, touches: r.touches, lastTouch: tsToMs(r.last_touch_at) || dayToMs(r.visited_on), quote: r.quote ?? undefined,
});
const toTask = (r: any): Task => ({ id: r.id, coachId: r.coach_id, title: r.title, about: r.about ?? '', due: dayToMs(r.due_on), auto: false, done: r.done });
const toGift = (r: any): Gift => ({ id: r.id, donor: r.donor_name, amount: Number(r.amount), date: dayToMs(r.given_on), fund: r.fund, recurring: r.recurring });

export const familyRow = (f: Omit<Family, 'id'> & { id: string }) => ({
  id: f.id, name: f.name, type: f.type, town: f.town, county: f.county, zip: f.zip, lat: f.lat, lng: f.lng, children: f.children, status: f.status,
  church_id: f.churchId, care_community: f.careCommunity, email: f.email || null, source: f.source, since: msToDay(f.since), last_contact_at: msToTs(f.lastContact),
});
export const needRow = (n: Need) => ({
  id: n.id, family_id: n.familyId, church_id: n.churchId, type: n.type, title: n.title, needed_on: msToDay(n.date), status: n.status, volunteer_id: n.volunteerId, hours: n.hours,
});
export const guestRow = (g: Guest) => ({
  id: g.id, name: g.name, email: g.email || null, visited_on: msToDay(g.visit), church_id: g.churchId, church_name: g.churchName || null,
  interests: g.interests, stage: g.stage, touches: g.touches, last_touch_at: msToTs(g.lastTouch), quote: g.quote ?? null,
});
export const taskRow = (t: Task) => ({ id: t.id, coach_id: t.coachId, title: t.title, about: t.about, due_on: msToDay(t.due), done: t.done });
export const churchRow = (c: Church) => ({
  id: c.id, name: c.name, town: c.town, county: c.county, lat: c.lat, lng: c.lng, coach_id: c.coachId || null, stage: c.stage,
  advocate_name: c.advocate || null, capacity: c.capacity, last_contact_at: msToTs(c.lastContact), launched_on: c.launched ? msToDay(c.launched) : null,
});

export async function loadProfile(sb: SupabaseClient): Promise<Profile | null> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  // Signed in, but nobody has given this account a role yet: they can see nothing.
  if (!data) return { id: auth.user.id, email: auth.user.email ?? '', fullName: '', role: 'none', coachId: null, churchId: null };
  return { id: data.id, email: auth.user.email ?? '', fullName: data.full_name ?? '', role: data.role, coachId: data.coach_id, churchId: data.church_id };
}

/** Read everything the signed-in person is allowed to see. Row level security does the filtering. */
export async function loadAll(sb: SupabaseClient): Promise<Data> {
  const [coaches, churches, families, volunteers, needs, guests, tasks, gifts, hours, log] = await Promise.all([
    all<any>(sb, 'coaches'), all<any>(sb, 'churches'), all<any>(sb, 'families'), all<any>(sb, 'volunteers'), all<any>(sb, 'needs', 'needed_on'),
    all<any>(sb, 'guests', 'visited_on'), all<any>(sb, 'tasks', 'due_on'), all<any>(sb, 'gifts', 'given_on'), all<any>(sb, 'volunteer_hours', 'volunteer_id'),
    sb.from('activity_log').select('*').order('at', { ascending: false }).limit(40),
  ]);
  const hoursBy = new Map<string, any>(hours.map((h) => [h.volunteer_id, h]));
  return {
    createdAt: Date.now(),
    coaches: coaches.map((r): Coach => ({ id: r.id, name: r.name, email: r.email ?? '' })).sort((a, b) => a.name.localeCompare(b.name)),
    churches: churches.map(toChurch),
    families: families.map(toFamily),
    volunteers: volunteers.map((r): Volunteer => {
      const h = hoursBy.get(r.id);
      return { id: r.id, name: r.name, churchId: r.church_id, role: r.role, background: r.background, training: r.training, hours: Number(h?.hours ?? 0), lastServed: h?.last_served_on ? dayToMs(h.last_served_on) : null };
    }),
    needs: needs.map(toNeed),
    guests: guests.map(toGuest),
    tasks: tasks.map(toTask),
    gifts: gifts.map(toGift),
    log: ((log.data ?? []) as any[]).map((r): LogEntry => ({ id: String(r.id), at: tsToMs(r.at), text: r.text })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Insert in batches so a large spreadsheet does not hit request size limits. */
export async function insertMany(sb: SupabaseClient, table: string, rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
}

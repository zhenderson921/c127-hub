import type { SupabaseClient } from '@supabase/supabase-js';
import { all } from '../db';
import type { CareCommunity, Child, Church, Family, FamilyMember, Interaction, LiveData, Person, PersonRole, Staff } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const toStaff = (r: any): Staff => ({ id: r.id, name: r.name, team: r.team ?? '' });

export const toChurch = (r: any): Church => ({
  id: r.id, name: r.name, campus: r.campus ?? '', status: r.status, street: r.street ?? '', city: r.town ?? '', state: r.state ?? '', zip: r.zip ?? '',
  county: r.county ?? '', website: r.website ?? '', coachId: r.coach_id, coachPriority: r.coach_priority ?? 'Normal', famActivities: r.fam_activities ?? [],
  famStartedOn: r.launched_on ?? '', agreementSignedOn: r.agreement_signed_on ?? '', nextStep: r.next_step ?? '', nextContactOn: r.next_contact_on ?? '', notes: r.notes ?? '',
});

export const toPerson = (r: any): Person => ({ id: r.id, firstName: r.first_name, lastName: r.last_name ?? '', email: r.email ?? '', phone: r.phone ?? '', street: r.street ?? '', zip: r.zip ?? '', homeChurchId: r.home_church_id, homeChurchText: r.home_church_text ?? '',
});

export const toRole = (r: any): PersonRole => ({ id: r.id, personId: r.person_id, role: r.role, churchId: r.church_id, title: r.title ?? '', status: r.status });

export const toFamily = (r: any): Family => ({
  id: r.id, name: r.name, homeTypes: r.home_types ?? [], familyStatus: r.family_status, careStatus: r.care_status, maritalStatus: r.marital_status ?? '',
  street: r.street ?? '', unit: r.unit ?? '', city: r.town ?? '', state: r.state ?? '', zip: r.zip ?? '', county: r.county ?? '',
  homeChurchId: r.home_church_id, homeChurchText: r.home_church_text ?? '', servingChurchId: r.church_id, servingChurchText: r.serving_church_text ?? '', prayerRequest: r.prayer_request ?? '',
  nextContactOn: r.next_contact_on ?? '', notes: r.notes ?? '', createdAt: r.created_at,
});

export const toMember = (r: any): FamilyMember => ({ familyId: r.family_id, personId: r.person_id, relationship: r.relationship, isPrimary: r.is_primary });

export const toChild = (r: any): Child => ({ id: r.id, familyId: r.family_id, firstName: r.first_name ?? '', birthYear: r.birth_year, relationship: r.relationship, inHome: r.in_home, notes: r.notes ?? '' });

export const toCareCommunity = (r: any): CareCommunity => ({ id: r.id, familyId: r.family_id, churchId: r.church_id, status: r.status, launchedOn: r.launched_on ?? '', closedOn: r.closed_on ?? '' });

export const toInteraction = (r: any): Interaction => ({
  id: r.id, at: r.at, method: r.method, reached: r.reached, summary: r.summary ?? '', familyId: r.family_id, personId: r.person_id, churchId: r.church_id, loggedBy: r.logged_by,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const orNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** App field names to database columns. Only the fields present in the patch are written. */
export function familyColumns(p: Partial<Family>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (p.name !== undefined) c.name = p.name.trim();
  if (p.homeTypes !== undefined) c.home_types = p.homeTypes;
  if (p.familyStatus !== undefined) c.family_status = p.familyStatus;
  if (p.careStatus !== undefined) c.care_status = p.careStatus;
  if (p.maritalStatus !== undefined) c.marital_status = orNull(p.maritalStatus);
  if (p.street !== undefined) c.street = orNull(p.street);
  if (p.unit !== undefined) c.unit = orNull(p.unit);
  if (p.city !== undefined) c.town = orNull(p.city);
  if (p.state !== undefined) c.state = orNull(p.state);
  if (p.zip !== undefined) c.zip = orNull(p.zip);
  if (p.county !== undefined) c.county = orNull(p.county);
  if (p.homeChurchId !== undefined) c.home_church_id = p.homeChurchId;
  if (p.homeChurchText !== undefined) c.home_church_text = orNull(p.homeChurchText);
  if (p.servingChurchId !== undefined) c.church_id = p.servingChurchId;
  if (p.servingChurchText !== undefined) c.serving_church_text = orNull(p.servingChurchText);
  if (p.prayerRequest !== undefined) c.prayer_request = orNull(p.prayerRequest);
  if (p.nextContactOn !== undefined) c.next_contact_on = orNull(p.nextContactOn);
  if (p.notes !== undefined) c.notes = orNull(p.notes);
  return c;
}

export function churchColumns(p: Partial<Church>): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (p.name !== undefined) c.name = p.name.trim();
  if (p.campus !== undefined) c.campus = orNull(p.campus);
  if (p.status !== undefined) c.status = p.status;
  if (p.street !== undefined) c.street = orNull(p.street);
  if (p.city !== undefined) c.town = orNull(p.city);
  if (p.state !== undefined) c.state = orNull(p.state);
  if (p.zip !== undefined) c.zip = orNull(p.zip);
  if (p.county !== undefined) c.county = orNull(p.county);
  if (p.website !== undefined) c.website = orNull(p.website);
  if (p.coachId !== undefined) c.coach_id = p.coachId;
  if (p.coachPriority !== undefined) c.coach_priority = p.coachPriority;
  if (p.famActivities !== undefined) c.fam_activities = p.famActivities;
  if (p.famStartedOn !== undefined) c.launched_on = orNull(p.famStartedOn);
  if (p.agreementSignedOn !== undefined) c.agreement_signed_on = orNull(p.agreementSignedOn);
  if (p.nextStep !== undefined) c.next_step = orNull(p.nextStep);
  if (p.nextContactOn !== undefined) c.next_contact_on = orNull(p.nextContactOn);
  if (p.notes !== undefined) c.notes = orNull(p.notes);
  return c;
}

/** Read everything the Live tool shows. Row level security decides what comes back. */
export async function loadLive(sb: SupabaseClient): Promise<LiveData> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [staff, churches, people, roles, families, members, children, ccs, interactions, dismissals, profiles] = await Promise.all([
    all<any>(sb, 'coaches'), all<any>(sb, 'churches'), all<any>(sb, 'people'), all<any>(sb, 'person_roles'), all<any>(sb, 'families'),
    all<any>(sb, 'family_members'), all<any>(sb, 'children'), all<any>(sb, 'care_communities'), all<any>(sb, 'interactions', 'at'), all<any>(sb, 'review_dismissals', 'decided_at'),
    sb.from('profiles').select('id, full_name'),
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const userNames: Record<string, string> = {};
  for (const p of profiles.data ?? []) if (p.full_name) userNames[p.id] = p.full_name;
  return {
    staff: staff.map(toStaff).sort((a, b) => a.name.localeCompare(b.name)),
    churches: churches.map(toChurch).sort((a, b) => a.name.localeCompare(b.name)),
    people: people.map(toPerson),
    roles: roles.map(toRole),
    families: families.map(toFamily).sort((a, b) => a.name.localeCompare(b.name)),
    members: members.map(toMember),
    children: children.map(toChild),
    careCommunities: ccs.map(toCareCommunity),
    interactions: interactions.map(toInteraction),
    userNames,
    dismissed: dismissals.map((d) => `${d.kind}:${d.key}`),
  };
}

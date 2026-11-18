// Types for the Live tool. They follow the 1.0 data model in
// supabase/migrations/20261118000000_model_1_0.sql, not the Prototype's types.
// Calendar dates are 'YYYY-MM-DD' strings, or '' when not set.

export const CHURCH_STATUSES = ['Potential Prospect', 'Active Prospect', 'Informed', 'Engaged', 'Equipped', 'On Hold', 'Needs Re-engagement', 'Closed', 'Not Interested'] as const;
export type ChurchStatus = (typeof CHURCH_STATUSES)[number];
/** A church with one of these statuses has a FAM that can serve families. */
export const SERVING_STATUSES: ChurchStatus[] = ['Engaged', 'Equipped'];

export const HOME_TYPES = ['Foster', 'Adoptive', 'Kinship', 'Non-relative', 'Pre-adoptive', 'Guardianship', 'Safe Families'] as const;
export type HomeType = (typeof HOME_TYPES)[number];

export const FAMILY_STATUSES = ['Licensing', 'Active', 'On Hold', 'Closed'] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

export const CARE_STATUSES = ['Community & Prayer', 'Care Requested', 'Priority Care', 'No Care Community Wanted'] as const;
export type CareStatus = (typeof CARE_STATUSES)[number];

export const MARITAL_STATUSES = ['Married', 'Single', 'Separated', 'Divorced', 'Widowed', 'Unknown'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const MEMBER_RELATIONSHIPS = ['Mom', 'Dad', 'Caregiver', 'Other adult'] as const;
export type MemberRelationship = (typeof MEMBER_RELATIONSHIPS)[number];

export const CHILD_RELATIONSHIPS = ['Foster', 'Adopted', 'Biological', 'Kinship', 'Pre-adoptive', 'Guardianship', 'Unknown'] as const;
export type ChildRelationship = (typeof CHILD_RELATIONSHIPS)[number];

export const CC_STATUSES = ['Building team', 'Active', 'Paused', 'Closed'] as const;
export type CcStatus = (typeof CC_STATUSES)[number];

export const METHODS = ['Call', 'Voicemail', 'Text', 'Email', 'In person', 'Mail', 'Social', 'Event', 'Note'] as const;
export type Method = (typeof METHODS)[number];

/** The roles someone can hold at a church. The database allows more (donor, board and so on). */
export const CHURCH_ROLES = ['Advocate', 'Point Person', 'Pastor', 'Church Staff', 'Volunteer'] as const;
export type ChurchRole = (typeof CHURCH_ROLES)[number];

export interface Staff {
  id: string;
  name: string;
  team: string;
}

export interface Church {
  id: string;
  name: string;
  campus: string;
  status: ChurchStatus;
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  website: string;
  coachId: string | null;
  coachPriority: 'Normal' | 'Low';
  famActivities: string[];
  famStartedOn: string;
  agreementSignedOn: string;
  nextStep: string;
  nextContactOn: string;
  notes: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  notes: string;
  homeChurchId: string | null;
  /** Their church as typed, while it is not matched to a church in the list. */
  homeChurchText: string;
}

export interface PersonRole {
  id: string;
  personId: string;
  role: string;
  churchId: string | null;
  title: string;
  status: string;
}

export interface Family {
  id: string;
  name: string;
  homeTypes: HomeType[];
  familyStatus: FamilyStatus;
  careStatus: CareStatus;
  maritalStatus: MaritalStatus | '';
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  /** The church the family attends. */
  homeChurchId: string | null;
  /** The church as the family named it, when it is not in the church list. */
  homeChurchText: string;
  /** The church whose FAM serves the family. */
  servingChurchId: string | null;
  /** The serving church as the spreadsheet typed it, until someone confirms which church it is. */
  servingChurchText: string;
  prayerRequest: string;
  nextContactOn: string;
  notes: string;
  createdAt: string;
}

export interface FamilyMember {
  familyId: string;
  personId: string;
  relationship: MemberRelationship;
  isPrimary: boolean;
}

export interface Child {
  id: string;
  familyId: string;
  firstName: string;
  birthYear: number | null;
  relationship: ChildRelationship;
  inHome: boolean;
  /** For a child loaded from the spreadsheet, the age band it listed. */
  notes: string;
}

export interface CareCommunity {
  id: string;
  familyId: string;
  churchId: string | null;
  status: CcStatus;
  launchedOn: string;
  closedOn: string;
}

export interface Interaction {
  id: string;
  at: string; // ISO timestamp
  method: Method;
  reached: boolean;
  summary: string;
  familyId: string | null;
  personId: string | null;
  churchId: string | null;
  loggedBy: string | null;
}

export interface LiveData {
  staff: Staff[];
  churches: Church[];
  people: Person[];
  roles: PersonRole[];
  families: Family[];
  members: FamilyMember[];
  children: Child[];
  careCommunities: CareCommunity[];
  interactions: Interaction[];
  /** Names of the people who can sign in, for "logged by". Only staff can read these. */
  userNames: Record<string, string>;
  /** Data check items someone has looked at and left as they are, as "kind:key". */
  dismissed: string[];
}

export const EMPTY: LiveData = { staff: [], churches: [], people: [], roles: [], families: [], members: [], children: [], careCommunities: [], interactions: [], userNames: {}, dismissed: [] };

/** Age and age band worked out from the year of birth, so they never go stale. */
export function ageBand(birthYear: number | null, year = new Date().getFullYear()): { age: number | null; band: string } {
  if (!birthYear) return { age: null, band: 'Unknown' };
  const age = year - birthYear;
  const band = age <= 4 ? 'Preschool' : age <= 10 ? 'Elementary' : age <= 13 ? 'Middle' : age <= 17 ? 'Teen' : 'Adult';
  return { age, band };
}

/**
 * What to show for a family's Care Community. A team that is building or active
 * wins; otherwise it is what the family has asked for.
 */
export function careLabel(f: Family, ccs: CareCommunity[]): string {
  const mine = ccs.filter((c) => c.familyId === f.id);
  if (mine.some((c) => c.status === 'Active')) return 'Active Care Community';
  if (mine.some((c) => c.status === 'Building team')) return 'Building team';
  if (mine.some((c) => c.status === 'Paused')) return 'Care Community paused';
  return f.careStatus;
}

export const personName = (p: Person | undefined): string => (p ? `${p.firstName} ${p.lastName}`.trim() : '');

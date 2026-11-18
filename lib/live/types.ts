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
  createdAt: string;
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
  createdAt: string;
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
  /** Kept on the entry, so it still says who logged it after their sign-in is removed. */
  loggedByName: string;
}

export const STAGES = ['To do', 'Reached out', 'Responded', 'Step taken', 'Not needed'] as const;
export type Stage = (typeof STAGES)[number];
export const QUEUES = ['Belong', 'FAM', 'Family Care', 'Development'] as const;
export type Queue = (typeof QUEUES)[number];
export const TRACKS = ['Serve', 'Start a FAM', 'Give', 'Foster', 'Pray', 'Talk to someone', 'Already involved', 'No follow-up'] as const;
export type Track = (typeof TRACKS)[number];
export const ROUTES = ['Shared queue', 'Church coach', 'Named owner', 'None'] as const;
export type Route = (typeof ROUTES)[number];

/** One thing a guest can tick on the "My Next Steps" form, and what C127 does about it. */
export interface NextStep {
  key: string;
  label: string;
  track: Track;
  action: string;
  route: Route;
  ownerId: string | null;
  sort: number;
  active: boolean;
}

/** A guest's answers to the form after walking through the Experience. */
export interface Response {
  id: string;
  submittedAt: string;
  personId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeChurchText: string;
  churchId: string | null;
  wallWords: string;
  feeling: string;
  heardFrom: string;
  nextSteps: string[];
  describes: string[];
  comments: string;
  likelyToInvite: number | null;
  source: string;
}

/** Something to do for a guest: one per kind of next step they ticked. */
export interface FollowUp {
  id: string;
  stage: Stage;
  /** The staff member it belongs to, or null when it sits in a shared queue. */
  staffId: string | null;
  queue: Queue | null;
  title: string;
  about: string;
  dueOn: string;
  personId: string | null;
  churchId: string | null;
  responseId: string | null;
  nextStepKey: string | null;
  outcome: string;
}

export interface Visit {
  id: string;
  visitedOn: string;
  personId: string | null;
  name: string;
  visitType: string;
}

export const FEEDBACK_KINDS = ['Idea', 'Something is wrong', 'Question'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_STATUSES = ['New', 'In progress', 'Done', 'Not doing'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Something a team member sent in from the Feedback button. */
export interface Feedback {
  id: string;
  createdAt: string;
  authorName: string;
  authorEmail: string;
  kind: FeedbackKind;
  message: string;
  /** The page they were on, and what it was showing. */
  pagePath: string;
  pageLabel: string;
  screen: string;
  status: FeedbackStatus;
  builderNote: string;
  resolvedAt: string;
}
export const isOutstanding = (f: Feedback): boolean => f.status === 'New' || f.status === 'In progress';

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
  nextSteps: NextStep[];
  responses: Response[];
  followUps: FollowUp[];
  visits: Visit[];
  /** Only the builder is sent any of these. */
  feedback: Feedback[];
  userNames: Record<string, string>;
  /** Data check items someone has looked at and left as they are, as "kind:key". */
  dismissed: string[];
}

export const EMPTY: LiveData = { staff: [], churches: [], people: [], roles: [], families: [], members: [], children: [], careCommunities: [], interactions: [], nextSteps: [], responses: [], followUps: [], visits: [], feedback: [], userNames: {}, dismissed: [] };

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

/**
 * A child's age band. From the year of birth when there is one; otherwise the
 * band the spreadsheet listed, which may be out of date.
 */
export function childBand(c: Child): string {
  if (c.birthYear) return ageBand(c.birthYear).band;
  const listed = c.notes.match(/Listed as ([A-Za-z/]+)/);
  return listed ? listed[1] : 'Unknown';
}
export const AGE_BANDS = ['Preschool', 'Elementary', 'Middle', 'Middle/High', 'Teen', 'Adult', 'Unknown'];

export const personName = (p: Person | undefined): string => (p ? `${p.firstName} ${p.lastName}`.trim() : '');

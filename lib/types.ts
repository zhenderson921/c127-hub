export type ChurchStage = 'Prospect' | 'Exploring' | 'Clinic scheduled' | 'Launching' | 'Active FAM' | 'Paused';
export type FamilyType = 'Foster' | 'Adoptive' | 'Kinship' | 'Reunification';
export type NeedType = 'Meal' | 'Childcare' | 'Transportation' | 'Tangible item' | 'Home & yard' | 'Tutoring' | 'Prayer';
export type NeedStatus = 'Open' | 'Claimed' | 'Completed';
export type GuestStage = 'Needs follow-up' | 'In sequence' | 'Responded' | 'Step taken';
export type Interest =
  | 'Bring a meal'
  | 'Join a Care Community'
  | 'Start a FAM at my church'
  | 'Foster or adopt'
  | 'Give'
  | 'Pray'
  | 'Bring a friend';

export interface Coach {
  id: string;
  name: string;
  email: string;
}

export interface Church {
  id: string;
  name: string;
  town: string;
  county: string;
  lat: number;
  lng: number;
  coachId: string;
  stage: ChurchStage;
  advocate: string;
  lastContact: number; // epoch ms
  launched?: number;
  capacity: number; // families the FAM can take on
}

export interface Family {
  id: string;
  name: string;
  type: FamilyType;
  town: string;
  county: string;
  zip: string;
  lat: number;
  lng: number;
  children: number;
  status: 'Active' | 'Paused' | 'Closed';
  churchId: string | null;
  careCommunity: boolean;
  lastContact: number;
  since: number;
  email: string;
  source: 'Promise Serves export' | 'Spreadsheet' | 'Intake form' | 'Import';
}

export interface Volunteer {
  id: string;
  name: string;
  churchId: string;
  role: 'Advocate' | 'Care Community' | 'Meals' | 'Childcare' | 'Driver' | 'Prayer';
  background: 'Cleared' | 'Pending' | 'Expired' | 'Not required';
  training: 'Complete' | 'In progress' | 'Not started';
  hours: number; // year to date
  lastServed: number | null;
}

export interface Need {
  id: string;
  familyId: string;
  churchId: string;
  type: NeedType;
  title: string;
  date: number;
  status: NeedStatus;
  volunteerId: string | null;
  hours: number;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  visit: number;
  churchId: string | null;
  churchName: string; // what they wrote on the form
  interests: Interest[];
  stage: GuestStage;
  touches: number;
  lastTouch: number;
  quote?: string;
}

export interface Task {
  id: string;
  coachId: string;
  title: string;
  due: number;
  about: string;
  auto: boolean;
  done: boolean;
}

export interface Gift {
  id: string;
  donor: string;
  amount: number;
  date: number;
  fund: 'General' | 'Center for Care & Calling' | 'Church Launch Fund';
  recurring: boolean;
}

export interface LogEntry {
  id: string;
  at: number;
  text: string;
}

export interface Data {
  createdAt: number;
  coaches: Coach[];
  churches: Church[];
  families: Family[];
  volunteers: Volunteer[];
  needs: Need[];
  guests: Guest[];
  tasks: Task[];
  gifts: Gift[];
  log: LogEntry[];
}

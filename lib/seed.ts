import type { Church, ChurchStage, Coach, Data, Family, FamilyType, Gift, Guest, Interest, Need, NeedType, Task, Volunteer } from './types';
import { DAY } from './util';

/**
 * Everything here is invented sample data, generated from a fixed seed so the
 * demo looks the same for everyone. No real family, church, volunteer or donor
 * appears in it. Only the headline scale (702 families, 70+ churches, roughly
 * 300 Experience guests in the past month and a half) mirrors Commission 127.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TOWNS: { name: string; county: string; lat: number; lng: number; zip: string; w: number }[] = [
  { name: 'Orlando', county: 'Orange', lat: 28.538, lng: -81.379, zip: '32801', w: 16 },
  { name: 'Altamonte Springs', county: 'Seminole', lat: 28.661, lng: -81.366, zip: '32714', w: 7 },
  { name: 'Winter Park', county: 'Orange', lat: 28.6, lng: -81.339, zip: '32789', w: 6 },
  { name: 'Oviedo', county: 'Seminole', lat: 28.67, lng: -81.208, zip: '32765', w: 6 },
  { name: 'Sanford', county: 'Seminole', lat: 28.8, lng: -81.273, zip: '32771', w: 5 },
  { name: 'Lake Mary', county: 'Seminole', lat: 28.759, lng: -81.318, zip: '32746', w: 4 },
  { name: 'Apopka', county: 'Orange', lat: 28.676, lng: -81.512, zip: '32703', w: 6 },
  { name: 'Winter Garden', county: 'Orange', lat: 28.565, lng: -81.586, zip: '34787', w: 5 },
  { name: 'Kissimmee', county: 'Osceola', lat: 28.292, lng: -81.408, zip: '34741', w: 8 },
  { name: 'St. Cloud', county: 'Osceola', lat: 28.249, lng: -81.281, zip: '34769', w: 4 },
  { name: 'Clermont', county: 'Lake', lat: 28.549, lng: -81.773, zip: '34711', w: 4 },
  { name: 'Longwood', county: 'Seminole', lat: 28.703, lng: -81.338, zip: '32750', w: 4 },
  { name: 'Casselberry', county: 'Seminole', lat: 28.678, lng: -81.328, zip: '32707', w: 3 },
  { name: 'Ocoee', county: 'Orange', lat: 28.569, lng: -81.544, zip: '34761', w: 4 },
  { name: 'Lake Nona', county: 'Orange', lat: 28.39, lng: -81.25, zip: '32827', w: 4 },
  { name: 'Maitland', county: 'Orange', lat: 28.628, lng: -81.363, zip: '32751', w: 3 },
  { name: 'Deltona', county: 'Volusia', lat: 28.9, lng: -81.26, zip: '32725', w: 3 },
  { name: 'Windermere', county: 'Orange', lat: 28.495, lng: -81.535, zip: '34786', w: 3 },
  { name: 'Avalon Park', county: 'Orange', lat: 28.51, lng: -81.15, zip: '32828', w: 3 },
  { name: 'Dr. Phillips', county: 'Orange', lat: 28.45, lng: -81.49, zip: '32819', w: 3 },
];

const FIRST = ['Ava', 'Ben', 'Carmen', 'Daniel', 'Elena', 'Felix', 'Grace', 'Hector', 'Imani', 'Jonah', 'Keisha', 'Liam', 'Marisol', 'Nate', 'Olivia', 'Pablo', 'Quinn', 'Rosa', 'Sam', 'Tessa', 'Uriel', 'Vera', 'Wes', 'Ximena', 'Yusuf', 'Zoe', 'Andre', 'Bianca', 'Cole', 'Dana', 'Eli', 'Farah', 'Gabe', 'Holly', 'Isaac', 'Jada', 'Kyle', 'Lena', 'Marcus', 'Nora'];
const LAST = ['Alvarez', 'Bennett', 'Castillo', 'Dawson', 'Ellis', 'Fontaine', 'Greene', 'Hartley', 'Ibarra', 'Jennings', 'Keller', 'Lawson', 'Mendez', 'Novak', 'Ortega', 'Parrish', 'Quintero', 'Reyes', 'Sutton', 'Tran', 'Underwood', 'Vasquez', 'Whitaker', 'Yates', 'Zamora', 'Abbott', 'Boone', 'Cruz', 'Delgado', 'Estes', 'Flores', 'Gaines', 'Holt', 'Irwin', 'Joyner', 'Knox', 'Lozano', 'Maddox', 'Nash', 'Okoro', 'Pruitt', 'Ramos', 'Shelby', 'Tolbert', 'Vance', 'Walsh', 'Becker', 'Calloway', 'Dixon', 'Emery'];
const CHURCH_KIND = ['Community Church', 'Fellowship', 'Baptist Church', 'Presbyterian Church', 'Bible Church', 'Methodist Church', 'Chapel', 'Church of the Redeemer', 'Family Church', 'Vineyard'];
const CHURCH_PREFIX = ['Grace', 'Hope', 'Harvest', 'Cornerstone', 'New Life', 'Living Water', 'Trinity', 'Crossroads', 'Covenant', 'Journey'];

const NEED_TITLES: Record<NeedType, string[]> = {
  Meal: ['Dinner after a new placement', 'Weekly meal', 'Meal during court week'],
  Childcare: ['Sitter for a date night', 'Childcare during training', 'After-school help'],
  Transportation: ['Ride to a family visit', 'Ride to therapy', 'School pick-up'],
  'Tangible item': ['Twin bed and bedding', 'Car seat', 'School clothes', 'Diapers and wipes'],
  'Home & yard': ['Lawn mowing', 'Assemble a crib', 'Minor home repair'],
  Tutoring: ['Reading help', 'Math tutoring'],
  Prayer: ['Prayer before a court date', 'Prayer for a hard week'],
};

const QUOTES = [
  'I had no idea how many kids are in care right here in our county.',
  'The bedroom scene undid me. I want to do something.',
  'I always thought you had to foster to help. Now I know I can bring a meal.',
  'Our small group needs to walk through this together.',
  'I want my pastor to see this.',
];

export function buildSeed(now = Date.now()): Data {
  const r = mulberry32(127);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const weightedTown = () => {
    const total = TOWNS.reduce((s, t) => s + t.w, 0);
    let x = r() * total;
    for (const t of TOWNS) {
      x -= t.w;
      if (x <= 0) return t;
    }
    return TOWNS[0];
  };
  const person = () => `${pick(FIRST)} ${pick(LAST)}`;
  const today = new Date(now).setHours(12, 0, 0, 0);

  const coaches: Coach[] = ['Maria Santos', 'David Okafor', 'Hannah Whitfield', 'Luis Herrera', 'Priya Raman', 'Caleb Brooks'].map((name, i) => ({
    id: `co${i + 1}`,
    name,
    email: `${name.split(' ')[0].toLowerCase()}@example.org`,
  }));

  // 74 churches across the stages of launching a Family Advocacy Ministry
  const stagePlan: [ChurchStage, number][] = [
    ['Active FAM', 41],
    ['Launching', 9],
    ['Clinic scheduled', 6],
    ['Exploring', 10],
    ['Prospect', 6],
    ['Paused', 2],
  ];
  const stages: ChurchStage[] = stagePlan.flatMap(([s, n]) => Array(n).fill(s));
  const usedNames = new Set<string>();
  const churches: Church[] = stages.map((stage, i) => {
    const t = weightedTown();
    let name = '';
    do {
      name = r() < 0.5 ? `${t.name} ${pick(CHURCH_KIND)}` : `${pick(CHURCH_PREFIX)} ${pick(CHURCH_KIND)} ${t.name}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const stale = r() < 0.27;
    return {
      id: `ch${i + 1}`,
      name,
      town: t.name,
      county: t.county,
      lat: t.lat + (r() - 0.5) * 0.07,
      lng: t.lng + (r() - 0.5) * 0.07,
      coachId: coaches[i % coaches.length].id,
      stage,
      advocate: person(),
      lastContact: today - (stale ? between(29, 75) : between(1, 26)) * DAY,
      launched: stage === 'Active FAM' ? today - between(90, 2200) * DAY : undefined,
      capacity: stage === 'Active FAM' ? between(8, 16) : stage === 'Launching' ? between(3, 6) : 0,
    };
  });
  const serving = churches.filter((c) => c.stage === 'Active FAM' || c.stage === 'Launching');

  // 702 families. Roughly 4 in 10 are not yet connected to a church.
  const typeRoll = (): FamilyType => {
    const x = r();
    return x < 0.48 ? 'Foster' : x < 0.75 ? 'Adoptive' : x < 0.92 ? 'Kinship' : 'Reunification';
  };
  const load: Record<string, number> = {};
  const families: Family[] = Array.from({ length: 702 }, (_, i) => {
    const t = weightedTown();
    const last = pick(LAST);
    const lat = t.lat + (r() - 0.5) * 0.11;
    const lng = t.lng + (r() - 0.5) * 0.11;
    let churchId: string | null = null;
    if (r() < 0.6) {
      const near = serving
        .map((c) => ({ c, d: (c.lat - lat) ** 2 + (c.lng - lng) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.c)
        .find((c) => (load[c.id] || 0) < c.capacity);
      if (near) {
        churchId = near.id;
        load[near.id] = (load[near.id] || 0) + 1;
      }
    }
    const srcRoll = r();
    return {
      id: `fa${i + 1}`,
      name: `${last} Family`,
      type: typeRoll(),
      town: t.name,
      county: t.county,
      zip: t.zip,
      lat,
      lng,
      children: between(1, 5),
      status: r() < 0.9 ? 'Active' : 'Paused',
      churchId,
      careCommunity: churchId !== null && r() < 0.72,
      lastContact: today - (r() < 0.3 ? between(30, 120) : between(1, 29)) * DAY,
      since: today - between(40, 2400) * DAY,
      email: `${last.toLowerCase()}${i + 1}@example.com`,
      source: srcRoll < 0.55 ? 'Promise Serves export' : srcRoll < 0.9 ? 'Spreadsheet' : 'Intake form',
    };
  });

  // Volunteers at serving churches
  const roles: Volunteer['role'][] = ['Care Community', 'Care Community', 'Meals', 'Meals', 'Childcare', 'Driver', 'Prayer'];
  const volunteers: Volunteer[] = [];
  for (const c of serving) {
    const n = c.stage === 'Active FAM' ? between(7, 22) : between(3, 7);
    for (let j = 0; j < n; j++) {
      const role = j === 0 ? 'Advocate' : pick(roles);
      const needsCheck = role === 'Childcare' || role === 'Driver' || role === 'Care Community' || role === 'Advocate';
      const bg = r();
      const tr = r();
      volunteers.push({
        id: `vo${volunteers.length + 1}`,
        name: j === 0 ? c.advocate : person(),
        churchId: c.id,
        role,
        background: !needsCheck ? 'Not required' : bg < 0.78 ? 'Cleared' : bg < 0.92 ? 'Pending' : 'Expired',
        training: tr < 0.7 ? 'Complete' : tr < 0.88 ? 'In progress' : 'Not started',
        hours: 0,
        lastServed: null,
      });
    }
  }
  const volsByChurch: Record<string, Volunteer[]> = {};
  for (const v of volunteers) (volsByChurch[v.churchId] ||= []).push(v);

  // Needs over the last six months and the next three weeks
  const needTypes: NeedType[] = ['Meal', 'Meal', 'Meal', 'Childcare', 'Transportation', 'Tangible item', 'Home & yard', 'Tutoring', 'Prayer'];
  const hoursFor: Record<NeedType, number> = { Meal: 1.5, Childcare: 3, Transportation: 1.5, 'Tangible item': 1, 'Home & yard': 2.5, Tutoring: 1.5, Prayer: 0.5 };
  const connected = families.filter((f) => f.churchId && f.status === 'Active');
  const needs: Need[] = [];
  for (let i = 0; i < 1900; i++) {
    const f = pick(connected);
    const type = pick(needTypes);
    const offset = between(-180, 21);
    const date = today + offset * DAY;
    const pool = volsByChurch[f.churchId!] || [];
    let status: Need['status'];
    if (offset < 0) status = r() < 0.93 ? 'Completed' : 'Open';
    else status = r() < 0.55 ? 'Claimed' : 'Open';
    const vol = status === 'Open' || pool.length === 0 ? null : pick(pool);
    if (!vol && status !== 'Open') status = 'Open';
    const hours = hoursFor[type];
    if (vol && status === 'Completed') {
      vol.hours += hours;
      vol.lastServed = Math.max(vol.lastServed || 0, date);
    }
    needs.push({ id: `ne${i + 1}`, familyId: f.id, churchId: f.churchId!, type, title: pick(NEED_TITLES[type]), date, status, volunteerId: vol ? vol.id : null, hours });
  }

  // Experience guests: about 312 in the past 45 days, most still waiting on a second touch
  const interests: Interest[] = ['Bring a meal', 'Join a Care Community', 'Start a FAM at my church', 'Foster or adopt', 'Give', 'Pray', 'Bring a friend'];
  const nonServing = churches.filter((c) => c.stage !== 'Active FAM' && c.stage !== 'Launching');
  const guests: Guest[] = Array.from({ length: 312 }, (_, i) => {
    const visit = today - between(0, 45) * DAY;
    const x = r();
    let churchId: string | null = null;
    let churchName = '';
    if (x < 0.52) {
      const c = pick(serving);
      churchId = c.id;
      churchName = c.name;
    } else if (x < 0.72) {
      const c = pick(nonServing);
      churchId = c.id;
      churchName = c.name;
    } else if (x < 0.87) {
      churchName = `${pick(CHURCH_PREFIX)} ${pick(['Assembly', 'Tabernacle', 'Christian Center'])}`;
    }
    const a = pick(interests);
    const b = pick(interests);
    const s = r();
    const stage: Guest['stage'] = s < 0.57 ? 'Needs follow-up' : s < 0.8 ? 'In sequence' : s < 0.92 ? 'Responded' : 'Step taken';
    const touches = stage === 'Needs follow-up' ? 1 : stage === 'In sequence' ? between(2, 4) : between(2, 5);
    const name = person();
    return {
      id: `gu${i + 1}`,
      name,
      email: `${name.replace(' ', '.').toLowerCase()}@example.com`,
      visit,
      churchId,
      churchName,
      interests: a === b ? [a] : [a, b],
      stage,
      touches,
      lastTouch: stage === 'Needs follow-up' ? visit : Math.min(today, visit + between(2, 20) * DAY),
      quote: r() < 0.22 ? pick(QUOTES) : undefined,
    };
  });

  // Coach to-dos that were typed in by hand. Reminders are computed live, not stored.
  const manual = ['Send FAM Clinic dates', 'Review Care Community roster', 'Share volunteer orientation link', 'Schedule vision lunch with pastor', 'Confirm advocate for fall launch', 'Collect family stories for newsletter'];
  const tasks: Task[] = Array.from({ length: 30 }, (_, i) => {
    const c = pick(churches);
    return { id: `ta${i + 1}`, coachId: c.coachId, title: pick(manual), due: today + between(-6, 14) * DAY, about: c.name, auto: false, done: r() < 0.2 };
  });

  // Gifts as they would arrive from Aplos
  const donors = Array.from({ length: 150 }, () => person());
  const gifts: Gift[] = [];
  donors.forEach((donor, i) => {
    const recurring = i % 4 === 0;
    const base = pick([25, 50, 50, 100, 100, 150, 250, 500, 1000]);
    const count = recurring ? 12 : between(1, 3);
    for (let k = 0; k < count; k++) {
      const f = r();
      gifts.push({
        id: `gi${gifts.length + 1}`,
        donor,
        amount: recurring ? base : base * pick([1, 1, 2, 5]),
        date: recurring ? today - (k * 30 + between(0, 4)) * DAY : today - between(1, 360) * DAY,
        fund: f < 0.62 ? 'General' : f < 0.85 ? 'Center for Care & Calling' : 'Church Launch Fund',
        recurring,
      });
    }
  });
  gifts.sort((a, b) => b.date - a.date);

  return { createdAt: now, coaches, churches, families, volunteers, needs, guests, tasks, gifts, log: [] };
}

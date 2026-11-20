#!/usr/bin/env node
// One-time preload of C127's spreadsheets into the Live tool.
//
//   node scripts/preload.mjs            dry run: reads the files, writes nothing,
//                                       prints counts
//   node scripts/preload.mjs --load     signs you in, shows what will be added,
//                                       and loads it in one all-or-nothing step
//
// Options:  --dir "<folder>"   where the spreadsheets are (default ../C127 Historic Docs)
//           --only churches,advocates,families,experience   load just some of them
//
// It reads the "Churches" and "Current Advocates" tabs of "Church Spreadsheet*.xlsx"
// and the "Main Information" tab of "Family Spreadsheet*.xlsx". For the Experience it
// reads the "VISITS" tab of "CCC_Visitors*.xlsx", "Form Responses 1" of the Google
// form's "My Next Steps*(Responses).xlsx", and the HubSpot form's export
// "My Next Steps*All Submissions.xlsx"; each answer becomes follow-ups in the hub. Running it twice is
// safe: churches, people and families that are already in the hub are skipped.
//
// Everything is loaded, including the parts that are not certain. A church name
// typed in shorthand that cannot be matched is kept as typed, and C127 staff
// confirm it afterwards on the Live tool's "Data check" page.
//
// It never prints a family's or a person's details. Real records go from the
// spreadsheet straight to Supabase; nothing is written into this repository.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import readXlsxFile from 'read-excel-file/node';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const DIR = path.resolve(option('--dir', path.join(here, '..', '..', 'C127 Historic Docs')));
const ONLY = option('--only', 'churches,advocates,families,experience').split(',').map((s) => s.trim());
const LOAD = flag('--load');

// ---------------------------------------------------------------------------
// The category lists, as the database accepts them
// ---------------------------------------------------------------------------
const CHURCH_STATUSES = ['Potential Prospect', 'Active Prospect', 'Informed', 'Engaged', 'Equipped', 'On Hold', 'Needs Re-engagement', 'Closed', 'Not Interested'];
const HOME_TYPES = ['Foster', 'Adoptive', 'Kinship', 'Non-relative', 'Pre-adoptive', 'Guardianship', 'Safe Families'];
// The child-count columns are a two-part code: age band, then how the child came to the family.
// "MH" and what "A" stands for are assumptions to confirm with C127.
const BANDS = { P: 'Preschool', E: 'Elementary', M: 'Middle', MH: 'Middle/High', T: 'Teen', A: 'Adult' };
const CHILD_TYPES = { A: 'Adopted', B: 'Biological', F: 'Foster', K: 'Kinship', U: 'Unknown' };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const norm = (v) => String(v ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

// Staff shorthand for places, as it appears in the spreadsheets ("Summit Orl", "Discovery WG").
const PLACE_SHORTHAND = { orl: 'orlando', wp: 'winter park', wg: 'winter garden', lm: 'lake mary' };
/**
 * A church name boiled down for matching: shorthand spelled out, the filler words
 * "the", "of" and "church" dropped, and spaces removed. So "First Baptist Orlando"
 * and "First Baptist Church of Orlando" come out the same, as do "New City" and "NewCity".
 */
const core = (v) =>
  norm(v)
    .split(' ')
    .map((w) => PLACE_SHORTHAND[w] ?? w)
    .join(' ')
    .split(' ')
    .filter((w) => w && !['the', 'of', 'church'].includes(w))
    .join('');

/** A cell as trimmed text. Dates become YYYY-MM-DD; whole numbers lose their ".0". */
function text(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return day(v) ?? '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : '';
  return String(v).replace(/\s+/g, ' ').trim();
}
const orNull = (v) => {
  const t = text(v);
  return t ? t : null;
};

/** A calendar day as YYYY-MM-DD, or null when the cell is not clearly a date. */
function day(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 30000 && v < 70000) return day(new Date(Math.round((v - 25569) * 86400000))); // spreadsheet serial date
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  return null;
}
function valid(y, mo, d) {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
const yes = (v) => v === true || /^(y|yes|true|x)\b/i.test(text(v));
const state = (v) => {
  const t = text(v);
  return /^(fl|florida)$/i.test(t) ? 'FL' : t.length === 2 ? t.toUpperCase() : t || null;
};
const zip = (v) => {
  const t = text(v).replace(/\.0+$/, '');
  return /^\d{1,5}$/.test(t) ? t.padStart(5, '0') : t || null;
};
const phone = (v) => {
  const t = text(v).replace(/\.0+$/, '');
  const digits = t.replace(/\D/g, '');
  return digits.length === 10 && !/[a-z]/i.test(t) ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : t || null;
};
const email = (v) => {
  const t = text(v);
  return t.includes('@') ? t.split(/[\s,;]+/).find((p) => p.includes('@')).toLowerCase() : null;
};
const lines = (...parts) => parts.filter(Boolean).join('\n') || null;

/** How alike two names are, 0 to 1, by shared letter pairs. Only used to suggest a match for review. */
function alike(a, b) {
  const grams = (s) => {
    const t = norm(s).replace(/ /g, '');
    const set = new Map();
    for (let i = 0; i < t.length - 1; i++) set.set(t.slice(i, i + 2), (set.get(t.slice(i, i + 2)) || 0) + 1);
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  let shared = 0;
  let total = 0;
  for (const [g, n] of A) {
    shared += Math.min(n, B.get(g) || 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total ? (2 * shared) / total : 0;
}

class Tally {
  constructor() {
    this.counts = new Map();
  }
  add(label, n = 1) {
    this.counts.set(label, (this.counts.get(label) || 0) + n);
  }
  print(indent = '    ') {
    for (const [label, n] of this.counts) console.log(`${indent}${String(n).padStart(5)}  ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Reading a tab
// ---------------------------------------------------------------------------
function findFile(pattern) {
  if (!fs.existsSync(DIR)) return null;
  const hits = fs.readdirSync(DIR).filter((f) => pattern.test(f) && !f.startsWith('~$'));
  hits.sort((a, b) => fs.statSync(path.join(DIR, b)).mtimeMs - fs.statSync(path.join(DIR, a)).mtimeMs);
  return hits[0] ? path.join(DIR, hits[0]) : null;
}

/** One tab as a list of rows that can be read by column heading. */
async function readTab(file, tabName, expected) {
  const sheets = await readXlsxFile(file);
  const sheet = sheets.find((s) => norm(s.sheet) === norm(tabName));
  if (!sheet) throw new Error(`No "${tabName}" tab in ${path.basename(file)}. Tabs: ${sheets.map((s) => s.sheet.trim()).join(', ')}`);
  // The headings are the row, among the first five, that has the most of the headings we expect.
  const want = new Set(expected.map(norm));
  let headerAt = 0;
  let best = -1;
  sheet.data.slice(0, 5).forEach((row, i) => {
    const score = row.filter((c) => want.has(norm(c))).length;
    if (score > best) [best, headerAt] = [score, i];
  });
  const headers = sheet.data[headerAt].map((h) => text(h));
  const index = new Map();
  headers.forEach((h, i) => {
    if (h && !index.has(norm(h))) index.set(norm(h), i);
  });
  const rows = sheet.data.slice(headerAt + 1).filter((r) => r.some((c) => text(c) !== ''));
  const get = (row, ...names) => {
    for (const n of names) if (index.has(norm(n))) return row[index.get(norm(n))];
    return null;
  };
  // For a form question, whose heading is the whole question: match on how it starts.
  const getStarting = (row, start) => {
    const i = headers.findIndex((h) => norm(h).startsWith(norm(start)));
    return i < 0 ? null : row[i];
  };
  // The second column with a given heading, for sheets that repeat one.
  const getSecond = (row, name) => {
    const hits = headers.map((h, i) => (norm(h) === norm(name) ? i : -1)).filter((i) => i >= 0);
    return hits.length > 1 ? row[hits[1]] : null;
  };
  const missing = expected.filter((h) => !index.has(norm(h)));
  return { file: path.basename(file), tab: sheet.sheet.trim(), headers, rows, get, getStarting, getSecond, missing };
}

// ---------------------------------------------------------------------------
// What is already in the hub, and what this run adds
// ---------------------------------------------------------------------------
class Hub {
  constructor(existing) {
    this.staff = [...existing.coaches]; // { id, name }
    this.churches = [...existing.churches]; // { id, name, campus }
    this.aliases = [...existing.church_aliases]; // { church_id, alias }
    this.peopleByEmail = new Map(); // "email|first" -> id
    this.peopleByName = new Map(); // "first last|church" -> id
    for (const p of existing.people) this.rememberPerson(p);
    this.roles = new Set(existing.person_roles.map((r) => `${r.person_id}|${r.role}|${r.church_id ?? ''}`));
    this.onboarded = new Set(existing.advocate_onboarding.map((r) => r.person_id));
    this.familyKeys = new Set(existing.families.map((f) => familyKey(f.name, f.street, f.zip)));
    this.familyMembers = new Set(existing.family_members.map((m) => m.person_id));
    this.visitCodes = new Set(existing.visits.map((v) => v.visit_code));
    this.responseIds = new Set(existing.vce_responses.map((r) => r.external_id));
    // The same person answering on the same day is one answer, whichever form it came through.
    this.responseDays = new Set(existing.vce_responses.filter((r) => r.email && r.submitted_at).map((r) => `${r.email.toLowerCase()}|${r.submitted_at.slice(0, 10)}`));
    this.out = { coaches: [], churches: [], church_aliases: [], people: [], person_roles: [], advocate_onboarding: [], families: [], family_members: [], children: [], care_communities: [], visits: [], vce_responses: [] };
    this.unmatched = new Map(); // typed church name -> { name, where:Set, rows }
    this.loose = new Map(); // typed name -> church id, matched on the boiled-down name
  }

  rememberPerson(p) {
    if (p.email) this.peopleByEmail.set(`${p.email.toLowerCase()}|${norm(p.first_name)}`, p.id);
    this.peopleByName.set(`${norm(p.first_name)} ${norm(p.last_name)}|${p.home_church_id ?? ''}`, p.id);
  }

  /** The id of this person if they are already known, by email and first name, or by full name at the same church. */
  findPerson(first, last, mail, churchId) {
    if (mail && this.peopleByEmail.has(`${mail}|${norm(first)}`)) return this.peopleByEmail.get(`${mail}|${norm(first)}`);
    if (!mail && churchId && last) return this.peopleByName.get(`${norm(first)} ${norm(last)}|${churchId}`) ?? null;
    return null;
  }

  addPerson(p) {
    const row = {
      id: randomUUID(), first_name: p.first, last_name: p.last || null, email: p.email || null, phone: p.phone || null,
      street: p.street || null, unit: p.unit || null, city: p.city || null, state: p.state || null, zip: p.zip || null, county: p.county || null,
      home_church_id: p.homeChurchId || null, home_church_text: p.homeChurchText || null, birthday: p.birthday || null, shirt_size: p.shirtSize || null,
      notes: p.notes || null, source: 'Spreadsheet',
    };
    this.out.people.push(row);
    this.rememberPerson(row);
    return row.id;
  }

  addRole(personId, role, churchId, title, status = 'Active') {
    const key = `${personId}|${role}|${churchId ?? ''}`;
    if (this.roles.has(key)) return false;
    this.roles.add(key);
    this.out.person_roles.push({ id: randomUUID(), person_id: personId, role, church_id: churchId, title: title || null, status });
    return true;
  }

  /** Staff by name. A first name alone is taken as the one staff member whose full name starts with it. */
  staffId(name, knownFullNames) {
    let wanted = name.trim();
    if (!wanted) return null;
    if (!wanted.includes(' ')) {
      const full = knownFullNames.filter((n) => norm(n).split(' ')[0] === norm(wanted));
      if (full.length === 1) wanted = full[0];
    }
    let s = this.staff.find((x) => norm(x.name) === norm(wanted));
    if (!s) {
      s = { id: randomUUID(), name: wanted, team: 'FAM' };
      this.staff.push(s);
      this.out.coaches.push(s);
    }
    return s.id;
  }

  /** The church a typed name refers to, when exactly one church fits. */
  church(typed) {
    const key = norm(typed);
    if (!key || NO_CHURCH.test(key)) return null;
    const hits = new Set();
    for (const c of this.churches) {
      if (norm(c.name) === key || (c.campus && (norm(`${c.name} ${c.campus}`) === key || norm(`${c.campus} ${c.name}`) === key))) hits.add(c.id);
    }
    for (const a of this.aliases) if (norm(a.alias) === key) hits.add(a.church_id);
    if (hits.size === 1) return [...hits][0];
    if (hits.size > 1) return null; // the same name at more than one campus: a person has to say which
    // No exact match. Try the boiled-down name, and accept it only when exactly one church fits.
    const want = core(typed);
    if (!want) return null;
    for (const c of this.churches) {
      if (core(c.name) === want || (c.campus && (core(`${c.name} ${c.campus}`) === want || core(`${c.campus} ${c.name}`) === want))) hits.add(c.id);
    }
    if (hits.size !== 1) return null;
    this.loose.set(text(typed), [...hits][0]);
    return [...hits][0];
  }

  noteUnmatched(typed, where) {
    const key = norm(typed);
    if (NO_CHURCH.test(key)) return;
    const u = this.unmatched.get(key) ?? { name: text(typed), where: new Set(), rows: 0 };
    u.where.add(where);
    u.rows += 1;
    this.unmatched.set(key, u);
  }

}
/** Things typed in a church column that mean "no church". */
const NO_CHURCH = /^(none|n a|na|no|no church|unknown|tbd|not sure)$/;
const familyKey = (name, street, z) => `${norm(name)}|${norm(street)}|${text(z)}`;

// ---------------------------------------------------------------------------
// Churches tab
// ---------------------------------------------------------------------------
const CHURCH_COLUMNS = ['Church Name', 'Campus', 'Status', 'Church Note', 'Next Steps', 'Next contact date', 'FAM Coach', 'FAM Activities', 'FAM Name', 'Address', 'City', 'State', 'Zip', 'County', 'Website', 'FAM Start Date', 'Agreement Sign Date'];

function parseCoach(v) {
  const raw = text(v);
  if (!raw || /^tbd$/i.test(raw)) return { name: '', low: false };
  const m = raw.match(/^(.*?)\s*-\s*low$/i);
  return m ? { name: m[1].trim(), low: true } : { name: raw, low: false };
}

function loadChurches(tab, hub, coachNames, tally) {
  const seen = new Set(hub.churches.map((c) => `${norm(c.name)}|${norm(c.campus)}`));
  for (const row of tab.rows) {
    const name = text(tab.get(row, 'Church Name'));
    if (!name) continue;
    const campus = text(tab.get(row, 'Campus'));
    const key = `${norm(name)}|${norm(campus)}`;
    if (seen.has(key)) {
      tally.add('churches already in the hub or listed twice (skipped)');
      continue;
    }
    seen.add(key);

    const rawStatus = text(tab.get(row, 'Status'));
    let status = CHURCH_STATUSES.find((s) => norm(s) === norm(rawStatus));
    if (!status) {
      status = 'Potential Prospect';
      tally.add(`status "${rawStatus || 'blank'}" not recognised, set to Potential Prospect`);
    }
    const coach = parseCoach(tab.get(row, 'FAM Coach'));
    const nextRaw = tab.get(row, 'Next contact date');
    const nextOn = day(nextRaw);
    const nextStep = lines(text(tab.get(row, 'Next Steps')), !nextOn && text(nextRaw) ? `Next contact: ${text(nextRaw)}` : '');
    const activities = [...new Set(text(tab.get(row, 'FAM Activities')).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean))];
    const notes = lines(...['Church Note', 'Note 1', 'Note 2', 'Note 3', 'Note 4', 'Note 5'].map((h) => text(tab.get(row, h))));

    const church = {
      id: randomUUID(), name, campus: campus || null, status, street: orNull(tab.get(row, 'Address')), unit: orNull(tab.get(row, 'Address 2')),
      town: orNull(tab.get(row, 'City')), state: state(tab.get(row, 'State')), zip: zip(tab.get(row, 'Zip')), county: orNull(tab.get(row, 'County')),
      website: orNull(tab.get(row, 'Website')), social_handle: orNull(tab.get(row, 'FB/IG handle')),
      coach_id: coach.name ? hub.staffId(coach.name, coachNames) : null, coach_priority: coach.low ? 'Low' : 'Normal',
      fam_name: orNull(tab.get(row, 'FAM Name')), fam_activities: activities, launched_on: day(tab.get(row, 'FAM Start Date')),
      agreement_signed_on: day(tab.get(row, 'Agreement Sign Date')), next_step: nextStep, next_contact_on: nextOn, notes,
    };
    hub.out.churches.push(church);
    hub.churches.push(church);
    tally.add('churches to add');
    if (!coach.name) tally.add('churches with no coach yet');

    // Up to two named contacts, as people with a role at this church.
    for (const n of ['1', '2']) {
      const who = text(tab.get(row, `Church Contact ${n} (Primary for myFAM)`, `Church Contact ${n}`)).replace(/^(pastor|ps\.?|rev\.?|dr\.?)\s+/i, '');
      if (!who) continue;
      const [first, ...rest] = who.split(' ');
      const last = rest.join(' ');
      const mail = email(tab.get(row, `Church Contact ${n} Email`));
      const title = text(tab.get(row, `Church Contact ${n} role`));
      const id = hub.findPerson(first, last, mail, church.id) ?? hub.addPerson({ first, last, email: mail, homeChurchId: church.id });
      if (hub.addRole(id, /pastor/i.test(title) ? 'Pastor' : 'Church Staff', church.id, title)) tally.add('church contacts to add');
    }
  }
}

// ---------------------------------------------------------------------------
// Current Advocates tab
// ---------------------------------------------------------------------------
const ADVOCATE_COLUMNS = ['First Name', 'Last Name', 'Email', 'Church', 'Status', 'Role', 'FAM Coach', 'Mobile Phone', 'Address', 'City', 'State', 'Zip', 'County', 'Date Completed Clinic', 'Promoted'];

function loadAdvocates(tab, hub, tally) {
  for (const row of tab.rows) {
    const first = text(tab.get(row, 'First Name'));
    const last = text(tab.get(row, 'Last Name'));
    if (!first && !last) continue;
    const typedChurch = text(tab.get(row, 'Church'));
    // An advocate whose church is not matched yet is still loaded. The church stays as
    // typed on the person, and their role and onboarding wait for the Data check page.
    const churchId = hub.church(typedChurch);
    if (!churchId) {
      if (typedChurch) hub.noteUnmatched(typedChurch, 'advocates');
      tally.add('advocates whose church is kept as typed, to confirm');
    }
    const rawStatus = text(tab.get(row, 'Status'));
    const rawRole = text(tab.get(row, 'Role'));
    const pointPerson = /point person/i.test(rawStatus) || /point person/i.test(rawRole);
    const role = pointPerson ? 'Point Person' : 'Advocate';
    const onHold = /on hold/i.test(rawStatus);
    const step = /pre-?\s*clinic/i.test(rawStatus) ? 'Pre-Clinic' : /post-?\s*clinic/i.test(rawStatus) ? 'Post-Clinic' : onHold ? 'On Hold' : 'Active';
    if (!/^(active|point person|on hold|pre-?\s*clinic|post-?\s*clinic)$/i.test(rawStatus)) tally.add(`advocate status "${rawStatus || 'blank'}" not recognised, set to Active`);
    const title = /^church\s+advocate$/i.test(rawRole) || /^point person$/i.test(rawRole) ? '' : rawRole;

    const mail = email(tab.get(row, 'Email'));
    let id = hub.findPerson(first, last, mail, churchId);
    if (!id) {
      const birthday = tab.get(row, 'BIRTHDAY') instanceof Date ? day(tab.get(row, 'BIRTHDAY')) : null;
      id = hub.addPerson({
        first: first || last, last: first ? last : '', email: mail, phone: phone(tab.get(row, 'Mobile Phone')), street: text(tab.get(row, 'Address')), unit: text(tab.get(row, 'Apt', 'Apt.')),
        city: text(tab.get(row, 'City')), state: state(tab.get(row, 'State')), zip: zip(tab.get(row, 'Zip')), county: text(tab.get(row, 'County')), homeChurchId: churchId,
        homeChurchText: churchId ? '' : typedChurch,
        birthday, shirtSize: text(tab.get(row, 'Shirt Size')), notes: lines(text(tab.get(row, 'Advocate details')), text(tab.get(row, 'Current notes on FAM/Advocate'))),
      });
    }
    if (!hub.addRole(id, role, churchId, title, onHold ? 'On Hold' : 'Active')) {
      tally.add('advocates already in the hub or listed twice (skipped)');
      continue;
    }
    tally.add('advocates to add');
    if (!hub.onboarded.has(id)) {
      hub.onboarded.add(id);
      hub.out.advocate_onboarding.push({
        person_id: id, church_id: churchId, step, pre_clinic_call_on: day(tab.get(row, 'Pre-Clinic Call date')), clinic_completed_on: day(tab.get(row, 'Date Completed Clinic')),
        post_clinic_call_on: day(tab.get(row, 'Post Clinic Call date')), fam_basics_completed_on: day(tab.get(row, 'Date Completed FAM Basics')),
        promoted: yes(tab.get(row, 'Promoted')), next_contact_on: day(tab.get(row, 'Next contact date')), details: orNull(tab.get(row, 'Advocate details')),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main Information tab (families)
// ---------------------------------------------------------------------------
const FAMILY_COLUMNS = ['Mom First Name', 'Dad First Name', 'Last Name', 'Marital Status', 'Home Type', 'CC Status', 'Home Church', 'Serving Church', 'Primary Phone #', 'Email', 'Address', 'City', 'State', 'Zip Code', 'County', 'Total Kids'];

function marital(v, notes) {
  const t = text(v);
  const n = norm(t);
  if (!n) return null;
  if (/^marr+ied$/.test(n)) return 'Married';
  if (n.includes('widow')) return 'Widowed';
  if (n.startsWith('divorc')) return 'Divorced';
  if (n.startsWith('separat')) return 'Separated';
  if (n === 'single' || /^single (mom|dad)$/.test(n)) return 'Single';
  // "2 moms", "Married?", "Single - sisters" and the like say more than one word can. Keep them as written.
  notes.push(`Marital status in the spreadsheet: ${t}`);
  return n.startsWith('single') ? 'Single' : n.startsWith('marr') ? 'Married' : 'Unknown';
}

function loadFamilies(tab, hub, tally) {
  const codeColumns = tab.headers
    .map((h, i) => ({ m: h.toUpperCase().match(/^(MH|P|E|M|T|A)(A|B|F|K|U)$/), i }))
    .filter((c) => c.m)
    .map((c) => ({ i: c.i, band: BANDS[c.m[1]], type: CHILD_TYPES[c.m[2]] }));

  for (const row of tab.rows) {
    const mom = text(tab.get(row, 'Mom First Name'));
    const dad = text(tab.get(row, 'Dad First Name'));
    const last = text(tab.get(row, 'Last Name'));
    if (!mom && !dad && !last) continue;
    const name = `${last || mom || dad} family`;
    const street = text(tab.get(row, 'Address'));
    const z = zip(tab.get(row, 'Zip Code', 'Zip'));
    const key = familyKey(name, street, z);
    const mail = email(tab.get(row, 'Email'));
    const primaryFirst = mom || dad;
    const knownPrimary = primaryFirst ? hub.findPerson(primaryFirst, last, mail, null) : null;
    if (hub.familyKeys.has(key) || (knownPrimary && hub.familyMembers.has(knownPrimary))) {
      tally.add('families already in the hub or listed twice (skipped)');
      continue;
    }
    hub.familyKeys.add(key);
    const notes = [];

    // Home type: "Adoptive/Foster" is two types. "Closed" and "On Hold" in this column are statuses.
    let familyStatus = 'Active';
    const homeTypes = [];
    for (const part of text(tab.get(row, 'Home Type')).split('/').map((s) => s.trim()).filter(Boolean)) {
      const t = HOME_TYPES.find((h) => norm(h) === norm(part));
      if (t) homeTypes.includes(t) || homeTypes.push(t);
      else if (/^closed$/i.test(part)) familyStatus = 'Closed';
      else if (/^on hold$/i.test(part)) familyStatus = 'On Hold';
      else {
        notes.push(`Home type in the spreadsheet: ${part}`);
        tally.add(`home type "${part}" not recognised (kept in notes)`);
      }
    }

    // CC Status mixes three things: where the family is, what they want, and whether a Care Community exists.
    let careStatus = 'Community & Prayer';
    const rank = { 'Community & Prayer': 0, 'No Care Community Wanted': 1, 'Care Requested': 2, 'Priority Care': 3 };
    const want = (s) => {
      if (rank[s] > rank[careStatus]) careStatus = s;
    };
    const communities = [];
    for (const part of text(tab.get(row, 'CC Status')).split(',').map((s) => s.trim()).filter(Boolean)) {
      const p = norm(part);
      if (p === 'care requested') want('Care Requested');
      else if (p === 'priority care') want('Priority Care');
      else if (p === 'community and prayer') want('Community & Prayer');
      else if (p === 'confirmed no cc requested') want('No Care Community Wanted');
      else if (p === 'licensing') familyStatus = familyStatus === 'Active' ? 'Licensing' : familyStatus;
      else if (p === 'on hold') familyStatus = familyStatus === 'Closed' ? 'Closed' : 'On Hold';
      else if (p === 'active care community') communities.push('Active');
      else if (p === 'building team') communities.push('Building team');
      else if (p === 'previously served') communities.push('Closed');
      else {
        notes.push(`CC status in the spreadsheet: ${part}`);
        tally.add(`CC status "${part}" not recognised (kept in notes)`);
      }
    }

    const typedHome = text(tab.get(row, 'Home Church'));
    const typedServing = text(tab.get(row, 'Serving Church'));
    const homeChurchId = hub.church(typedHome);
    const servingChurchId = hub.church(typedServing);
    if (typedHome && !homeChurchId && !NO_CHURCH.test(norm(typedHome))) {
      hub.noteUnmatched(typedHome, 'home church');
      tally.add('families whose home church is kept as typed, to confirm');
    }
    if (typedServing && !servingChurchId && !NO_CHURCH.test(norm(typedServing))) {
      hub.noteUnmatched(typedServing, 'serving church');
      tally.add('families whose serving church is kept as typed, to confirm');
    }

    const yearRaw = tab.get(row, 'Year Joined');
    const year = Number(text(yearRaw));
    const yearJoined = Number.isInteger(year) && year >= 2000 && year <= new Date().getFullYear() ? year : null;
    if (text(yearRaw) && !yearJoined) notes.push(`Year joined in the spreadsheet: ${text(yearRaw)}`);
    const maritalStatus = marital(tab.get(row, 'Marital Status'), notes);
    const defender = text(tab.get(row, 'Defender Dad'));
    if (defender && !/^(y|yes|n|no)$/i.test(defender)) notes.push(`Defender Dad: ${defender}`);
    const legacy = text(tab.get(row, 'Legacy Family'));
    if (legacy && !/^(y|yes|n|no)$/i.test(legacy)) notes.push(`Legacy family: ${legacy}`);
    const adoptions = tab.headers.filter((h) => /^\d\d adoption$/i.test(h)).map((h) => (text(tab.get(row, h)) ? `20${h.slice(0, 2)}: ${text(tab.get(row, h))}` : '')).filter(Boolean);
    if (adoptions.length) notes.push(`Adoptions: ${adoptions.join('; ')}`);
    const story = text(tab.get(row, 'Open to a story contact?'));

    const family = {
      id: randomUUID(), name, home_types: homeTypes, family_status: familyStatus, care_status: careStatus, marital_status: maritalStatus,
      street: street || null, unit: orNull(tab.get(row, 'Apt/Unit')), town: orNull(tab.get(row, 'City')), state: state(tab.get(row, 'State')), zip: z, county: orNull(tab.get(row, 'County')),
      home_church_id: homeChurchId, home_church_text: homeChurchId || NO_CHURCH.test(norm(typedHome)) ? null : typedHome || null,
      church_id: servingChurchId, serving_church_text: servingChurchId || NO_CHURCH.test(norm(typedServing)) ? null : typedServing || null, year_joined: yearJoined,
      how_connected: orNull(tab.get(row, 'how connected?')), priority: orNull(tab.get(row, 'Priority')), prayer_request: orNull(tab.get(row, 'Prayer Request', 'Prayer Requests')),
      welcome_email_sent_on: day(tab.get(row, 'Welcome Email Sent')), fb_group: yes(tab.get(row, 'FB Grp')) ? 'Admitted' : 'No', defender_dad: !!defender && !/^(n|no)$/i.test(defender),
      tbri: orNull(tab.get(row, 'TBRI')), legacy_family: !!legacy && !/^(n|no)$/i.test(legacy), open_to_story: ['Yes', 'Maybe', 'No'].find((o) => norm(o) === norm(story)) ?? null,
      notes: lines(...notes), source: 'Spreadsheet',
    };
    hub.out.families.push(family);
    tally.add('families to add');
    if (familyStatus !== 'Active') tally.add(`families with status ${familyStatus}`);
    if (!homeTypes.length) tally.add('families with no home type');

    // Adults. The first one listed is the main contact and carries the family's phone and email.
    const address = { street, unit: text(tab.get(row, 'Apt/Unit')), city: text(tab.get(row, 'City')), state: family.state, zip: z, county: text(tab.get(row, 'County')), homeChurchId, homeChurchText: family.home_church_text };
    const adults = [mom && { first: mom, relationship: 'Mom' }, dad && { first: dad, relationship: 'Dad' }].filter(Boolean);
    adults.forEach((a, i) => {
      const aMail = i === 0 ? mail : null;
      const aPhone = phone(tab.get(row, i === 0 ? 'Primary Phone #' : 'spouse phone'));
      const id = hub.findPerson(a.first, last, aMail, null) ?? hub.addPerson({ first: a.first, last, email: aMail, phone: aPhone, ...address });
      if (hub.out.family_members.some((m) => m.family_id === family.id && m.person_id === id)) return;
      hub.familyMembers.add(id);
      hub.out.family_members.push({ family_id: family.id, person_id: id, relationship: a.relationship, is_primary: i === 0 });
      tally.add('adults to add or link');
    });
    if (!adults.length) tally.add('families with no adult named');

    // Children. The spreadsheet has counts by age band and type, not names or birthdays.
    let kids = 0;
    for (const c of codeColumns) {
      const n = Number(text(row[c.i]));
      if (!Number.isInteger(n) || n < 1 || n > 12) continue;
      for (let k = 0; k < n; k++) {
        hub.out.children.push({ id: randomUUID(), family_id: family.id, first_name: null, birth_year: null, relationship: c.type, notes: `Listed as ${c.band} in the 2026 spreadsheet` });
        kids++;
      }
    }
    if (!kids) {
      const total = Number(text(tab.get(row, 'Total Kids')));
      if (Number.isInteger(total) && total >= 1 && total <= 15) {
        for (let k = 0; k < total; k++) hub.out.children.push({ id: randomUUID(), family_id: family.id, first_name: null, birth_year: null, relationship: 'Unknown', notes: null });
        kids = total;
      }
    }
    tally.add('children to add', kids);
    if (!kids) tally.add('families with no children counted');

    const launched = day(tab.get(row, 'Care Community Team Launch Date'));
    for (const status of [...new Set(communities)]) {
      hub.out.care_communities.push({ id: randomUUID(), family_id: family.id, church_id: servingChurchId, status, launched_on: status === 'Active' ? launched : null, closed_on: null });
      tally.add(`Care Communities to add: ${status === 'Closed' ? 'previously served' : status.toLowerCase()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// The Experience: the Center's visitor log and the "My Next Steps" form
// ---------------------------------------------------------------------------
const VISIT_COLUMNS = ['Visit ID', 'Email', 'Date', 'First Name', 'Last Name', 'Church/ Org', 'Visit Type'];
const VISIT_TYPES = ['VCE', 'Tour', 'Appointment', 'Training', 'Event', 'Drop-In', 'Volunteer', 'Community Gathering'];

function loadVisits(tab, hub, tally) {
  for (const row of tab.rows) {
    const code = text(tab.get(row, 'Visit ID'));
    const first = text(tab.get(row, 'First Name'));
    const last = text(tab.get(row, 'Last Name'));
    const on = day(tab.get(row, 'Date'));
    if (!code) continue;
    if (!on || (!first && !last)) {
      // The sheet reserves a row per head counted in a group. Without a name and a date there is nothing to keep.
      tally.add('rows that only hold a place in a headcount (skipped)');
      continue;
    }
    if (hub.visitCodes.has(code)) {
      tally.add('visits already in the hub (skipped)');
      continue;
    }
    hub.visitCodes.add(code);
    const mail = email(tab.get(row, 'Email'));
    const typedChurch = text(tab.get(row, 'Church/ Org'));
    const churchId = hub.church(typedChurch);
    const rawType = text(tab.get(row, 'Visit Type'));
    const type = VISIT_TYPES.find((t) => norm(t) === norm(rawType)) ?? 'Event';
    if (!VISIT_TYPES.some((t) => norm(t) === norm(rawType))) tally.add(`visit type "${rawType || 'blank'}" not recognised, set to Event`);
    // A person record only when there is an email to know them by. Otherwise the name stays on the visit.
    let personId = null;
    if (mail && first) personId = hub.findPerson(first, last, mail, null) ?? hub.addPerson({ first, last, email: mail, homeChurchId: churchId, homeChurchText: churchId ? '' : typedChurch });
    const purpose = text(tab.getSecond(row, 'Visit Type'));
    hub.out.visits.push({
      id: randomUUID(), visit_code: code, visited_on: on, person_id: personId, group_name: personId ? null : `${first} ${last}`.trim(), party_size: 1, visit_type: type,
      offerings: purpose ? [purpose] : [], engagement_source: orNull(tab.get(row, 'Engagement Source')), church_id: churchId, church_text: churchId ? null : typedChurch || null,
      notes: lines(text(tab.get(row, 'Notes')), text(tab.get(row, 'Main Person')) ? `Met with: ${text(tab.get(row, 'Main Person'))}` : ''), data_source: 'Historical Import',
    });
    tally.add('visits to add');
    tally.add(personId ? 'visits linked to a person by email' : 'visits kept by name only (no email)');
  }
}

// The form's choices, as the hub's next_step_options know them.
const NEXT_STEPS = [
  ['meal', 'I might be able to bring a meal once a month'],
  ['connect_weekly', 'I could connect weekly with a foster/adoptive parent'],
  ['start_fam', "I'd be interested in helping start or lead the ministry at my church"],
  ['give', "I'd like to give financially"],
  ['foster', "I'd like to learn more about fostering"],
  ['pray', "I'd love to pray"],
  ['not_sure', 'Not sure - but put me in touch with someone'],
  ['already_fam', "I'm already serving through my Family Advocacy Ministry"],
  ['already_either', "I'm already a foster/adoptive family or I'm already serving through my church"],
  ['already_family', "I'm already a foster/adoptive family."],
  ['already_career', "I'm already engaged through my career in child welfare"],
  ['not_now', 'right season for me to engage'],
];
const RESPONSE_COLUMNS = ['Timestamp', 'Email Address', 'First Name', 'Last Name', 'Phone Number', 'Your Home Church'];

function loadResponses(tab, hub, tally) {
  for (const row of tab.rows) {
    const first = text(tab.get(row, 'First Name'));
    const last = text(tab.get(row, 'Last Name'));
    const mail = email(tab.get(row, 'Email Address'));
    const stamp = tab.get(row, 'Timestamp');
    if (!(stamp instanceof Date) || (!first && !mail)) continue;
    const externalId = `gform:${stamp.toISOString()}:${mail ?? norm(`${first} ${last}`)}`;
    if (hub.responseIds.has(externalId)) {
      tally.add('answers already in the hub (skipped)');
      continue;
    }
    hub.responseIds.add(externalId);
    if (mail) hub.responseDays.add(`${mail}|${stamp.toISOString().slice(0, 10)}`);
    const ticked = text(tab.getStarting(row, 'You heard that you have a part to play'));
    const steps = NEXT_STEPS.filter(([, phrase]) => ticked.toLowerCase().includes(phrase.toLowerCase())).map(([key]) => key);
    if (ticked && !steps.length) tally.add('answers whose next steps were not recognised');
    const typedChurch = text(tab.get(row, 'Your Home Church'));
    const noChurch = NO_CHURCH.test(norm(typedChurch));
    const churchId = hub.church(typedChurch);
    if (typedChurch && !churchId && !noChurch) hub.noteUnmatched(typedChurch, 'guests');
    const personId = first ? hub.findPerson(first, last, mail, null) ?? hub.addPerson({ first, last, email: mail, phone: phone(tab.get(row, 'Phone Number')), homeChurchId: churchId, homeChurchText: churchId || noChurch ? '' : typedChurch }) : null;
    const likely = Number(text(tab.getStarting(row, 'How likely are you to invite')));
    // The spreadsheet's own "Email Sent" column: anything in it means someone already followed up.
    const handled = !!text(tab.get(row, 'Email Sent'));
    hub.out.vce_responses.push({
      id: randomUUID(), submitted_at: stamp.toISOString(), person_id: personId, first_name: first || null, last_name: last || null, email: mail, phone: phone(tab.get(row, 'Phone Number')),
      home_church_text: churchId || noChurch ? null : typedChurch || null, church_id: churchId, wall_words: orNull(tab.getStarting(row, 'What word')), feeling: orNull(tab.getStarting(row, 'After the video message')),
      heard_from: orNull(tab.getStarting(row, 'How did you hear')), next_steps: steps, describes: text(tab.getStarting(row, 'Which of the following describes you')).split(/,\s+/).filter(Boolean),
      comments: orNull(tab.getStarting(row, 'Anything else')), likely_to_invite: Number.isInteger(likely) && likely >= 1 && likely <= 5 ? likely : null, needs_follow_up: !handled, source: 'Google Form', external_id: externalId,
    });
    tally.add('answers to add');
    tally.add(handled ? 'answers the spreadsheet marks as already followed up (no follow-up made)' : 'answers that will get follow-ups');
    if (typedChurch && !churchId && !noChurch) tally.add('answers whose church is kept as typed, to confirm');
  }
}

// The same form after it moved to HubSpot: one row per submission, with shorter headings.
const HUBSPOT_COLUMNS = ['Submitted at - UTC', 'First name', 'Last name', 'Email', 'Phone number', 'Next steps selected', 'Participant type', 'Home church'];

function loadHubspotResponses(tab, hub, tally) {
  for (const row of tab.rows) {
    const first = text(tab.get(row, 'First name'));
    const last = text(tab.get(row, 'Last name'));
    const mail = email(tab.get(row, 'Email'));
    const stamp = new Date(text(tab.get(row, 'Submitted at - UTC')));
    if (Number.isNaN(stamp.getTime()) || (!first && !mail)) continue;
    const externalId = `hubspot:${stamp.toISOString()}:${mail ?? norm(`${first} ${last}`)}`;
    const sameDay = mail ? `${mail}|${stamp.toISOString().slice(0, 10)}` : '';
    if (hub.responseIds.has(externalId) || (sameDay && hub.responseDays.has(sameDay))) {
      tally.add('answers already in the hub, or sent twice the same day (skipped)');
      continue;
    }
    hub.responseIds.add(externalId);
    if (sameDay) hub.responseDays.add(sameDay);
    const ticked = text(tab.get(row, 'Next steps selected'));
    const steps = NEXT_STEPS.filter(([, phrase]) => ticked.toLowerCase().includes(phrase.toLowerCase())).map(([key]) => key);
    if (ticked && !steps.length) tally.add('answers whose next steps were not recognised');
    const typedChurch = text(tab.get(row, 'Home church'));
    const noChurch = NO_CHURCH.test(norm(typedChurch));
    const churchId = hub.church(typedChurch);
    if (typedChurch && !churchId && !noChurch) hub.noteUnmatched(typedChurch, 'guests');
    const tel = phone(tab.get(row, 'Phone number'));
    const known = first ? hub.findPerson(first, last, mail, null) : null;
    const personId = first ? known ?? hub.addPerson({ first, last, email: mail, phone: tel, homeChurchId: churchId, homeChurchText: churchId || noChurch ? '' : typedChurch }) : null;
    // "Other" with what they typed beside it reads better as one line.
    const other = text(tab.get(row, 'Participant type - other'));
    const describes = text(tab.get(row, 'Participant type')).split(/,\s+/).filter(Boolean).map((d) => (d === 'Other' && other ? `Other: ${other}` : d));
    const likely = parseInt(text(tab.get(row, 'Likelihood to share')), 10);
    hub.out.vce_responses.push({
      id: randomUUID(), submitted_at: stamp.toISOString(), person_id: personId, first_name: first || null, last_name: last || null, email: mail, phone: tel,
      home_church_text: churchId || noChurch ? null : typedChurch || null, church_id: churchId, wall_words: orNull(tab.get(row, 'Wall words')), feeling: orNull(tab.get(row, 'Feelings after closing video')),
      heard_from: orNull(tab.get(row, 'How heard or came with')), next_steps: steps, describes,
      comments: orNull(tab.get(row, 'Anything else to share')), likely_to_invite: likely >= 1 && likely <= 5 ? likely : null, needs_follow_up: true, source: 'HubSpot', external_id: externalId,
    });
    tally.add('answers to add');
    tally.add(known ? 'guests already known (a visitor, parent, advocate or pastor)' : 'guests new to the hub');
    if (typedChurch && !churchId && !noChurch) tally.add('answers whose church is kept as typed, to confirm');
  }
}

// ---------------------------------------------------------------------------
// Signing in and loading
// ---------------------------------------------------------------------------
function ask(question, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    if (hidden) {
      // Show the question once, then nothing while the password is typed.
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function fetchAll(sb, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const EMPTY = { coaches: [], churches: [], church_aliases: [], people: [], person_roles: [], advocate_onboarding: [], families: [], family_members: [], visits: [], vce_responses: [] };

async function signInAndRead() {
  const { default: config } = await import('../next.config.mjs');
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(config.env.NEXT_PUBLIC_SUPABASE_URL, config.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  console.log(`\nSign in to ${config.env.NEXT_PUBLIC_SUPABASE_URL} with your own C127 Hub account.`);
  const who = await ask('Email: ');
  const password = await ask('Password: ', true);
  const { error } = await sb.auth.signInWithPassword({ email: who, password });
  if (error) throw new Error('That email and password did not match.');
  const existing = {
    coaches: await fetchAll(sb, 'coaches', 'id, name'),
    churches: await fetchAll(sb, 'churches', 'id, name, campus'),
    church_aliases: await fetchAll(sb, 'church_aliases', 'church_id, alias'),
    people: await fetchAll(sb, 'people', 'id, first_name, last_name, email, home_church_id'),
    person_roles: await fetchAll(sb, 'person_roles', 'person_id, role, church_id'),
    advocate_onboarding: await fetchAll(sb, 'advocate_onboarding', 'person_id'),
    families: await fetchAll(sb, 'families', 'id, name, street, zip'),
    family_members: await fetchAll(sb, 'family_members', 'person_id'),
    visits: await fetchAll(sb, 'visits', 'visit_code'),
    vce_responses: await fetchAll(sb, 'vce_responses', 'external_id, email, submitted_at'),
  };
  return { sb, existing };
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(LOAD ? 'C127 preload: LOAD' : 'C127 preload: dry run (nothing is written to the hub)');
  console.log(`Reading from ${DIR}`);
  const churchFile = findFile(/^church spreadsheet.*\.xlsx$/i);
  const familyFile = findFile(/^family spreadsheet.*\.xlsx$/i);
  const wantChurchFile = ONLY.includes('churches') || ONLY.includes('advocates');
  if (wantChurchFile && !churchFile) throw new Error('No "Church Spreadsheet….xlsx" in that folder.');
  if (ONLY.includes('families') && !familyFile) throw new Error('No "Family Spreadsheet….xlsx" in that folder.');
  const visitorFile = findFile(/^ccc_visitors.*\.xlsx$/i);
  const formFile = findFile(/^my next steps.*responses.*\.xlsx$/i);
  // The HubSpot export is optional: the form moved there in September 2026.
  const hubspotFile = findFile(/^my next steps.*submissions.*\.xlsx$/i);
  if (ONLY.includes('experience') && (!visitorFile || !formFile)) throw new Error('The Experience load needs "CCC_Visitors….xlsx" and "My Next Steps… (Responses).xlsx" in that folder.');

  const { sb, existing } = LOAD ? await signInAndRead() : { sb: null, existing: EMPTY };
  const hub = new Hub(existing);
  if (!LOAD) console.log('A dry run does not sign in, so it counts as if the hub were empty.');

  const churchTab = ONLY.includes('churches') ? await readTab(churchFile, 'Churches', CHURCH_COLUMNS) : null;
  const advocateTab = ONLY.includes('advocates') ? await readTab(churchFile, 'Current Advocates', ADVOCATE_COLUMNS) : null;
  const familyTab = ONLY.includes('families') ? await readTab(familyFile, 'Main Information', FAMILY_COLUMNS) : null;
  const visitTab = ONLY.includes('experience') ? await readTab(visitorFile, 'VISITS', VISIT_COLUMNS) : null;
  const formTab = ONLY.includes('experience') ? await readTab(formFile, 'Form Responses 1', RESPONSE_COLUMNS) : null;
  const hubspotTab = ONLY.includes('experience') && hubspotFile ? await readTab(hubspotFile, 'Sheet1', HUBSPOT_COLUMNS) : null;

  // Full coach names from both tabs, so a first name on one row can be read as the person named in full on another.
  const coachNames = [...existing.coaches.map((c) => c.name)];
  for (const tab of [churchTab, advocateTab]) if (tab) for (const row of tab.rows) coachNames.push(parseCoach(tab.get(row, 'FAM Coach')).name);
  const fullCoachNames = [...new Set(coachNames.filter((n) => n.includes(' ')))];

  const tallies = {};
  const section = (label, tab, run) => {
    if (!tab) return;
    tallies[label] = new Tally();
    run(tallies[label]);
    console.log(`\n${label}: "${tab.tab}" tab of ${tab.file}, ${tab.rows.length} rows`);
    if (tab.missing.length) console.log(`    Columns not found (left empty): ${tab.missing.join(', ')}`);
    tallies[label].print();
  };

  // Churches first, so names typed on the other tabs can be matched to them.
  section('Churches', churchTab, (t) => loadChurches(churchTab, hub, fullCoachNames, t));
  section('Advocates', advocateTab, (t) => loadAdvocates(advocateTab, hub, t));
  section('Families', familyTab, (t) => loadFamilies(familyTab, hub, t));
  // Guests last, so someone who is already a parent, advocate or pastor is recognised and not added twice.
  section('Center visits', visitTab, (t) => loadVisits(visitTab, hub, t));
  section('Experience answers', formTab, (t) => loadResponses(formTab, hub, t));
  section('Experience answers from HubSpot', hubspotTab, (t) => loadHubspotResponses(hubspotTab, hub, t));

  console.log(`\nChurch names: ${hub.loose.size} matched on a near-identical name, ${hub.unmatched.size} kept as typed for C127 to confirm on the Data check page.`);

  const totals = Object.fromEntries(Object.entries(hub.out).map(([t, rows]) => [t, rows.length]).filter(([, n]) => n));
  console.log('\nRows this would write, by table:');
  for (const [t, n] of Object.entries(totals)) console.log(`    ${String(n).padStart(5)}  ${t}`);

  if (!LOAD) {
    console.log('\nNothing was written. When the counts look right, run:  node scripts/preload.mjs --load');
    return;
  }
  if (!Object.keys(totals).length) {
    console.log('\nNothing new to load.');
    return;
  }
  const go = await ask('\nType LOAD to write these rows to the hub, or anything else to stop: ');
  if (go !== 'LOAD') {
    console.log('Stopped. Nothing was written.');
    return;
  }
  const { data, error } = await sb.rpc('import_records', { payload: hub.out });
  if (error) throw new Error(`The load was refused and nothing was written: ${error.message}`);
  console.log('\nLoaded:');
  for (const [t, n] of Object.entries(data)) console.log(`    ${String(n).padStart(5)}  ${t}`);
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});

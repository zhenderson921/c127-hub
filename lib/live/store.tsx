'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadProfile, type Profile } from '../db';
import { supabaseBrowser } from '../supabase';
import { churchColumns, familyColumns, loadLive, personColumns, toFollowUp, toNextStep, toCareCommunity, toChild, toChurch, toFamily, toInteraction, toMember, toPerson, toRole, toStaff } from './db';
import { EMPTY, type CareCommunity, type Child, type Church, type ChurchRole, type Family, type LiveData, type FollowUp, type MemberRelationship, type Method, type NextStep, type Person } from './types';

export interface NewAdult {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: MemberRelationship;
}

export interface NewFamily extends Partial<Family> {
  name: string;
  adults: NewAdult[];
}

export interface NewChurch extends Partial<Church> {
  name: string;
  /** Typed coach name. Matched to an existing staff member, or added as a new one. */
  coachName?: string;
}

export interface NewContact {
  familyId?: string;
  churchId?: string;
  personId?: string;
  method: Method;
  reached: boolean;
  summary: string;
}

export interface NewResponse {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  churchId: string | null;
  homeChurchText: string;
  nextSteps: string[];
  comments: string;
}

interface LiveStore extends LiveData {
  profile: Profile | null;
  /** True once the first load has finished. */
  ready: boolean;
  error: string | null;
  clearError: () => void;
  signOut: () => Promise<void>;
  // Each action saves to the database first and changes the screen only when the
  // save worked. It returns true on success; on failure the reason is in `error`.
  addChurch: (c: NewChurch) => Promise<string | null>;
  updateChurch: (id: string, patch: Partial<Church>) => Promise<boolean>;
  addChurchPerson: (churchId: string, p: { firstName: string; lastName: string; email: string; phone: string; role: ChurchRole; title: string }) => Promise<boolean>;
  addFamily: (f: NewFamily) => Promise<string | null>;
  updateFamily: (id: string, patch: Partial<Family>) => Promise<boolean>;
  updatePerson: (id: string, patch: Partial<Person>) => Promise<boolean>;
  addChild: (c: Omit<Child, 'id' | 'inHome' | 'notes'>) => Promise<boolean>;
  removeChild: (id: string) => Promise<boolean>;
  startCareCommunity: (familyId: string) => Promise<boolean>;
  updateCareCommunity: (id: string, patch: Partial<Pick<CareCommunity, 'status' | 'launchedOn' | 'closedOn'>>) => Promise<boolean>;
  logContact: (c: NewContact) => Promise<boolean>;
  // Data check. These change many records at once in the database, so the whole hub is read again afterwards.
  /** Say that a church name typed in the spreadsheet is this church, everywhere it appears. */
  matchChurchName: (typed: string, churchId: string) => Promise<boolean>;
  /** Add the typed name as a new church (a prospect), then match it. */
  addChurchFromName: (typed: string) => Promise<boolean>;
  /** Fold `removeId` into `keepId`: one person, with everything both had. */
  mergePeople: (keepId: string, removeId: string) => Promise<boolean>;
  /** Mark a Data check item as looked at and fine as it is. */
  dismiss: (kind: 'church_name' | 'people' | 'families' | 'churches', key: string) => Promise<boolean>;
  // Experience follow-up
  /** Move a follow-up to another stage, or hand it to a person or a shared queue. */
  updateFollowUp: (id: string, patch: Partial<Pick<FollowUp, 'stage' | 'staffId' | 'queue' | 'outcome'>>) => Promise<boolean>;
  /** Record a guest's answers by hand. The database then makes their follow-ups. */
  addResponse: (r: NewResponse) => Promise<boolean>;
  /** Change how one of the form's choices is followed up. */
  updateNextStep: (key: string, patch: Partial<Pick<NextStep, 'action' | 'route' | 'ownerId' | 'active'>>) => Promise<boolean>;
  /** Add a staff member, so follow-ups can be given to them. */
  addStaff: (name: string, team: string) => Promise<boolean>;
}

const Ctx = createContext<LiveStore | null>(null);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const orNull = (v: string) => (v.trim() ? v.trim() : null);
/**
 * After a save, take only the fields that were changed from the saved row. Two
 * quick edits to one record can come back out of order, and replacing the whole
 * record with the slower answer would show the earlier edit as undone.
 */
const changed = <T extends object>(saved: T, patch: Partial<T>): Partial<T> => {
  const out: Partial<T> = {};
  for (const k of Object.keys(patch) as (keyof T)[]) out[k] = saved[k];
  return out;
};

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LiveData>(EMPTY);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const who = sb ? await loadProfile(sb).catch(() => null) : null;
      if (cancelled) return;
      if (!sb || !who) {
        // The middleware should have sent a signed-out visitor to sign in already.
        window.location.href = '/login?next=/live';
        return;
      }
      setProfile(who);
      if (who.role === 'staff' || who.role === 'coach') {
        try {
          const loaded = await loadLive(sb);
          if (!cancelled) setData(loaded);
        } catch (e) {
          if (!cancelled) setError(`Could not load the live tool: ${(e as Error).message}`);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Run a save. Any failure becomes the banner message and the action reports false. */
  const save = useCallback(async <T,>(what: string, fn: (sb: SupabaseClient) => Promise<T>): Promise<T | null> => {
    const sb = supabaseBrowser();
    if (!sb) return null;
    try {
      return await fn(sb);
    } catch (e) {
      setError(`${what} was not saved: ${(e as Error).message}`);
      return null;
    }
  }, []);

  const store = useMemo<LiveStore>(() => {
    /** Insert or update one row and hand back what the database stored. */
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const insert = async (sb: SupabaseClient, table: string, row: object): Promise<any> => {
      const { data: out, error: err } = await sb.from(table).insert(row).select().single();
      if (err) throw new Error(err.message);
      return out;
    };
    const patchRow = async (sb: SupabaseClient, table: string, id: string, cols: object): Promise<any> => {
      const { data: out, error: err } = await sb.from(table).update(cols).eq('id', id).select().single();
      if (err) throw new Error(err.message);
      return out;
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return {
      ...data,
      profile,
      ready,
      error,
      clearError: () => setError(null),
      signOut: async () => {
        await supabaseBrowser()?.auth.signOut();
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
      },

      addChurch: async ({ coachName, ...c }) => {
        const out = await save('The church', async (sb) => {
          let coachId = c.coachId ?? null;
          let newStaff = null;
          const typed = coachName?.trim();
          if (!coachId && typed) {
            const found = data.staff.find((s) => s.name.toLowerCase() === typed.toLowerCase());
            if (found) coachId = found.id;
            else {
              newStaff = toStaff(await insert(sb, 'coaches', { name: typed, team: 'FAM' }));
              coachId = newStaff.id;
            }
          }
          const church = toChurch(await insert(sb, 'churches', churchColumns({ ...c, coachId })));
          return { church, newStaff };
        });
        if (!out) return null;
        setData((d) => ({
          ...d,
          staff: out.newStaff ? [...d.staff, out.newStaff].sort((a, b) => a.name.localeCompare(b.name)) : d.staff,
          churches: [...d.churches, out.church].sort((a, b) => a.name.localeCompare(b.name)),
        }));
        return out.church.id;
      },

      updateChurch: async (id, patch) => {
        const row = await save('That change', (sb) => patchRow(sb, 'churches', id, churchColumns(patch)));
        if (!row) return false;
        const saved = changed(toChurch(row), patch);
        setData((d) => ({ ...d, churches: d.churches.map((c) => (c.id === id ? { ...c, ...saved } : c)) }));
        return true;
      },

      addChurchPerson: async (churchId, p) => {
        const out = await save('That person', async (sb) => {
          const person = toPerson(await insert(sb, 'people', { first_name: p.firstName.trim(), last_name: orNull(p.lastName), email: orNull(p.email), phone: orNull(p.phone), home_church_id: churchId, source: 'Hub' }));
          const role = toRole(await insert(sb, 'person_roles', { person_id: person.id, role: p.role, church_id: churchId, title: orNull(p.title) }));
          return { person, role };
        });
        if (!out) return false;
        setData((d) => ({ ...d, people: [...d.people, out.person], roles: [...d.roles, out.role] }));
        return true;
      },

      addFamily: async ({ adults, ...f }) => {
        const out = await save('The family', async (sb) => {
          const family = toFamily(await insert(sb, 'families', { ...familyColumns(f), source: 'Hub' }));
          const people = [];
          const members = [];
          for (const [i, a] of adults.filter((x) => x.firstName.trim()).entries()) {
            const person = toPerson(
              await insert(sb, 'people', {
                first_name: a.firstName.trim(), last_name: orNull(a.lastName), email: orNull(a.email), phone: orNull(a.phone),
                street: orNull(f.street ?? ''), unit: orNull(f.unit ?? ''), city: orNull(f.city ?? ''), state: orNull(f.state ?? ''), zip: orNull(f.zip ?? ''), county: orNull(f.county ?? ''),
                home_church_id: f.homeChurchId ?? null, home_church_text: orNull(f.homeChurchText ?? ''), source: 'Hub',
              }),
            );
            people.push(person);
            members.push(toMember(await insert(sb, 'family_members', { family_id: family.id, person_id: person.id, relationship: a.relationship, is_primary: i === 0 })));
          }
          return { family, people, members };
        });
        if (!out) return null;
        setData((d) => ({
          ...d,
          families: [...d.families, out.family].sort((a, b) => a.name.localeCompare(b.name)),
          people: [...d.people, ...out.people],
          members: [...d.members, ...out.members],
        }));
        return out.family.id;
      },

      updateFamily: async (id, patch) => {
        const row = await save('That change', (sb) => patchRow(sb, 'families', id, familyColumns(patch)));
        if (!row) return false;
        const saved = changed(toFamily(row), patch);
        setData((d) => ({ ...d, families: d.families.map((f) => (f.id === id ? { ...f, ...saved } : f)) }));
        return true;
      },

      updatePerson: async (id, patch) => {
        const row = await save('That change', (sb) => patchRow(sb, 'people', id, personColumns(patch)));
        if (!row) return false;
        const saved = changed(toPerson(row), patch);
        setData((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...saved } : p)) }));
        return true;
      },

      addChild: async (c) => {
        const row = await save('That child', (sb) => insert(sb, 'children', { family_id: c.familyId, first_name: orNull(c.firstName), birth_year: c.birthYear, relationship: c.relationship }));
        if (!row) return false;
        setData((d) => ({ ...d, children: [...d.children, toChild(row)] }));
        return true;
      },

      removeChild: async (id) => {
        const ok = await save('That change', async (sb) => {
          const { error: err } = await sb.from('children').delete().eq('id', id);
          if (err) throw new Error(err.message);
          return true;
        });
        if (!ok) return false;
        setData((d) => ({ ...d, children: d.children.filter((c) => c.id !== id) }));
        return true;
      },

      startCareCommunity: async (familyId) => {
        const fam = data.families.find((f) => f.id === familyId);
        const row = await save('The Care Community', (sb) => insert(sb, 'care_communities', { family_id: familyId, church_id: fam?.servingChurchId ?? null, status: 'Building team' }));
        if (!row) return false;
        setData((d) => ({ ...d, careCommunities: [...d.careCommunities, toCareCommunity(row)] }));
        return true;
      },

      updateCareCommunity: async (id, patch) => {
        const cols: Record<string, unknown> = {};
        if (patch.status !== undefined) {
          cols.status = patch.status;
          // Going active sets the launch date, and closing sets the close date, unless one is already there.
          const current = data.careCommunities.find((c) => c.id === id);
          if (patch.status === 'Active' && !current?.launchedOn && patch.launchedOn === undefined) cols.launched_on = today();
          if (patch.status === 'Closed' && !current?.closedOn && patch.closedOn === undefined) cols.closed_on = today();
        }
        if (patch.launchedOn !== undefined) cols.launched_on = orNull(patch.launchedOn);
        if (patch.closedOn !== undefined) cols.closed_on = orNull(patch.closedOn);
        const row = await save('That change', (sb) => patchRow(sb, 'care_communities', id, cols));
        if (!row) return false;
        // A status change can also set a date, so take the dates along with whatever was asked for.
        const full = toCareCommunity(row);
        const saved = { ...changed(full, patch), ...(patch.status !== undefined ? { launchedOn: full.launchedOn, closedOn: full.closedOn } : {}) };
        setData((d) => ({ ...d, careCommunities: d.careCommunities.map((c) => (c.id === id ? { ...c, ...saved } : c)) }));
        return true;
      },

      matchChurchName: async (typed, churchId) => {
        const ok = await save('That match', async (sb) => {
          const { error: err } = await sb.rpc('match_church_name', { typed, church: churchId });
          if (err) throw new Error(err.message);
          return loadLive(sb);
        });
        if (!ok) return false;
        setData(ok);
        return true;
      },

      addChurchFromName: async (typed) => {
        const ok = await save('The church', async (sb) => {
          const church = await insert(sb, 'churches', churchColumns({ name: typed.trim(), status: 'Potential Prospect' }));
          const { error: err } = await sb.rpc('match_church_name', { typed, church: church.id });
          if (err) throw new Error(err.message);
          return loadLive(sb);
        });
        if (!ok) return false;
        setData(ok);
        return true;
      },

      mergePeople: async (keepId, removeId) => {
        const ok = await save('That merge', async (sb) => {
          const { error: err } = await sb.rpc('merge_people', { keep: keepId, remove: removeId });
          if (err) throw new Error(err.message);
          return loadLive(sb);
        });
        if (!ok) return false;
        setData(ok);
        return true;
      },

      dismiss: async (kind, key) => {
        const ok = await save('That choice', async (sb) => {
          const { error: err } = await sb.from('review_dismissals').upsert({ kind, key });
          if (err) throw new Error(err.message);
          return true;
        });
        if (!ok) return false;
        setData((d) => ({ ...d, dismissed: [...d.dismissed, `${kind}:${key}`] }));
        return true;
      },

      updateFollowUp: async (id, patch) => {
        const cols: Record<string, unknown> = {};
        if (patch.stage !== undefined) cols.stage = patch.stage;
        if (patch.staffId !== undefined) cols.coach_id = patch.staffId;
        if (patch.queue !== undefined) cols.queue = patch.queue;
        if (patch.outcome !== undefined) cols.outcome = orNull(patch.outcome);
        const row = await save('That change', (sb) => patchRow(sb, 'tasks', id, cols));
        if (!row) return false;
        const saved = changed(toFollowUp(row), patch);
        setData((d) => ({ ...d, followUps: d.followUps.map((f) => (f.id === id ? { ...f, ...saved } : f)) }));
        return true;
      },

      addResponse: async (r) => {
        const ok = await save('That answer', async (sb) => {
          // Someone already in the hub with this email and first name is the same person.
          const mail = r.email.trim().toLowerCase();
          const known = mail ? data.people.find((p) => p.email.toLowerCase() === mail && p.firstName.trim().toLowerCase() === r.firstName.trim().toLowerCase()) : undefined;
          const personId =
            known?.id ??
            (
              await insert(sb, 'people', {
                first_name: r.firstName.trim(), last_name: orNull(r.lastName), email: orNull(mail), phone: orNull(r.phone),
                home_church_id: r.churchId, home_church_text: r.churchId ? null : orNull(r.homeChurchText), source: 'Hub',
              })
            ).id;
          await insert(sb, 'vce_responses', {
            person_id: personId, first_name: r.firstName.trim(), last_name: orNull(r.lastName), email: orNull(mail), phone: orNull(r.phone),
            church_id: r.churchId, home_church_text: r.churchId ? null : orNull(r.homeChurchText), next_steps: r.nextSteps, comments: orNull(r.comments), source: 'Hub form',
          });
          return loadLive(sb);
        });
        if (!ok) return false;
        setData(ok);
        return true;
      },

      updateNextStep: async (key, patch) => {
        const cols: Record<string, unknown> = {};
        if (patch.action !== undefined) cols.action = orNull(patch.action);
        if (patch.route !== undefined) cols.route = patch.route;
        if (patch.ownerId !== undefined) cols.owner_id = patch.ownerId;
        if (patch.active !== undefined) cols.active = patch.active;
        const row = await save('That change', async (sb) => {
          const { data: out, error: err } = await sb.from('next_step_options').update(cols).eq('key', key).select().single();
          if (err) throw new Error(err.message);
          return out;
        });
        if (!row) return false;
        const saved = changed(toNextStep(row), patch);
        setData((d) => ({ ...d, nextSteps: d.nextSteps.map((n) => (n.key === key ? { ...n, ...saved } : n)) }));
        return true;
      },

      addStaff: async (name, team) => {
        const row = await save('That person', (sb) => insert(sb, 'coaches', { name: name.trim(), team }));
        if (!row) return false;
        setData((d) => ({ ...d, staff: [...d.staff, toStaff(row)].sort((a, b) => a.name.localeCompare(b.name)) }));
        return true;
      },

      logContact: async (c) => {
        const row = await save('That contact', (sb) =>
          insert(sb, 'interactions', {
            method: c.method, reached: c.reached, summary: orNull(c.summary), family_id: c.familyId ?? null, church_id: c.churchId ?? null, person_id: c.personId ?? null,
            staff_id: profile?.coachId ?? null, source: 'Hub',
          }),
        );
        if (!row) return false;
        setData((d) => ({ ...d, interactions: [toInteraction(row), ...d.interactions] }));
        return true;
      },
    };
  }, [data, profile, ready, error, save]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useLive(): LiveStore {
  const s = useContext(Ctx);
  if (!s) throw new Error('useLive must be used inside LiveProvider');
  return s;
}

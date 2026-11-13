'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { churchRow, familyRow, guestRow, insertMany, loadAll, loadProfile, needRow, taskRow, type Profile } from './db';
import { buildSeed } from './seed';
import { supabaseBrowser } from './supabase';
import type { Church, Data, Family, Guest, Need, Task, Volunteer } from './types';
import { DAY, daysSince } from './util';

const KEY = 'c127-hub-data-v1';

export interface NewChurch {
  name: string;
  town: string;
  county: string;
  lat: number;
  lng: number;
  stage: Church['stage'];
  advocate: string;
  capacity: number;
  coachName: string;
}

interface Store extends Data {
  now: number;
  /** 'demo' is invented data kept in this browser. 'live' is the shared database. */
  mode: 'demo' | 'live';
  profile: Profile | null;
  error: string | null;
  clearError: () => void;
  /** Stored to-dos plus the reminders the system raises on its own. */
  allTasks: Task[];
  connectFamily: (familyId: string, churchId: string) => void;
  logChurchContact: (churchId: string) => void;
  logFamilyContact: (familyId: string) => void;
  claimNeed: (needId: string, volunteerId: string) => void;
  completeNeed: (needId: string) => void;
  addGuest: (g: Omit<Guest, 'id'>) => void;
  touchGuest: (guestId: string) => void;
  setGuestStage: (guestId: string, stage: Guest['stage']) => void;
  addTask: (t: Omit<Task, 'id' | 'done' | 'auto'>) => void;
  toggleTask: (taskId: string) => void;
  importFamilies: (rows: Omit<Family, 'id'>[]) => void;
  importChurches: (rows: NewChurch[]) => void;
  addFamily: (row: Omit<Family, 'id'>) => void;
  addNeed: (n: Omit<Need, 'id'>) => void;
  startCareCommunity: (familyId: string) => void;
  setTraining: (volunteerId: string, training: Volunteer['training']) => void;
  reset: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
type Persist = (sb: SupabaseClient) => PromiseLike<{ error: { message: string } | null } | void>;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(false);

  const loadLive = useCallback(async (sb: SupabaseClient) => {
    setData(await loadAll(sb));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const who = sb ? await loadProfile(sb).catch(() => null) : null;
      if (cancelled) return;
      if (sb && who) {
        live.current = true;
        setMode('live');
        setProfile(who);
        if (who.role === 'none') {
          setData({ createdAt: Date.now(), coaches: [], churches: [], families: [], volunteers: [], needs: [], guests: [], tasks: [], gifts: [], log: [] });
          return;
        }
        try {
          await loadLive(sb);
        } catch (e) {
          setError(`Could not load the hub: ${(e as Error).message}`);
          setData({ createdAt: Date.now(), coaches: [], churches: [], families: [], volunteers: [], needs: [], guests: [], tasks: [], gifts: [], log: [] });
        }
        return;
      }
      let loaded: Data | null = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) loaded = JSON.parse(raw) as Data;
      } catch {
        loaded = null;
      }
      // Sample dates are relative to the day they were generated, so refresh weekly.
      if (!loaded || daysSince(loaded.createdAt) > 7) loaded = buildSeed();
      setData(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLive]);

  useEffect(() => {
    if (!data || live.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* private window or full storage: the demo still works for this visit */
    }
  }, [data]);

  /**
   * Every action changes the screen at once, then saves. In demo mode the save is
   * the browser's own storage. In live mode it is the database, and a failed save
   * reloads the true state and says what went wrong.
   */
  const update = useCallback(
    (fn: (d: Data) => Data, note?: string, persist?: Persist, churchId?: string | null) => {
      setData((d) => {
        if (!d) return d;
        const next = fn(d);
        return note ? { ...next, log: [{ id: `lg${Date.now()}`, at: Date.now(), text: note }, ...next.log].slice(0, 40) } : next;
      });
      const sb = live.current ? supabaseBrowser() : null;
      if (!sb || !persist) return;
      (async () => {
        try {
          const res = await persist(sb);
          if (res && res.error) throw new Error(res.error.message);
          if (note) await sb.from('activity_log').insert({ text: note, church_id: churchId ?? null });
        } catch (e) {
          setError(`That change was not saved: ${(e as Error).message}`);
          await loadLive(sb).catch(() => undefined);
        }
      })();
    },
    [loadLive],
  );

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    const now = Date.now();
    const newId = (prefix: string) => (live.current ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const name = (id: string) => data.families.find((f) => f.id === id)?.name ?? 'Family';
    const churchName = (id: string) => data.churches.find((c) => c.id === id)?.name ?? 'church';
    const churchOfFamily = (id: string) => data.families.find((f) => f.id === id)?.churchId ?? null;
    const stamp = () => new Date().toISOString();

    // Reminders are rules over the data, so nobody has to remember to create them.
    const auto: Task[] = [];
    for (const c of data.churches) {
      const d = daysSince(c.lastContact, now);
      if (d >= 28 && c.stage !== 'Paused' && c.coachId) {
        auto.push({ id: `auto-ch-${c.id}`, coachId: c.coachId, title: `Check in: no contact in ${d} days`, due: c.lastContact + 28 * DAY, about: c.name, auto: true, done: false });
      }
    }
    for (const g of data.guests) {
      const d = daysSince(g.lastTouch, now);
      if (g.stage === 'In sequence' && g.touches >= 3 && d >= 7 && g.churchId) {
        const c = data.churches.find((x) => x.id === g.churchId);
        if (c && c.coachId) auto.push({ id: `auto-gu-${g.id}`, coachId: c.coachId, title: `Call Experience guest ${g.name}`, due: g.lastTouch + 7 * DAY, about: c.name, auto: true, done: false });
      }
    }

    return {
      ...data,
      now,
      mode,
      profile,
      error,
      clearError: () => setError(null),
      allTasks: [...auto, ...data.tasks],

      connectFamily: (familyId, churchId) =>
        update(
          (d) => ({ ...d, families: d.families.map((f) => (f.id === familyId ? { ...f, churchId, lastContact: Date.now() } : f)) }),
          `${name(familyId)} connected to ${churchName(churchId)}`,
          (sb) => sb.from('families').update({ church_id: churchId, last_contact_at: stamp() }).eq('id', familyId),
          churchId,
        ),
      logChurchContact: (churchId) =>
        update(
          (d) => ({ ...d, churches: d.churches.map((c) => (c.id === churchId ? { ...c, lastContact: Date.now() } : c)) }),
          `Check-in logged with ${churchName(churchId)}`,
          (sb) => sb.from('churches').update({ last_contact_at: stamp() }).eq('id', churchId),
          churchId,
        ),
      logFamilyContact: (familyId) =>
        update(
          (d) => ({ ...d, families: d.families.map((f) => (f.id === familyId ? { ...f, lastContact: Date.now() } : f)) }),
          `Contact logged with ${name(familyId)}`,
          (sb) => sb.from('families').update({ last_contact_at: stamp() }).eq('id', familyId),
          churchOfFamily(familyId),
        ),
      claimNeed: (needId, volunteerId) =>
        update(
          (d) => ({ ...d, needs: d.needs.map((n) => (n.id === needId ? { ...n, status: 'Claimed', volunteerId } : n)) }),
          'Need claimed by a volunteer',
          (sb) => sb.from('needs').update({ status: 'Claimed', volunteer_id: volunteerId }).eq('id', needId),
          data.needs.find((n) => n.id === needId)?.churchId,
        ),
      completeNeed: (needId) =>
        update(
          (d) => {
            const need = d.needs.find((n) => n.id === needId);
            return {
              ...d,
              needs: d.needs.map((n) => (n.id === needId ? { ...n, status: 'Completed' } : n)),
              volunteers: d.volunteers.map((v) => (need && v.id === need.volunteerId ? { ...v, hours: v.hours + need.hours, lastServed: Date.now() } : v)),
            };
          },
          'Need marked complete and hours recorded',
          (sb) => sb.from('needs').update({ status: 'Completed' }).eq('id', needId),
          data.needs.find((n) => n.id === needId)?.churchId,
        ),
      addGuest: (g) => {
        const row: Guest = { ...g, id: newId('gu') };
        update((d) => ({ ...d, guests: [row, ...d.guests] }), `New Experience guest: ${g.name}`, (sb) => sb.from('guests').insert(guestRow(row)));
      },
      touchGuest: (guestId) => {
        const g = data.guests.find((x) => x.id === guestId);
        if (!g) return;
        const next: Guest = { ...g, touches: g.touches + 1, lastTouch: Date.now(), stage: g.stage === 'Needs follow-up' ? 'In sequence' : g.stage };
        update(
          (d) => ({ ...d, guests: d.guests.map((x) => (x.id === guestId ? next : x)) }),
          'Follow-up sent to an Experience guest',
          (sb) => sb.from('guests').update({ touches: next.touches, last_touch_at: stamp(), stage: next.stage }).eq('id', guestId),
        );
      },
      setGuestStage: (guestId, stage) =>
        update(
          (d) => ({ ...d, guests: d.guests.map((g) => (g.id === guestId ? { ...g, stage } : g)) }),
          `Guest moved to ${stage}`,
          (sb) => sb.from('guests').update({ stage }).eq('id', guestId),
        ),
      addTask: (t) => {
        const row: Task = { ...t, id: newId('ta'), auto: false, done: false };
        update((d) => ({ ...d, tasks: [row, ...d.tasks] }), `To-do added: ${t.title}`, (sb) => sb.from('tasks').insert(taskRow(row)));
      },
      toggleTask: (taskId) => {
        const done = !data.tasks.find((t) => t.id === taskId)?.done;
        update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) }), undefined, (sb) => sb.from('tasks').update({ done }).eq('id', taskId));
      },
      importFamilies: (rows) => {
        const withIds = rows.map((r) => ({ ...r, id: newId('fa') }));
        update((d) => ({ ...d, families: [...withIds, ...d.families] }), `${rows.length} families imported`, async (sb) => {
          await insertMany(sb, 'families', withIds.map(familyRow));
        });
      },
      importChurches: (rows) => {
        // Coaches are matched by name and created when the spreadsheet names a new one.
        const coaches = [...data.coaches];
        const created: { id: string; name: string }[] = [];
        const churches: Church[] = rows.map((r) => {
          let coach = coaches.find((c) => c.name.toLowerCase() === r.coachName.trim().toLowerCase());
          if (!coach && r.coachName.trim()) {
            coach = { id: newId('co'), name: r.coachName.trim(), email: '' };
            coaches.push(coach);
            created.push({ id: coach.id, name: coach.name });
          }
          return { id: newId('ch'), name: r.name, town: r.town, county: r.county, lat: r.lat, lng: r.lng, coachId: coach?.id ?? '', stage: r.stage, advocate: r.advocate, lastContact: Date.now(), capacity: r.capacity };
        });
        update(
          (d) => ({ ...d, coaches: [...d.coaches, ...created.map((c) => ({ ...c, email: '' }))], churches: [...churches, ...d.churches] }),
          `${rows.length} churches imported${created.length ? ` and ${created.length} coaches added` : ''}`,
          async (sb) => {
            if (created.length) await insertMany(sb, 'coaches', created);
            await insertMany(sb, 'churches', churches.map(churchRow));
          },
        );
      },
      addFamily: (row) => {
        const fam = { ...row, id: newId('fa') };
        update((d) => ({ ...d, families: [fam, ...d.families] }), `${row.name} asked for help and was added`, (sb) => sb.from('families').insert(familyRow(fam)));
      },
      addNeed: (n) => {
        const row: Need = { ...n, id: newId('ne') };
        update((d) => ({ ...d, needs: [row, ...d.needs] }), `New care request: ${n.title} for ${name(n.familyId)}`, (sb) => sb.from('needs').insert(needRow(row)), n.churchId);
      },
      startCareCommunity: (familyId) =>
        update(
          (d) => ({ ...d, families: d.families.map((f) => (f.id === familyId ? { ...f, careCommunity: true } : f)) }),
          `Care Community started for ${name(familyId)}`,
          (sb) => sb.from('families').update({ care_community: true }).eq('id', familyId),
          churchOfFamily(familyId),
        ),
      setTraining: (volunteerId, training) =>
        update(
          (d) => ({ ...d, volunteers: d.volunteers.map((v) => (v.id === volunteerId ? { ...v, training } : v)) }),
          'Volunteer orientation updated',
          (sb) => sb.from('volunteers').update({ training }).eq('id', volunteerId),
          data.volunteers.find((v) => v.id === volunteerId)?.churchId,
        ),
      reset: () => {
        if (!live.current) setData(buildSeed());
      },
      signOut: async () => {
        await supabaseBrowser()?.auth.signOut();
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
      },
    };
  }, [data, mode, profile, error, update]);

  if (!store) {
    return <div className="flex h-screen items-center justify-center text-ink-soft">Loading the hub…</div>;
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

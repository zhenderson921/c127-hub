'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildSeed } from './seed';
import type { Data, Family, Guest, Need, Task, Volunteer } from './types';
import { DAY, daysSince } from './util';

const KEY = 'c127-hub-data-v1';

interface Store extends Data {
  now: number;
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
  addFamily: (row: Omit<Family, 'id'>) => void;
  addNeed: (n: Omit<Need, 'id'>) => void;
  startCareCommunity: (familyId: string) => void;
  setTraining: (volunteerId: string, training: Volunteer['training']) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* private window or full storage: the demo still works for this visit */
    }
  }, [data]);

  const update = useCallback((fn: (d: Data) => Data, note?: string) => {
    setData((d) => {
      if (!d) return d;
      const next = fn(d);
      return note ? { ...next, log: [{ id: `lg${Date.now()}`, at: Date.now(), text: note }, ...next.log].slice(0, 40) } : next;
    });
  }, []);

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    const now = Date.now();
    const name = (id: string) => data.families.find((f) => f.id === id)?.name ?? 'Family';
    const churchName = (id: string) => data.churches.find((c) => c.id === id)?.name ?? 'church';

    // Reminders are rules over the data, so nobody has to remember to create them.
    const auto: Task[] = [];
    for (const c of data.churches) {
      const d = daysSince(c.lastContact, now);
      if (d >= 28 && c.stage !== 'Paused') {
        auto.push({ id: `auto-ch-${c.id}`, coachId: c.coachId, title: `Check in: no contact in ${d} days`, due: c.lastContact + 28 * DAY, about: c.name, auto: true, done: false });
      }
    }
    for (const g of data.guests) {
      const d = daysSince(g.lastTouch, now);
      if (g.stage === 'In sequence' && g.touches >= 3 && d >= 7 && g.churchId) {
        const c = data.churches.find((x) => x.id === g.churchId);
        if (c) auto.push({ id: `auto-gu-${g.id}`, coachId: c.coachId, title: `Call Experience guest ${g.name}`, due: g.lastTouch + 7 * DAY, about: c.name, auto: true, done: false });
      }
    }

    return {
      ...data,
      now,
      allTasks: [...auto, ...data.tasks],
      connectFamily: (familyId, churchId) =>
        update(
          (d) => ({ ...d, families: d.families.map((f) => (f.id === familyId ? { ...f, churchId, lastContact: Date.now() } : f)) }),
          `${name(familyId)} connected to ${churchName(churchId)}`,
        ),
      logChurchContact: (churchId) =>
        update((d) => ({ ...d, churches: d.churches.map((c) => (c.id === churchId ? { ...c, lastContact: Date.now() } : c)) }), `Check-in logged with ${churchName(churchId)}`),
      logFamilyContact: (familyId) =>
        update((d) => ({ ...d, families: d.families.map((f) => (f.id === familyId ? { ...f, lastContact: Date.now() } : f)) }), `Contact logged with ${name(familyId)}`),
      claimNeed: (needId, volunteerId) =>
        update((d) => ({ ...d, needs: d.needs.map((n) => (n.id === needId ? { ...n, status: 'Claimed', volunteerId } : n)) }), 'Need claimed by a volunteer'),
      completeNeed: (needId) =>
        update((d) => {
          const need = d.needs.find((n) => n.id === needId);
          return {
            ...d,
            needs: d.needs.map((n) => (n.id === needId ? { ...n, status: 'Completed' } : n)),
            volunteers: d.volunteers.map((v) => (need && v.id === need.volunteerId ? { ...v, hours: v.hours + need.hours, lastServed: Date.now() } : v)),
          };
        }, 'Need marked complete and hours recorded'),
      addGuest: (g) => update((d) => ({ ...d, guests: [{ ...g, id: `gu${Date.now()}` }, ...d.guests] }), `New Experience guest: ${g.name}`),
      touchGuest: (guestId) =>
        update(
          (d) => ({
            ...d,
            guests: d.guests.map((g) => (g.id === guestId ? { ...g, touches: g.touches + 1, lastTouch: Date.now(), stage: g.stage === 'Needs follow-up' ? 'In sequence' : g.stage } : g)),
          }),
          'Follow-up sent to an Experience guest',
        ),
      setGuestStage: (guestId, stage) => update((d) => ({ ...d, guests: d.guests.map((g) => (g.id === guestId ? { ...g, stage } : g)) }), `Guest moved to ${stage}`),
      addTask: (t) => update((d) => ({ ...d, tasks: [{ ...t, id: `ta${Date.now()}`, auto: false, done: false }, ...d.tasks] }), `To-do added: ${t.title}`),
      toggleTask: (taskId) => update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) })),
      importFamilies: (rows) =>
        update((d) => ({ ...d, families: [...rows.map((r, i) => ({ ...r, id: `fa-imp-${Date.now()}-${i}` })), ...d.families] }), `${rows.length} families imported`),
      addFamily: (row) => update((d) => ({ ...d, families: [{ ...row, id: `fa-new-${Date.now()}` }, ...d.families] }), `${row.name} asked for help and was added`),
      addNeed: (n) => update((d) => ({ ...d, needs: [{ ...n, id: `ne-new-${Date.now()}` }, ...d.needs] }), `New care request: ${n.title} for ${name(n.familyId)}`),
      startCareCommunity: (familyId) =>
        update((d) => ({ ...d, families: d.families.map((f) => (f.id === familyId ? { ...f, careCommunity: true } : f)) }), `Care Community started for ${name(familyId)}`),
      setTraining: (volunteerId, training) =>
        update((d) => ({ ...d, volunteers: d.volunteers.map((v) => (v.id === volunteerId ? { ...v, training } : v)) }), 'Volunteer orientation updated'),
      reset: () => setData(buildSeed()),
    };
  }, [data, update]);

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

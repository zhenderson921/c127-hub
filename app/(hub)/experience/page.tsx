'use client';

import { useMemo, useState } from 'react';
import { Badge, Drawer, PageHeader, Panel, Stat } from '@/components/ui';
import { routeGuest } from '@/lib/routing';
import { useStore } from '@/lib/store';
import type { Guest, GuestStage, Interest } from '@/lib/types';
import { ago, daysSince, fmtDate, num, pct } from '@/lib/util';

const STAGES: GuestStage[] = ['Needs follow-up', 'In sequence', 'Responded', 'Step taken'];
const INTERESTS: Interest[] = ['Bring a meal', 'Join a Care Community', 'Start a FAM at my church', 'Foster or adopt', 'Give', 'Pray', 'Bring a friend'];
const tone = (s: GuestStage) => (s === 'Needs follow-up' ? 'warn' : s === 'Step taken' ? 'good' : 'brand');

export default function ExperiencePage() {
  const { guests, churches, coaches, now, addGuest, touchGuest, setGuestStage } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [interest, setInterest] = useState('All');

  const filtered = useMemo(() => guests.filter((g) => interest === 'All' || g.interests.includes(interest as Interest)), [guests, interest]);
  const byStage = (s: GuestStage) => filtered.filter((g) => g.stage === s).sort((a, b) => b.visit - a.visit);
  const open = guests.find((g) => g.id === openId);
  const routed = open ? routeGuest(open, churches, coaches) : null;
  const waiting = guests.filter((g) => g.stage === 'Needs follow-up');
  const oldest = waiting.length ? Math.max(...waiting.map((g) => daysSince(g.visit, now))) : 0;

  return (
    <>
      <PageHeader
        title="Experience follow-up"
        sub="Everyone who walks through the Experience and fills in the next-steps form lands here. The hub picks who the follow-up comes from and what it says, then keeps going until they take their step."
      >
        <select aria-label="Filter by interest" className="field w-auto" value={interest} onChange={(e) => setInterest(e.target.value)}>
          <option value="All">All interests</option>
          {INTERESTS.map((i) => <option key={i}>{i}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setFormOpen(true)}>Try the next-steps form</button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Guests in 45 days" value={num(guests.length)} />
        <Stat label="Waiting on a second touch" value={num(waiting.length)} hint={`Longest wait: ${oldest} days`} tone="warn" />
        <Stat label="Responded or stepped" value={pct(guests.filter((g) => g.stage === 'Responded' || g.stage === 'Step taken').length, guests.length)} />
        <Stat label="Want to start a FAM" value={num(guests.filter((g) => g.interests.includes('Start a FAM at my church')).length)} hint="Leads for the church launch team" tone="good" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s) => {
          const list = byStage(s);
          return (
            <Panel key={s} title={`${s} (${list.length})`}>
              <ul className="max-h-[30rem] divide-y divide-line overflow-y-auto">
                {list.slice(0, 40).map((g) => (
                  <li key={g.id}>
                    <button onClick={() => setOpenId(g.id)} className="w-full px-4 py-2.5 text-left hover:bg-brand-light/50">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{g.name}</span>
                        <span className="num shrink-0 text-xs text-ink-soft">{fmtDate(g.visit)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-soft">{g.interests.join(' · ')}</div>
                      <div className="mt-0.5 truncate text-xs text-ink-faint">{g.churchName || 'No church listed'}</div>
                    </button>
                  </li>
                ))}
                {list.length > 40 && <li className="px-4 py-2 text-xs text-ink-soft">and {list.length - 40} more</li>}
                {list.length === 0 && <li className="px-4 py-6 text-sm text-ink-soft">Nobody here right now.</li>}
              </ul>
            </Panel>
          );
        })}
      </div>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        {open && routed && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone={tone(open.stage)}>{open.stage}</Badge>
              <Badge tone="gray">{routed.trackLabel}</Badge>
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              Visited {fmtDate(open.visit)} · {open.touches} message{open.touches === 1 ? '' : 's'} sent · last one {ago(open.lastTouch, now)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">{open.interests.map((i) => <Badge key={i} tone="brand">{i}</Badge>)}</div>
            {open.quote && <blockquote className="mt-3 border-l-2 border-brand pl-3 text-sm italic text-ink-soft">&ldquo;{open.quote}&rdquo;</blockquote>}

            <h3 className="mt-6 text-sm font-bold">Next message, written for this guest</h3>
            <div className="mt-2 rounded-md border border-line bg-paper p-3 text-sm">
              <div className="text-xs text-ink-soft">From: <span className="font-semibold text-ink">{routed.from}</span></div>
              <div className="text-xs text-ink-soft">To: {open.email}</div>
              <div className="mt-1 font-semibold">{routed.subject}</div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{routed.body}</p>
            </div>
            <button className="btn-primary mt-3 w-full" onClick={() => touchGuest(open.id)}>Send this follow-up</button>
            <p className="mt-1 text-xs text-ink-soft">In the demo nothing is emailed. The guest moves into the sequence and the count goes up.</p>

            <h3 className="mt-6 text-sm font-bold">The sequence they are on</h3>
            <ol className="mt-2 space-y-1.5">
              {routed.steps.map((s, i) => (
                <li key={s.day} className="flex items-start gap-3 text-sm">
                  <span className={`num mt-0.5 w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold ${i < open.touches ? 'bg-good-light text-good' : 'bg-paper text-ink-soft'}`}>Day {s.day}</span>
                  <span className={i < open.touches ? 'text-ink-soft line-through' : ''}>{s.label}</span>
                </li>
              ))}
            </ol>

            <h3 className="mt-6 text-sm font-bold">Move them</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAGES.filter((s) => s !== open.stage).map((s) => <button key={s} className="btn-ghost py-1.5" onClick={() => setGuestStage(open.id, s)}>{s}</button>)}
            </div>
          </>
        )}
      </Drawer>

      <NextStepsForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={(g) => { addGuest(g); setFormOpen(false); }} churchNames={churches.map((c) => ({ id: c.id, name: c.name }))} />
    </>
  );
}

function NextStepsForm({ open, onClose, onSubmit, churchNames }: { open: boolean; onClose: () => void; onSubmit: (g: Omit<Guest, 'id'>) => void; churchNames: { id: string; name: string }[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [churchId, setChurchId] = useState('');
  const [picked, setPicked] = useState<Interest[]>([]);
  const ok = name.trim() && email.includes('@') && picked.length > 0;

  return (
    <Drawer open={open} onClose={onClose} title="Next-steps form">
      <p className="text-sm text-ink-soft">This is the form a guest fills in at the end of the Experience. Submit it and watch the guest appear under Needs follow-up with the right sender already chosen.</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          const c = churchNames.find((x) => x.id === churchId);
          onSubmit({ name: name.trim(), email: email.trim(), visit: Date.now(), churchId: c ? c.id : null, churchName: c ? c.name : '', interests: picked, stage: 'Needs follow-up', touches: 0, lastTouch: Date.now() });
          setName(''); setEmail(''); setChurchId(''); setPicked([]);
        }}
      >
        <div><label htmlFor="ns-name" className="label">Your name</label><input id="ns-name" className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="ns-email" className="label">Email</label><input id="ns-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div>
          <label htmlFor="ns-church" className="label">Your church</label>
          <select id="ns-church" className="field" value={churchId} onChange={(e) => setChurchId(e.target.value)}>
            <option value="">I do not have one / not listed</option>
            {[...churchNames].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <fieldset>
          <legend className="label">I want to</legend>
          <div className="grid gap-1.5">
            {INTERESTS.map((i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={picked.includes(i)} onChange={(e) => setPicked(e.target.checked ? [...picked, i] : picked.filter((p) => p !== i))} />
                {i}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={!ok} className="btn-primary w-full">Submit</button>
      </form>
    </Drawer>
  );
}

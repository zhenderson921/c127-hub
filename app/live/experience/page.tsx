'use client';

import { useMemo, useState } from 'react';
import { Board } from '@/components/live/Board';
import { ChurchSelect } from '@/components/live/fields';
import { ChurchLink, PersonLink } from '@/components/live/links';
import { SortTh, ViewSwitch, sortRows, type SortState } from '@/components/live/sort';
import { Badge, Drawer, PageHeader, Pager, Panel, Row } from '@/components/ui';
import { draftFor } from '@/lib/live/followup';
import { churchLabel } from '@/lib/live/match';
import { useSticky } from '@/lib/live/sticky';
import { useLive } from '@/lib/live/store';
import { METHODS, QUEUES, ROUTES, SERVING_STATUSES, STAGES, personName, type FollowUp, type Method, type NextStep, type Queue, type Response, type Route, type Stage, type Track } from '@/lib/live/types';
import { daysSince, fmtDateLong, num } from '@/lib/util';

// Experience follow-up: every guest who filled in "My Next Steps", what they
// said they would like to do, and who is following up with them. A follow-up
// stays in view until the guest takes their step.

const TABS = ['Follow-ups', "Guests' answers", 'Who follows up'] as const;
type Tab = (typeof TABS)[number];
const OPEN_STAGES: Stage[] = ['To do', 'Reached out', 'Responded', 'Step taken'];
const PER = 50;

const trackTone = (t: Track | undefined) => (t === 'Give' ? 'good' : t === 'Already involved' ? 'gray' : t === 'Pray' ? 'brand' : 'warn');
const stageTone = (s: Stage) => (s === 'To do' ? 'warn' : s === 'Step taken' ? 'good' : s === 'Not needed' ? 'gray' : 'brand');
const stageDot = (s: string) => (s === 'To do' ? 'bg-warn' : s === 'Reached out' ? 'bg-brand' : s === 'Responded' ? 'bg-brand-dark' : s === 'Step taken' ? 'bg-good' : 'bg-ink-faint');
const ms = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).getTime();

/** A follow-up with everything about it looked up once. */
interface Item {
  f: FollowUp;
  step: NextStep | undefined;
  response: Response | undefined;
  guest: string;
  church: string;
  owner: string;
  visited: number;
}

export default function ExperiencePage() {
  const { followUps, responses, nextSteps, people, churches, staff } = useLive();
  const [tab, setTab] = useSticky<Tab>('experience.tab', 'Follow-ups');

  const items = useMemo<Item[]>(() => {
    const stepByKey = new Map(nextSteps.map((n) => [n.key, n]));
    const responseById = new Map(responses.map((r) => [r.id, r]));
    const personById = new Map(people.map((p) => [p.id, p]));
    const churchById = new Map(churches.map((c) => [c.id, c]));
    const staffById = new Map(staff.map((s) => [s.id, s.name]));
    return followUps.map((f) => {
      const response = f.responseId ? responseById.get(f.responseId) : undefined;
      const church = f.churchId ? churchById.get(f.churchId) : undefined;
      return {
        f,
        step: f.nextStepKey ? stepByKey.get(f.nextStepKey) : undefined,
        response,
        guest: personName(f.personId ? personById.get(f.personId) : undefined) || f.about || 'Guest',
        church: church ? churchLabel(church) : response?.homeChurchText ?? '',
        owner: f.staffId ? staffById.get(f.staffId) ?? 'Someone' : f.queue ? `${f.queue} queue` : 'Nobody',
        visited: response ? ms(response.submittedAt) : ms(f.dueOn),
      };
    });
  }, [followUps, responses, nextSteps, people, churches, staff]);

  const waiting = items.filter((i) => i.f.stage === 'To do').length;
  const moving = items.filter((i) => i.f.stage === 'Reached out' || i.f.stage === 'Responded').length;

  return (
    <>
      <PageHeader title="Experience follow-up" sub="Everyone who told us their next step after the Vulnerable Child Experience, and who is following up with them. Each one stays here until they take that step." />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${tab === t ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="text-sm text-ink-soft">
          <span className="num font-semibold text-warn">{num(waiting)}</span> waiting for a first touch · <span className="num font-semibold text-ink">{num(moving)}</span> in conversation · <span className="num font-semibold text-ink">{num(responses.length)}</span> answers in all
        </div>
      </div>
      {tab === 'Follow-ups' && <FollowUps items={items} />}
      {tab === "Guests' answers" && <Answers />}
      {tab === 'Who follows up' && <Routing />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Follow-ups: the work queue, as a table or a board
// ---------------------------------------------------------------------------
function FollowUps({ items }: { items: Item[] }) {
  const { staff, nextSteps, profile, updateFollowUp } = useLive();
  // If the person signed in is also in the staff list, start on their own follow-ups.
  const me = staff.find((s) => s.name.toLowerCase() === (profile?.fullName ?? '').toLowerCase())?.id;
  const [view, setView] = useSticky<'table' | 'board'>('experience.view', 'table');
  const [whose, setWhose] = useSticky('experience.whose', me ?? 'all');
  const [track, setTrack] = useSticky('experience.track', 'All');
  const [stage, setStage] = useSticky('experience.stage', 'Open');
  const [q, setQ] = useSticky('experience.q', '');
  const [sort, setSort] = useSticky<SortState>('experience.sort', { by: 'visited', dir: -1 });
  const [page, setPage] = useSticky('experience.page', 0);
  const [openId, setOpenId] = useState<string | null>(null);

  const tracks = useMemo(() => [...new Set(nextSteps.filter((n) => n.route !== 'None').map((n) => n.track))], [nextSteps]);
  const needle = q.trim().toLowerCase();
  const scoped = items.filter(
    (i) =>
      (whose === 'all' || (whose.startsWith('q:') ? i.f.queue === whose.slice(2) : i.f.staffId === whose)) &&
      (track === 'All' || i.step?.track === track) &&
      (!needle || i.guest.toLowerCase().includes(needle) || i.church.toLowerCase().includes(needle)),
  );
  const filtered = scoped.filter((i) => (stage === 'Open' ? i.f.stage !== 'Step taken' && i.f.stage !== 'Not needed' : stage === 'All' ? true : i.f.stage === stage));
  const get: Record<string, (i: Item) => string | number> = {
    guest: (i) => i.guest,
    track: (i) => i.step?.track ?? '',
    church: (i) => i.church,
    owner: (i) => i.owner,
    stage: (i) => STAGES.indexOf(i.f.stage),
    visited: (i) => i.visited,
  };
  const rows = sortRows(filtered, get[sort.by] ?? get.visited, sort.dir);
  const pages = Math.ceil(rows.length / PER);
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  const open = items.find((i) => i.f.id === openId);

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div>
            <label htmlFor="fu-whose" className="label">Whose</label>
            <select id="fu-whose" className="field" value={whose} onChange={(e) => reset(() => setWhose(e.target.value))}>
              <option value="all">Everyone&rsquo;s</option>
              <optgroup label="Shared queues">{QUEUES.map((x) => <option key={x} value={`q:${x}`}>{x} queue</option>)}</optgroup>
              <optgroup label="People">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
            </select>
          </div>
          <div>
            <label htmlFor="fu-track" className="label">Next step</label>
            <select id="fu-track" className="field" value={track} onChange={(e) => reset(() => setTrack(e.target.value))}>
              <option>All</option>
              {tracks.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {view === 'table' && (
            <div>
              <label htmlFor="fu-stage" className="label">Stage</label>
              <select id="fu-stage" className="field" value={stage} onChange={(e) => reset(() => setStage(e.target.value))}>
                <option value="Open">Still open</option>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
                <option value="All">All stages</option>
              </select>
            </div>
          )}
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="fu-q" className="label">Search</label>
            <input id="fu-q" className="field" placeholder="Guest or church" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
          </div>
          <ViewSwitch view={view} onChange={setView} />
        </div>

        {view === 'table' ? (
          <>
            <div className="px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> follow-{rows.length === 1 ? 'up' : 'ups'}</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-y border-line bg-paper">
                  <tr>
                    <SortTh col="guest" label="Guest" sort={sort} onSort={setSort} />
                    <SortTh col="track" label="Next step" sort={sort} onSort={setSort} />
                    <SortTh col="church" label="Church" sort={sort} onSort={setSort} />
                    <SortTh col="owner" label="With" sort={sort} onSort={setSort} />
                    <SortTh col="stage" label="Stage" sort={sort} onSort={setSort} />
                    <SortTh col="visited" label="Answered" sort={sort} onSort={setSort} />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(page * PER, page * PER + PER).map((i) => (
                    <tr key={i.f.id} onClick={() => setOpenId(i.f.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-light/50">
                      <td className="td">{i.f.personId ? <PersonLink id={i.f.personId}>{i.guest}</PersonLink> : <span className="font-semibold">{i.guest}</span>}</td>
                      <td className="td"><Badge tone={trackTone(i.step?.track)}>{i.step?.track ?? 'Follow up'}</Badge> <span className="text-ink-soft">{i.f.title}</span></td>
                      <td className="td">{i.f.churchId ? <ChurchLink id={i.f.churchId}>{i.church}</ChurchLink> : i.church ? <span className="text-ink-soft">&ldquo;{i.church}&rdquo;</span> : <span className="text-ink-faint">–</span>}</td>
                      <td className="td">{i.owner}</td>
                      <td className="td"><Badge tone={stageTone(i.f.stage)}>{i.f.stage}</Badge></td>
                      <td className={`td whitespace-nowrap ${i.f.stage === 'To do' && daysSince(i.visited) > 7 ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{fmtDateLong(i.visited)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-ink-soft">{items.length === 0 ? 'No follow-ups yet. They appear as soon as a guest’s answers come in.' : 'Nothing matches those choices.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} onPage={setPage} />
          </>
        ) : (
          <div className="p-4">
            <p className="mb-3 text-xs text-ink-soft">Drag a card to move it to another stage, or click it to see the guest and the message to send. &ldquo;Not needed&rdquo; follow-ups are left off the board.</p>
            <Board
              columns={OPEN_STAGES}
              items={sortRows(scoped.filter((i) => i.f.stage !== 'Not needed'), (i) => i.visited, -1)}
              columnOf={(i) => i.f.stage}
              idOf={(i) => i.f.id}
              onMove={(i, to) => updateFollowUp(i.f.id, { stage: to as Stage })}
              tone={stageDot}
              card={(i) => (
                <button className="block w-full text-left" onClick={() => setOpenId(i.f.id)}>
                  <div className="font-semibold text-brand-deep">{i.guest}</div>
                  <div className="mt-1"><Badge tone={trackTone(i.step?.track)}>{i.step?.track ?? 'Follow up'}</Badge></div>
                  <div className="mt-1 truncate text-xs text-ink-soft">{i.church || 'No church given'}</div>
                  <div className="mt-0.5 flex justify-between gap-2 text-xs text-ink-soft"><span className="truncate">{i.owner}</span><span className="num shrink-0">{fmtDateLong(i.visited)}</span></div>
                </button>
              )}
            />
          </div>
        )}
      </Panel>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? open.guest : ''}>
        {open && <FollowUpDetail key={open.f.id} item={open} />}
      </Drawer>
    </>
  );
}

function CopyBox({ label, value, rows }: { label: string; value: string; rows: number }) {
  const [text, setText] = useState(value);
  const [copied, setCopied] = useState(false);
  const id = `copy-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="label">{label}</label>
        <button
          className="text-xs font-semibold text-brand-dark underline"
          onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea id={id} className="field" rows={rows} value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

function FollowUpDetail({ item }: { item: Item }) {
  const { people, churches, staff, nextSteps, profile, updateFollowUp, logContact } = useLive();
  const { f, response, step } = item;
  const person = people.find((p) => p.id === f.personId);
  const church = churches.find((c) => c.id === f.churchId);
  const [method, setMethod] = useState<Method>('Email');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const draft = draftFor((step?.track ?? 'Already involved') as Track, {
    first: person?.firstName || response?.firstName || '',
    sender: (profile?.fullName ?? '').split(' ')[0],
    church: church ? church.name : '',
    churchHasFam: !!church && SERVING_STATUSES.includes(church.status),
  });
  const email = person?.email || response?.email || '';
  const phone = person?.phone || response?.phone || '';
  const ticked = (response?.nextSteps ?? []).map((k) => nextSteps.find((n) => n.key === k)?.label ?? k);
  const assigned = f.staffId ?? (f.queue ? `q:${f.queue}` : '');

  async function reachedOut() {
    setBusy(true);
    // The contact goes on the guest's own record, and the follow-up moves on a stage.
    const ok = f.personId ? await logContact({ personId: f.personId, method, reached: method !== 'Voicemail', summary: `Experience follow-up (${step?.track ?? f.title})${note.trim() ? `: ${note.trim()}` : ''}` }) : true;
    if (ok) await updateFollowUp(f.id, { stage: f.stage === 'To do' ? 'Reached out' : f.stage });
    setBusy(false);
    if (ok) setNote('');
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={trackTone(step?.track)}>{step?.track ?? 'Follow up'}</Badge>
        <Badge tone={stageTone(f.stage)}>{f.stage}</Badge>
      </div>
      <Row label="Guest">{f.personId ? <PersonLink id={f.personId}>{item.guest}</PersonLink> : item.guest}</Row>
      {phone && <Row label="Phone"><a className="underline" href={`tel:${phone}`}>{phone}</a></Row>}
      {email && <Row label="Email"><a className="underline" href={`mailto:${email}`}>{email}</a></Row>}
      <Row label="Church">{church ? <ChurchLink id={church.id}>{churchLabel(church)}</ChurchLink> : response?.homeChurchText ? <>&ldquo;{response.homeChurchText}&rdquo; <span className="text-warn">(to confirm)</span></> : 'Not given'}</Row>
      {response && <Row label="Answered">{fmtDateLong(ms(response.submittedAt))}</Row>}
      <Row label="What to do">{f.title}</Row>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="fd-stage" className="label">Stage</label>
          <select id="fd-stage" className="field" value={f.stage} onChange={(e) => updateFollowUp(f.id, { stage: e.target.value as Stage })}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fd-owner" className="label">With</label>
          <select
            id="fd-owner"
            className="field"
            value={assigned}
            onChange={(e) => {
              const v = e.target.value;
              updateFollowUp(f.id, v.startsWith('q:') ? { queue: v.slice(2) as Queue, staffId: null } : { staffId: v, queue: null });
            }}
          >
            <optgroup label="Shared queues">{QUEUES.map((x) => <option key={x} value={`q:${x}`}>{x} queue</option>)}</optgroup>
            <optgroup label="People">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
          </select>
        </div>
      </div>

      {response && (ticked.length > 0 || response.wallWords || response.feeling || response.comments) && (
        <div className="mt-6">
          <h3 className="text-sm font-bold">What they told us</h3>
          {ticked.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{ticked.map((t) => <li key={t}>{t}</li>)}</ul>}
          {response.wallWords && <p className="mt-2 text-sm"><span className="text-ink-soft">Wrote on the wall:</span> {response.wallWords}</p>}
          {response.feeling && <p className="mt-1 text-sm"><span className="text-ink-soft">Afterwards:</span> {response.feeling}</p>}
          {response.comments && <p className="mt-1 text-sm"><span className="text-ink-soft">Anything else:</span> {response.comments}</p>}
          {response.describes.length > 0 && <p className="mt-1 text-sm"><span className="text-ink-soft">Describes themselves as:</span> {response.describes.join(', ')}</p>}
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-bold">A message to send</h3>
        <p className="mt-0.5 text-xs text-ink-soft">Change anything you like, copy it, and send it from your own email or phone. The hub does not send it for you.</p>
        <CopyBox label="Email subject" value={draft.subject} rows={1} />
        <CopyBox label="Email" value={draft.email} rows={9} />
        <CopyBox label="Text message" value={draft.text} rows={3} />
      </div>

      <div className="mt-6 rounded-md border border-line bg-paper p-3">
        <h3 className="text-sm font-bold">When you have reached out</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="fd-method" className="label">How</label>
            <select id="fd-method" className="field" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fd-note" className="label">Note (optional)</label>
            <input id="fd-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary mt-2 w-full" disabled={busy} onClick={reachedOut}>{busy ? 'Saving…' : 'Log it and move this on'}</button>
        <p className="mt-1.5 text-xs text-ink-soft">This goes on the guest&rsquo;s contact log. Move the stage to &ldquo;Step taken&rdquo; when they have done what they said.</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Guests' answers
// ---------------------------------------------------------------------------
function Answers() {
  const { responses, nextSteps, churches, people } = useLive();
  const [q, setQ] = useSticky('answers.q', '');
  const [sort, setSort] = useSticky<SortState>('answers.sort', { by: 'date', dir: -1 });
  const [page, setPage] = useSticky('answers.page', 0);
  const [adding, setAdding] = useState(false);
  const churchById = useMemo(() => new Map(churches.map((c) => [c.id, c])), [churches]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const trackOf = useMemo(() => new Map(nextSteps.map((n) => [n.key, n.track])), [nextSteps]);
  const name = (r: Response) => personName(r.personId ? personById.get(r.personId) : undefined) || `${r.firstName} ${r.lastName}`.trim() || 'Guest';
  const churchOf = (r: Response) => (r.churchId && churchById.get(r.churchId) ? churchLabel(churchById.get(r.churchId)!) : r.homeChurchText);
  const needle = q.trim().toLowerCase();
  const get: Record<string, (r: Response) => string | number | null> = {
    date: (r) => ms(r.submittedAt),
    guest: (r) => name(r),
    church: (r) => churchOf(r),
    steps: (r) => r.nextSteps.length,
    invite: (r) => r.likelyToInvite,
  };
  const rows = sortRows(responses.filter((r) => !needle || name(r).toLowerCase().includes(needle) || churchOf(r).toLowerCase().includes(needle)), get[sort.by] ?? get.date, sort.dir);

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="an-q" className="label">Search</label>
            <input id="an-q" className="field max-w-md" placeholder="Guest or church" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <button className="btn-primary" onClick={() => setAdding(true)}>Add an answer by hand</button>
        </div>
        <div className="px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> {rows.length === 1 ? 'answer' : 'answers'}</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-paper">
              <tr>
                <SortTh col="date" label="Answered" sort={sort} onSort={setSort} />
                <SortTh col="guest" label="Guest" sort={sort} onSort={setSort} />
                <SortTh col="church" label="Church" sort={sort} onSort={setSort} />
                <SortTh col="steps" label="Next steps" sort={sort} onSort={setSort} />
                <SortTh col="invite" label="Would invite others" sort={sort} onSort={setSort} right />
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * PER, page * PER + PER).map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="td whitespace-nowrap text-ink-soft">{fmtDateLong(ms(r.submittedAt))}</td>
                  <td className="td">{r.personId ? <PersonLink id={r.personId}>{name(r)}</PersonLink> : name(r)}</td>
                  <td className="td">{r.churchId ? <ChurchLink id={r.churchId}>{churchOf(r)}</ChurchLink> : churchOf(r) ? <span className="text-ink-soft">&ldquo;{churchOf(r)}&rdquo;</span> : <span className="text-ink-faint">–</span>}</td>
                  <td className="td"><div className="flex flex-wrap gap-1">{[...new Set(r.nextSteps.map((k) => trackOf.get(k)).filter((t): t is Track => !!t))].map((t) => <Badge key={t} tone={trackTone(t)}>{t}</Badge>)}</div></td>
                  <td className="td num text-right">{r.likelyToInvite ? `${r.likelyToInvite} of 5` : <span className="text-ink-faint">–</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-ink-soft">{responses.length === 0 ? 'No answers yet.' : 'Nothing matches that search.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={Math.ceil(rows.length / PER)} onPage={setPage} />
      </Panel>
      <Drawer open={adding} onClose={() => setAdding(false)} title="Add an answer by hand">
        {adding && <AddAnswer onDone={() => setAdding(false)} />}
      </Drawer>
    </>
  );
}

function AddAnswer({ onDone }: { onDone: () => void }) {
  const { churches, nextSteps, addResponse } = useLive();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', homeChurchText: '', comments: '' });
  const [churchId, setChurchId] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await addResponse({ ...f, churchId, nextSteps: steps });
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">For a guest who told you in person, or filled the form in on paper. Their follow-ups are made as soon as you save.</p>
      <div className="grid grid-cols-2 gap-2">
        <div><label htmlFor="aa-fn" className="label">First name</label><input id="aa-fn" className="field" required {...field('firstName')} /></div>
        <div><label htmlFor="aa-ln" className="label">Last name</label><input id="aa-ln" className="field" {...field('lastName')} /></div>
        <div><label htmlFor="aa-ph" className="label">Phone</label><input id="aa-ph" type="tel" className="field" {...field('phone')} /></div>
        <div><label htmlFor="aa-em" className="label">Email</label><input id="aa-em" type="email" className="field" {...field('email')} /></div>
      </div>
      <div>
        <label htmlFor="aa-church" className="label">Their church</label>
        <ChurchSelect id="aa-church" value={churchId} onChange={setChurchId} churches={churches} empty="None, or not in the list" />
        {!churchId && <input aria-label="Their church, if it is not in the list" className="field mt-2" placeholder="Type the church if it is not in the list" {...field('homeChurchText')} />}
      </div>
      <fieldset>
        <legend className="label">What they would like to do (tick all that apply)</legend>
        <div className="space-y-1.5">
          {nextSteps.filter((n) => n.active).map((n) => (
            <label key={n.key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={steps.includes(n.key)} onChange={(e) => setSteps(e.target.checked ? [...steps, n.key] : steps.filter((k) => k !== n.key))} />
              <span>{n.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div><label htmlFor="aa-co" className="label">Anything else they said</label><textarea id="aa-co" className="field" rows={2} {...field('comments')} /></div>
      <button type="submit" className="btn-primary w-full" disabled={busy || !f.firstName.trim() || steps.length === 0}>{busy ? 'Saving…' : 'Save and make the follow-ups'}</button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Who follows up: C127's flow chart, as settings
// ---------------------------------------------------------------------------
const ROUTE_HELP: Record<Route, string> = {
  'Church coach': 'The coach of the guest’s church. With no church or no coach, the FAM queue.',
  'Named owner': 'The person you pick here. With nobody picked, a shared queue.',
  'Shared queue': 'The Belong queue, for whoever is in that day.',
  None: 'No follow-up is made.',
};

function Routing() {
  const { nextSteps, staff, updateNextStep, addStaff } = useLive();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('Experience');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="lg:col-span-2">
        <p className="border-b border-line p-4 text-sm text-ink-soft">
          Each choice on the &ldquo;My Next Steps&rdquo; form, and who follows up when a guest ticks it. Changes apply to answers that come in from now on; follow-ups already made stay where they are.
        </p>
        <ul className="divide-y divide-line">
          {nextSteps.map((n) => <RoutingRow key={n.key} n={n} staff={staff} onChange={(patch) => updateNextStep(n.key, patch)} />)}
        </ul>
      </Panel>
      <div className="space-y-4">
        <Panel title="How each route works">
          <dl className="space-y-2 p-4 text-sm">
            {ROUTES.map((r) => <div key={r}><dt className="font-semibold">{r === 'None' ? 'No follow-up' : r}</dt><dd className="text-ink-soft">{ROUTE_HELP[r]}</dd></div>)}
          </dl>
        </Panel>
        <Panel title="Add a staff member">
          <form
            className="space-y-3 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await addStaff(name, team)) setName('');
            }}
          >
            <p className="text-sm text-ink-soft">So a follow-up can be given to them by name. This does not give them a sign-in.</p>
            <div><label htmlFor="st-name" className="label">Full name</label><input id="st-name" className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <label htmlFor="st-team" className="label">Team</label>
              <select id="st-team" className="field" value={team} onChange={(e) => setTeam(e.target.value)}>
                {['FAM', 'Family Care', 'Experience', 'Development', 'Leadership', 'Admin'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-ghost w-full" disabled={!name.trim()}>Add</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

function RoutingRow({ n, staff, onChange }: { n: NextStep; staff: { id: string; name: string }[]; onChange: (patch: Partial<Pick<NextStep, 'action' | 'route' | 'ownerId' | 'active'>>) => void }) {
  const [action, setAction] = useState(n.action);
  return (
    <li className={`grid gap-3 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] ${n.active ? '' : 'opacity-60'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={trackTone(n.track)}>{n.track}</Badge>{!n.active && <Badge>Switched off</Badge>}</div>
        <p className="mt-1 text-sm">&ldquo;{n.label}&rdquo;</p>
        <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={n.active} onChange={(e) => onChange({ active: e.target.checked })} />
          Make follow-ups for this choice
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label htmlFor={`rt-a-${n.key}`} className="label">What to do</label>
          <input id={`rt-a-${n.key}`} className="field" value={action} onChange={(e) => setAction(e.target.value)} onBlur={() => action !== n.action && onChange({ action })} />
        </div>
        <div>
          <label htmlFor={`rt-r-${n.key}`} className="label">Goes to</label>
          <select id={`rt-r-${n.key}`} className="field" value={n.route} onChange={(e) => onChange({ route: e.target.value as Route })}>
            {ROUTES.map((r) => <option key={r} value={r}>{r === 'None' ? 'No follow-up' : r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`rt-o-${n.key}`} className="label">Named owner</label>
          <select id={`rt-o-${n.key}`} className="field" value={n.ownerId ?? ''} disabled={n.route !== 'Named owner'} onChange={(e) => onChange({ ownerId: e.target.value || null })}>
            <option value="">Nobody yet</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
    </li>
  );
}

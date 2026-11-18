'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DateFilter, fitsAll, toMs, type DateConditions } from '@/components/live/DateFilter';
import { SortTh, sortRows, type SortState } from '@/components/live/sort';
import { Badge, Drawer, PageHeader, Panel, Row } from '@/components/ui';
import { useSticky } from '@/lib/live/sticky';
import { useLive } from '@/lib/live/store';
import { FEEDBACK_STATUSES, isOutstanding, type Feedback, type FeedbackStatus } from '@/lib/live/types';
import { ago, fmtDateLong, num } from '@/lib/util';

// What the team has sent in from the Feedback button. Only the builder sees
// this page, and the database sends these rows to nobody else.

const statusTone = (s: FeedbackStatus) => (s === 'New' ? 'warn' : s === 'In progress' ? 'brand' : s === 'Done' ? 'good' : 'gray');
const kindTone = (k: string) => (k === 'Something is wrong' ? 'alert' : k === 'Question' ? 'brand' : 'gray');
const when = (f: Feedback) => new Date(f.createdAt).getTime();

export default function FeedbackPage() {
  const { profile, feedback } = useLive();
  const [show, setShow] = useSticky('feedback.show', 'Outstanding');
  const [q, setQ] = useSticky('feedback.q', '');
  const [dates, setDates] = useSticky<DateConditions>('feedback.dates', {});
  const [sort, setSort] = useSticky<SortState>('feedback.sort', { by: 'when', dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);

  if (!profile?.isBuilder) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-white p-6 text-center">
        <h1 className="font-display text-3xl tracking-wide">Not available</h1>
        <p className="mt-2 text-sm text-ink-soft">Feedback goes to the person building the hub. Use the Feedback button in the corner of any page to send some.</p>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const get: Record<string, (f: Feedback) => string | number> = {
    when,
    who: (f) => f.authorName || f.authorEmail,
    kind: (f) => f.kind,
    message: (f) => f.message,
    where: (f) => f.pageLabel,
    status: (f) => FEEDBACK_STATUSES.indexOf(f.status),
  };
  const rows = sortRows(
    feedback.filter(
      (f) =>
        (show === 'All' || (show === 'Outstanding' ? isOutstanding(f) : f.status === show)) &&
        (!needle || f.message.toLowerCase().includes(needle) || f.authorName.toLowerCase().includes(needle) || f.pageLabel.toLowerCase().includes(needle)) &&
        fitsAll({ sent: when(f), resolved: toMs(f.resolvedAt) }, dates),
    ),
    get[sort.by] ?? get.when,
    sort.dir,
  );
  const open = feedback.find((f) => f.id === openId);
  const count = (s: FeedbackStatus) => feedback.filter((f) => f.status === s).length;

  return (
    <>
      <PageHeader title="Feedback" sub="Everything the team has sent from the Feedback button, with who sent it and what they were looking at. Only you see this page." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['Outstanding', ...FEEDBACK_STATUSES, 'All'] as const).map((s) => (
          <button key={s} aria-pressed={show === s} onClick={() => setShow(s)} className={`rounded-lg border px-3 py-2 text-left ${show === s ? 'border-brand bg-brand-light' : 'border-line bg-white hover:border-brand'}`}>
            <div className="num font-display text-3xl leading-none">{num(s === 'Outstanding' ? feedback.filter(isOutstanding).length : s === 'All' ? feedback.length : count(s))}</div>
            <div className="mt-1 text-xs font-semibold text-ink-soft">{s}</div>
          </button>
        ))}
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="fbk-q" className="label">Search</label>
            <input id="fbk-q" className="field max-w-md" placeholder="What they said, who, or which page" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <DateFilter fields={[{ key: 'sent', label: 'Sent' }, { key: 'resolved', label: 'Done or closed' }]} value={dates} onChange={setDates} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-paper">
              <tr>
                <SortTh col="when" label="Sent" sort={sort} onSort={setSort} />
                <SortTh col="who" label="From" sort={sort} onSort={setSort} />
                <SortTh col="kind" label="Kind" sort={sort} onSort={setSort} />
                <SortTh col="message" label="What they said" sort={sort} onSort={setSort} />
                <SortTh col="where" label="Looking at" sort={sort} onSort={setSort} />
                <SortTh col="status" label="Status" sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} onClick={() => setOpenId(f.id)} className="cursor-pointer border-b border-line align-top last:border-0 hover:bg-brand-light/50">
                  <td className="td whitespace-nowrap text-ink-soft" title={fmtDateLong(when(f))}>{ago(when(f))}</td>
                  <td className="td whitespace-nowrap font-semibold">{f.authorName || f.authorEmail || 'Someone'}</td>
                  <td className="td"><Badge tone={kindTone(f.kind)}>{f.kind}</Badge></td>
                  <td className="td max-w-md"><p className="line-clamp-2">{f.message}</p>{f.builderNote && <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">Your note: {f.builderNote}</p>}</td>
                  <td className="td">{f.pagePath ? <Link className="font-semibold text-brand-deep underline decoration-brand/30 underline-offset-2" href={f.pagePath} onClick={(e) => e.stopPropagation()}>{f.pageLabel || f.pagePath}</Link> : <span className="text-ink-faint">–</span>}</td>
                  <td className="td"><Badge tone={statusTone(f.status)}>{f.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-ink-soft">{feedback.length === 0 ? 'No feedback yet. It appears here as soon as someone sends some.' : show === 'Outstanding' ? 'Nothing outstanding. Everything sent so far has been dealt with.' : 'Nothing matches.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-2 text-xs text-ink-soft"><span className="num font-semibold text-ink">{num(rows.length)}</span> shown</div>
      </Panel>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.kind} from ${open.authorName || 'someone'}` : ''}>
        {open && <Detail key={open.id} f={open} />}
      </Drawer>
    </>
  );
}

function Detail({ f }: { f: Feedback }) {
  const { updateFeedback } = useLive();
  const [note, setNote] = useState(f.builderNote);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2"><Badge tone={kindTone(f.kind)}>{f.kind}</Badge><Badge tone={statusTone(f.status)}>{f.status}</Badge></div>
      <p className="whitespace-pre-wrap rounded-md border border-line bg-paper p-3 text-sm">{f.message}</p>

      <div className="mt-4">
        <Row label="From">{f.authorName || 'Not recorded'}</Row>
        {f.authorEmail && <Row label="Email"><a className="underline" href={`mailto:${f.authorEmail}?subject=${encodeURIComponent('Your feedback on the C127 Hub')}`}>{f.authorEmail}</a></Row>}
        <Row label="Sent">{fmtDateLong(when(f))}, {new Date(f.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Row>
        <Row label="Looking at">{f.pageLabel || 'Not recorded'}</Row>
        {f.screen && <Row label="Screen size">{f.screen}{Number(f.screen.split(' ')[0]) < 700 ? ' (a phone)' : ''}</Row>}
        {f.resolvedAt && <Row label="Closed">{fmtDateLong(new Date(f.resolvedAt).getTime())}</Row>}
      </div>
      {f.pagePath && <Link className="btn-ghost mt-3 block w-full text-center" href={f.pagePath}>Open the page they were on</Link>}

      <div className="mt-6">
        <span className="label">Where this stands</span>
        <div className="grid grid-cols-2 gap-2">
          {FEEDBACK_STATUSES.map((s) => (
            <button key={s} aria-pressed={f.status === s} onClick={() => updateFeedback(f.id, { status: s })} className={`rounded-md border px-3 py-2 text-sm font-semibold ${f.status === s ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:border-brand'}`}>
              {s}
            </button>
          ))}
        </div>
        <label htmlFor="fbk-note" className="label mt-4">Your note</label>
        <textarea id="fbk-note" className="field" rows={3} placeholder="What you changed, or why not" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== f.builderNote && updateFeedback(f.id, { builderNote: note })} />
        <p className="mt-1 text-xs text-ink-soft">The note saves when you click away. The sender does not see it.</p>
      </div>
    </>
  );
}

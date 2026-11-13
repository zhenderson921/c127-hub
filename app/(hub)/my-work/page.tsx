'use client';

import { useState } from 'react';
import { Badge, PageHeader, Panel, Stat } from '@/components/ui';
import { useStore } from '@/lib/store';
import { ago, daysSince, fmtDate, num } from '@/lib/util';

export default function MyWorkPage() {
  const { coaches, churches, families, allTasks, now, toggleTask, addTask, logChurchContact } = useStore();
  const { profile } = useStore();
  const [coachId, setCoachId] = useState(profile?.coachId ?? coaches[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');

  const mine = churches.filter((c) => c.coachId === coachId);
  const ids = new Set(mine.map((c) => c.id));
  const tasks = allTasks.filter((t) => t.coachId === coachId).sort((a, b) => Number(a.done) - Number(b.done) || a.due - b.due);
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due < now);
  const myFamilies = families.filter((f) => f.churchId && ids.has(f.churchId));
  const quietFamilies = myFamilies.filter((f) => daysSince(f.lastContact, now) >= 30);

  if (coaches.length === 0) {
    return (
      <>
        <PageHeader title="My work" sub="Each coach's churches, to-dos and reminders." />
        <Panel><p className="px-4 py-8 text-sm text-ink-soft">No coaches yet. Import your church list with a coach column and each coach appears here with their churches.</p></Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader title="My work" sub="What each coach sees when they sit down: their churches, their to-dos, and the reminders the hub raised because something went quiet.">
        <label htmlFor="mw-coach" className="text-sm text-ink-soft">Viewing as</label>
        <select id="mw-coach" className="field w-auto" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="My churches" value={num(mine.length)} />
        <Stat label="Families through them" value={num(myFamilies.length)} hint={`${quietFamilies.length} with no contact in 30 days`} />
        <Stat label="Open to-dos" value={num(open.length)} />
        <Stat label="Overdue" value={num(overdue.length)} tone={overdue.length ? 'warn' : 'plain'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="To-dos">
          <form
            className="flex flex-wrap gap-2 border-b border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              addTask({ coachId, title: title.trim(), about: about || mine[0]?.name || '', due: Date.now() + 3 * 86_400_000 });
              setTitle('');
            }}
          >
            <input aria-label="New to-do" className="field min-w-0 flex-1" placeholder="Add a to-do" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select aria-label="About which church" className="field w-auto max-w-[12rem]" value={about} onChange={(e) => setAbout(e.target.value)}>
              <option value="">Which church?</option>
              {mine.map((c) => <option key={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-primary" type="submit">Add</button>
          </form>
          <ul className="divide-y divide-line">
            {tasks.map((t) => {
              const late = !t.done && t.due < now;
              const churchId = t.auto && t.id.startsWith('auto-ch-') ? t.id.replace('auto-ch-', '') : null;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  {t.auto ? (
                    <span className="h-4 w-4 shrink-0 rounded-full border-2 border-warn" aria-hidden />
                  ) : (
                    <input type="checkbox" aria-label={`Done: ${t.title}`} checked={t.done} onChange={() => toggleTask(t.id)} className="h-4 w-4 shrink-0 accent-brand" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${t.done ? 'text-ink-faint line-through' : 'font-medium'}`}>{t.title}</div>
                    <div className="truncate text-xs text-ink-soft">{t.about}</div>
                  </div>
                  {t.auto && <Badge tone="warn">Reminder</Badge>}
                  {churchId ? (
                    <button className="btn-ghost shrink-0 py-1" onClick={() => logChurchContact(churchId)}>Log check-in</button>
                  ) : (
                    <span className={`num shrink-0 text-xs ${late ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{late ? `Due ${ago(t.due, now)}` : fmtDate(t.due)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="My churches">
          <ul className="divide-y divide-line">
            {mine.sort((a, b) => a.lastContact - b.lastContact).map((c) => {
              const d = daysSince(c.lastContact, now);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-ink-soft">{c.stage} · advocate {c.advocate}</div>
                  </div>
                  <span className={`num shrink-0 text-xs ${d >= 28 && c.stage !== 'Paused' ? 'font-semibold text-warn' : 'text-ink-soft'}`}>{ago(c.lastContact, now)}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}

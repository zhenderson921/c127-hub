'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { churchLabel } from '@/lib/live/match';
import { useLive } from '@/lib/live/store';
import { personName } from '@/lib/live/types';

/**
 * Back and forward arrows for moving between records inside the Live tool:
 * family, to its church, to a person there, and back again. They remember the
 * trail you took in this tab, and say where each arrow leads.
 */
export function NavArrows() {
  const path = usePathname();
  const router = useRouter();
  const { people, families, churches } = useLive();
  const trail = useRef<string[]>([]);
  const at = useRef(-1);
  const stepping = useRef(false);
  const [, redraw] = useState(0);

  useEffect(() => {
    if (stepping.current) stepping.current = false;
    else if (trail.current[at.current] !== path) {
      // A fresh click drops anything ahead of where you are, like a browser does.
      trail.current = [...trail.current.slice(0, at.current + 1), path];
      at.current = trail.current.length - 1;
    }
    redraw((n) => n + 1);
  }, [path]);

  const name = (p: string | undefined): string => {
    if (!p) return '';
    const [, , section, id] = p.split('/');
    if (!id) return section === 'review' ? 'Data check' : section === 'account' ? 'Your account' : section ? section[0].toUpperCase() + section.slice(1) : 'Live tool';
    if (section === 'people') return personName(people.find((x) => x.id === id)) || 'a person';
    if (section === 'families') return families.find((x) => x.id === id)?.name ?? 'a family';
    const c = churches.find((x) => x.id === id);
    return c ? churchLabel(c) : 'a church';
  };
  const go = (by: 1 | -1) => {
    const to = trail.current[at.current + by];
    if (!to) return;
    stepping.current = true;
    at.current += by;
    router.push(to);
  };
  const back = trail.current[at.current - 1];
  const forward = trail.current[at.current + 1];
  const btn = 'flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand hover:text-brand-dark disabled:cursor-default disabled:border-line disabled:text-ink-faint';

  return (
    <nav aria-label="Where you have been" className="mb-4 flex items-center gap-2">
      <button className={btn} disabled={!back} onClick={() => go(-1)} title={back ? `Back to ${name(back)}` : 'Nothing to go back to'}>
        <span aria-hidden>←</span> {back ? <span className="max-w-[14rem] truncate">{name(back)}</span> : 'Back'}
      </button>
      <button className={btn} disabled={!forward} onClick={() => go(1)} title={forward ? `Forward to ${name(forward)}` : 'Nothing to go forward to'}>
        {forward ? <span className="max-w-[14rem] truncate">{name(forward)}</span> : 'Forward'} <span aria-hidden>→</span>
      </button>
    </nav>
  );
}

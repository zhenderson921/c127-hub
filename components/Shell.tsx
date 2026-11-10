'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useStore } from '@/lib/store';

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  { group: 'Overview', items: [{ href: '/', label: 'Dashboard' }, { href: '/my-work', label: 'My work' }] },
  {
    group: 'People',
    items: [
      { href: '/families', label: 'Families' },
      { href: '/churches', label: 'Churches' },
      { href: '/volunteers', label: 'Volunteers' },
      { href: '/map', label: 'Church match map' },
    ],
  },
  {
    group: 'Ministry',
    items: [
      { href: '/experience', label: 'Experience follow-up' },
      { href: '/care', label: 'Care requests' },
      { href: '/giving', label: 'Giving' },
    ],
  },
  { group: 'Data', items: [{ href: '/reports', label: 'Grant report' }, { href: '/import', label: 'Import a spreadsheet' }] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { reset } = useStore();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">{g.group}</div>
          {g.items.map((it) => {
            const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-1.5 font-display text-lg tracking-wider ${active ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink lg:flex lg:h-screen lg:sticky lg:top-0">
        <div className="border-b border-white/10 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/c127-logo-white.png" alt="Commission 127" className="w-40" />
        </div>
        {nav}
        <div className="border-t border-white/10 px-5 py-3 text-xs text-white/50">
          <button onClick={reset} className="hover:text-white">Reset sample data</button>
          <span className="px-2">·</span>
          <button onClick={signOut} className="hover:text-white">Sign out</button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/c127-logo-white.png" alt="Commission 127" className="w-32" />
        <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-white/30 px-3 py-1 font-display text-lg tracking-wider text-white">
          {open ? 'Close' : 'Menu'}
        </button>
      </header>
      {open && <div className="fixed inset-x-0 bottom-0 top-[52px] z-30 flex flex-col bg-ink lg:hidden">{nav}</div>}

      <div className="min-w-0 flex-1">
        <div className="border-b border-warn/20 bg-warn-light px-4 py-1.5 text-center text-xs text-warn">
          Demo with invented sample data. No real family, church, volunteer or donor appears here.
        </div>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

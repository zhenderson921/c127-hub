'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export type NavGroup = { group: string; items: { href: string; label: string; badge?: number }[] };

/**
 * The frame both views share: logo, the Prototype / Live tool switch, navigation,
 * a banner saying which view this is, and the page itself.
 *
 *  - Prototype: every screen from the first demo, on invented sample data.
 *  - Live tool: the screens being built piece by piece on C127's real records.
 */
export function ShellFrame({
  view,
  groups,
  footer,
  error,
  clearError,
  children,
}: {
  view: 'prototype' | 'live';
  groups: NavGroup[];
  footer: React.ReactNode;
  error?: string | null;
  clearError?: () => void;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const root = view === 'live' ? '/live' : '/';

  const switcher = (
    <div className="mx-3 mt-3 grid grid-cols-2 rounded-md bg-white/10 p-0.5 text-center font-display text-base tracking-wider" role="group" aria-label="Which view">
      {/* Full page loads on purpose: the two views keep separate data. */}
      <a href="/?view=prototype" aria-current={view === 'prototype' ? 'page' : undefined} className={`rounded px-2 py-1 ${view === 'prototype' ? 'bg-white text-ink' : 'text-white/70 hover:text-white'}`}>
        Prototype
      </a>
      <a href="/live" aria-current={view === 'live' ? 'page' : undefined} className={`rounded px-2 py-1 ${view === 'live' ? 'bg-brand text-white' : 'text-white/70 hover:text-white'}`}>
        Live tool
      </a>
    </div>
  );

  const nav = (
    <>
      {switcher}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">{g.group}</div>
            {g.items.map((it) => {
              const active = it.href === root ? path === root : path.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-1.5 font-display text-lg tracking-wider ${active ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    {it.label}
                    {!!it.badge && <span className="num rounded-full bg-warn px-2 font-sans text-xs font-bold leading-5 text-white" aria-label={`${it.badge} outstanding`}>{it.badge}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-xs text-white/50">{footer}</div>
    </>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink lg:flex lg:h-screen lg:sticky lg:top-0">
        <div className="border-b border-white/10 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/c127-logo-white.png" alt="Commission 127" className="w-40" />
        </div>
        {nav}
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
        {view === 'prototype' ? (
          <div className="border-b border-warn/20 bg-warn-light px-4 py-1.5 text-center text-xs text-warn">
            Prototype with invented sample data. No real family, church, volunteer or donor appears here.
          </div>
        ) : (
          <div className="border-b border-brand/20 bg-brand-light px-4 py-1.5 text-center text-xs text-brand-deep">
            Live tool with C127&rsquo;s real records. Changes you make are saved for the whole team.
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 border-b border-alert/20 bg-alert-light px-4 py-2 text-sm text-alert">
            <span>{error}</span>
            {clearError && <button onClick={clearError} className="shrink-0 font-semibold underline">Dismiss</button>}
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

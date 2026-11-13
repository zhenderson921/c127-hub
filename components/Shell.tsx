'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  {
    group: 'Church side',
    items: [
      { href: '/church', label: 'Church view' },
      { href: '/serve', label: 'Volunteer view' },
      { href: '/request-help', label: 'Family request' },
    ],
  },
  { group: 'Data', items: [{ href: '/reports', label: 'Grant report' }, { href: '/import', label: 'Import a spreadsheet' }] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { reset, mode, profile, error, clearError, signOut } = useStore();
  const [open, setOpen] = useState(false);

  // A church advocate works only in the church side of the hub.
  const advocate = mode === 'live' && profile?.role === 'advocate';
  const groups = advocate ? [{ group: 'Church side', items: [{ href: '/church', label: 'Church view' }] }] : NAV;
  useEffect(() => {
    if (advocate && !path.startsWith('/church')) router.replace('/church');
  }, [advocate, path, router]);

  const nav = (
    <>
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
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
      <div className="border-t border-white/10 px-5 py-3 text-xs text-white/50">
        {mode === 'live' && profile && <div className="mb-1 truncate text-white/70">{profile.fullName || profile.email}</div>}
        {mode === 'demo' && (
          <>
            <button onClick={reset} className="hover:text-white">Reset sample data</button>
            <span className="px-2">·</span>
          </>
        )}
        <button onClick={signOut} className="hover:text-white">Sign out</button>
      </div>
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
        {mode === 'demo' ? (
          <div className="border-b border-warn/20 bg-warn-light px-4 py-1.5 text-center text-xs text-warn">
            Demo with invented sample data. No real family, church, volunteer or donor appears here.
          </div>
        ) : (
          <div className="border-b border-brand/20 bg-brand-light px-4 py-1.5 text-center text-xs text-brand-deep">
            Live C127 records. Changes you make are saved for the whole team.
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 border-b border-alert/20 bg-alert-light px-4 py-2 text-sm text-alert">
            <span>{error}</span>
            <button onClick={clearError} className="shrink-0 font-semibold underline">Dismiss</button>
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {mode === 'live' && profile?.role === 'none' ? (
            <div className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-white p-6 text-center">
              <h1 className="font-display text-3xl tracking-wide">Almost there</h1>
              <p className="mt-2 text-sm text-ink-soft">
                You are signed in as {profile.email}, but your account has not been given a role yet. Ask a C127 staff member to set you up, then reload this page.
              </p>
            </div>
          ) : advocate && !path.startsWith('/church') ? null : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

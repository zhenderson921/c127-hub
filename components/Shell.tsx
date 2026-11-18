'use client';

import { ShellFrame, type NavGroup } from '@/components/ShellFrame';
import { useStore } from '@/lib/store';

const NAV: NavGroup[] = [
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

/** The Prototype view: every screen from the first demo, on invented sample data. */
export function Shell({ children }: { children: React.ReactNode }) {
  const { reset, error, clearError, signOut } = useStore();
  return (
    <ShellFrame
      view="prototype"
      groups={NAV}
      error={error}
      clearError={clearError}
      footer={
        <>
          <button onClick={reset} className="hover:text-white">Reset sample data</button>
          <span className="px-2">·</span>
          <button onClick={signOut} className="hover:text-white">Sign out</button>
        </>
      }
    >
      {children}
    </ShellFrame>
  );
}

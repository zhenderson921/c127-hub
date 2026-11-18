'use client';

import Link from 'next/link';
import { FeedbackButton } from '@/components/live/FeedbackButton';
import { ShellFrame, type NavGroup } from '@/components/ShellFrame';
import { isOutstanding } from '@/lib/live/types';
import { useLive } from '@/lib/live/store';

// Screens are added here one at a time as each piece moves onto real data.
const NAV: NavGroup[] = [
  {
    group: 'People',
    items: [
      { href: '/live/people', label: 'People' },
      { href: '/live/families', label: 'Families' },
      { href: '/live/churches', label: 'Churches' },
    ],
  },
  { group: 'Ministry', items: [{ href: '/live/experience', label: 'Experience follow-up' }] },
  { group: 'Data', items: [{ href: '/live/review', label: 'Data check' }] },
];

/** The Live tool: C127's real records, built piece by piece. */
export function LiveShell({ children }: { children: React.ReactNode }) {
  const { profile, ready, error, clearError, signOut, feedback } = useLive();
  const team = profile?.role === 'staff' || profile?.role === 'coach';

  let body: React.ReactNode = children;
  if (!ready) {
    body = <div className="py-24 text-center text-ink-soft">Loading the live tool…</div>;
  } else if (!team) {
    body = (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-white p-6 text-center">
        <h1 className="font-display text-3xl tracking-wide">Almost there</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {profile?.role === 'advocate'
            ? `You are signed in as ${profile.email}. The live tool is open to C127 staff for now; the church side is coming.`
            : `You are signed in as ${profile?.email ?? 'your account'}, but it has not been given a role yet. Ask a C127 staff member to set you up, then reload this page.`}
        </p>
      </div>
    );
  }

  return (
    <ShellFrame
      view="live"
      groups={
        team
          ? [
              ...NAV,
              ...(profile?.isAdmin || profile?.isBuilder
                ? [{
                    group: 'Admin',
                    items: [
                      ...(profile.isAdmin ? [{ href: '/live/users', label: 'Users' }, { href: '/live/history', label: 'History' }] : []),
                      // The number is how much feedback is still waiting to be dealt with.
                      ...(profile.isBuilder ? [{ href: '/live/feedback', label: 'Feedback', badge: feedback.filter(isOutstanding).length }] : []),
                    ],
                  }]
                : []),
            ]
          : []
      }
      error={error}
      clearError={clearError}
      footer={
        <>
          {profile && <div className="mb-1 truncate text-white/70">{profile.fullName || profile.email}</div>}
          <Link href="/live/account" className="hover:text-white">Change password</Link>
          <span className="px-2">·</span>
          <button onClick={signOut} className="hover:text-white">Sign out</button>
        </>
      }
    >
      {body}
      {ready && team && <FeedbackButton />}
    </ShellFrame>
  );
}

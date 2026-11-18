'use client';

import Link from 'next/link';

// Every person, family and church named anywhere in the Live tool is a link to
// its own page, so you can follow a thread: family, serving church, the people
// at that church, and on.
const cls = 'font-semibold text-brand-deep underline decoration-brand/30 underline-offset-2 hover:decoration-brand';
const stop = (e: React.MouseEvent) => e.stopPropagation(); // a link inside a clickable row opens only the link

export function PersonLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link href={`/live/people/${id}`} className={cls} onClick={stop}>{children}</Link>;
}
export function FamilyLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link href={`/live/families/${id}`} className={cls} onClick={stop}>{children}</Link>;
}
export function ChurchLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link href={`/live/churches/${id}`} className={cls} onClick={stop}>{children}</Link>;
}

/** Shown on a record page when the address names something that is not there. */
export function NotFound({ what, href, list }: { what: string; href: string; list: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-white p-6 text-center">
      <h1 className="font-display text-3xl tracking-wide">Not found</h1>
      <p className="mt-2 text-sm text-ink-soft">That {what} is not in the hub. It may have been joined with another record or removed.</p>
      <Link href={href} className="btn-primary mt-4 inline-block">Back to {list}</Link>
    </div>
  );
}

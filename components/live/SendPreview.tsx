'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui';

// A PREVIEW of sending email from the hub. Nothing here sends, saves or
// connects to anything. It exists so C127 can see and react to how it would
// work before the Google Workspace setup is done. Every surface says so, so
// nobody believes an email went out when it did not.
//
// When the real thing is built: "connected" comes from a connected_accounts
// table, Send calls a server route that uses the person's Gmail, and the
// result is written to the contact log. See the communications breakdown.

const KEY = 'c127-preview-gmail-connected';

/** Whether this browser is pretending to be connected, for the preview only. */
export function usePreviewConnection(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === 'yes');
    } catch {
      /* private window: the preview simply starts unconnected */
    }
  }, []);
  const set = (v: boolean) => {
    setOn(v);
    try {
      if (v) localStorage.setItem(KEY, 'yes');
      else localStorage.removeItem(KEY);
    } catch {
      /* nothing to do */
    }
  };
  return [on, set];
}

export function PreviewTag() {
  return <span className="rounded border border-dashed border-warn px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warn">Preview</span>;
}

/** The compose-and-send step, as it would look. */
export function SendPreview({ from, to, toName, subject, body, onClose }: { from: string; to: string; toName: string; subject: string; body: string; onClose: () => void }) {
  const [connected] = usePreviewConnection();
  const [step, setStep] = useState<'compose' | 'sent'>('compose');

  return (
    <div className="mt-3 rounded-md border-2 border-dashed border-warn bg-warn-light/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold">Send from the hub <PreviewTag /></h4>
        <button className="text-xs font-semibold text-ink-soft underline" onClick={onClose}>Close the preview</button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">This shows how sending will work once C127&rsquo;s Google Workspace is connected. <strong className="text-ink">Nothing is sent or saved from here.</strong></p>

      {step === 'compose' ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm">
          <dl className="space-y-1">
            <div className="flex gap-2"><dt className="w-14 shrink-0 text-ink-soft">From</dt><dd className="min-w-0 break-words">{connected ? from || 'your C127 address' : <span className="text-warn">Your Gmail is not connected yet</span>}</dd></div>
            <div className="flex gap-2"><dt className="w-14 shrink-0 text-ink-soft">To</dt><dd className="min-w-0 break-words">{toName}{to ? ` <${to}>` : ''}</dd></div>
            <div className="flex gap-2"><dt className="w-14 shrink-0 text-ink-soft">Subject</dt><dd className="min-w-0 break-words font-semibold">{subject}</dd></div>
          </dl>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-line pt-2">{body}</p>
          <button className="btn-primary mt-3 w-full" disabled={!connected || !to} onClick={() => setStep('sent')}>Send (preview only)</button>
          {!connected && <p className="mt-1.5 text-xs text-ink-soft">To try the rest of the preview, open <a className="font-semibold underline" href="/live/account">Your account</a> and click &ldquo;Connect my Gmail&rdquo; there. It only pretends, on this computer.</p>}
          {connected && !to && <p className="mt-1.5 text-xs text-ink-soft">This guest has no email address on their record.</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded-md bg-white p-3 font-semibold text-warn">Preview only: no email was sent to {toName}.</p>
          <p className="text-ink-soft">With Gmail connected, this is what would have happened:</p>
          <ol className="space-y-2">
            <li className="rounded-md border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">1. It goes out from your own address</span><Badge tone="good">Sent</Badge></div>
              <p className="mt-0.5 text-ink-soft">{toName} sees an ordinary email from you. It is in your Gmail Sent folder like any other.</p>
            </li>
            <li className="rounded-md border border-line bg-white p-3">
              <div className="font-semibold">2. A copy lands on their record</div>
              <p className="mt-0.5 text-ink-soft">The contact log shows the subject and the message, and this follow-up moves to &ldquo;Reached out&rdquo; by itself.</p>
            </li>
            <li className="rounded-md border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">3. If they write back</span><Badge tone="brand">Replied</Badge></div>
              <p className="mt-0.5 text-ink-soft">Their reply shows here under your message, and the follow-up moves to &ldquo;Responded&rdquo;. The hub only reads conversations it started, never the rest of your inbox.</p>
            </li>
            <li className="rounded-md border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">4. If they do not</span><Badge tone="warn">No reply yet</Badge></div>
              <p className="mt-0.5 text-ink-soft">After three days it is flagged so someone can nudge. A wrong address shows as &ldquo;Bounced&rdquo;.</p>
            </li>
          </ol>
          <button className="btn-ghost w-full" onClick={() => setStep('compose')}>Back to the message</button>
        </div>
      )}
    </div>
  );
}

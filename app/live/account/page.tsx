'use client';

import { useState } from 'react';
import { PreviewTag, usePreviewConnection } from '@/components/live/SendPreview';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { useLive } from '@/lib/live/store';
import { supabaseBrowser } from '@/lib/supabase';

/** Each person sets their own password here, so a starter password is only ever used once. */
export default function AccountPage() {
  const { profile } = useLive();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [connected, setConnected] = usePreviewConnection();
  const [asking, setAsking] = useState(false);
  const tooShort = pw.length > 0 && pw.length < 10;
  const mismatch = again.length > 0 && pw !== again;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true);
    setMessage(null);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: `The password was not changed: ${error.message}` });
    setPw('');
    setAgain('');
    setMessage({ ok: true, text: 'Your password is changed. Use the new one next time you sign in.' });
  }

  return (
    <>
      <PageHeader title="Your account" sub={profile ? `Signed in as ${profile.email}.` : undefined} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title="Change your password">
        <form onSubmit={submit} className="space-y-3 p-4">
          <p className="text-sm text-ink-soft">If someone gave you a password to get started, replace it here with one only you know. Use at least 10 characters.</p>
          <div>
            <label htmlFor="acc-pw" className="label">New password</label>
            <input id="acc-pw" type="password" className="field" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            {tooShort && <p className="mt-1 text-xs text-warn">At least 10 characters.</p>}
          </div>
          <div>
            <label htmlFor="acc-again" className="label">Type it again</label>
            <input id="acc-again" type="password" className="field" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            {mismatch && <p className="mt-1 text-xs text-warn">The two do not match yet.</p>}
          </div>
          {message && <p role="status" className={`text-sm ${message.ok ? 'text-good' : 'text-alert'}`}>{message.text}</p>}
          <button type="submit" className="btn-primary" disabled={busy || pw.length < 10 || pw !== again}>{busy ? 'Saving…' : 'Change password'}</button>
        </form>
      </Panel>

      <Panel>
        <div className="space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">Email from the hub <PreviewTag /></h2>
          <p className="rounded-md border-2 border-dashed border-warn bg-warn-light/40 p-2 text-xs text-ink">
            This part is a preview. It shows how connecting your Gmail will work so you can tell us what you think. <strong>It does not connect to anything, and no email is sent or read.</strong>
          </p>

          {!connected && !asking && (
            <>
              <p className="text-sm text-ink-soft">Connect once, and follow-up emails can be sent from the hub as you, from your own C127 address. They appear in your Gmail Sent folder, and a copy is kept on the person&rsquo;s record.</p>
              <button className="btn-primary" onClick={() => setAsking(true)}>Connect my Gmail</button>
            </>
          )}

          {asking && (
            <div className="rounded-md border border-line p-3 text-sm">
              <p className="font-semibold">Google would ask you this:</p>
              <p className="mt-1 text-ink-soft">&ldquo;C127 Hub wants to access your Google Account {profile?.email}&rdquo;</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Send email on your behalf</li>
                <li>Read replies to the emails it sent for you</li>
              </ul>
              <p className="mt-2 text-xs text-ink-soft">It would not be able to read the rest of your inbox, delete anything, or change your settings.</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={() => { setConnected(true); setAsking(false); }}>Allow (preview)</button>
                <button className="btn-ghost" onClick={() => setAsking(false)}>Cancel</button>
              </div>
            </div>
          )}

          {connected && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3 text-sm">
                <span><Badge tone="good">Connected</Badge> <span className="ml-1">{profile?.email}</span> <span className="text-xs text-ink-soft">(pretend, on this computer only)</span></span>
                <button className="text-xs font-semibold text-ink-soft underline" onClick={() => setConnected(false)}>Disconnect</button>
              </div>
              <p className="text-sm text-ink-soft">Now open any follow-up under Experience follow-up and try &ldquo;Send from the hub&rdquo;.</p>
            </>
          )}

          <div className="border-t border-line pt-3">
            <h3 className="text-sm font-bold">What it would and would not do</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              <li>Send only when you press Send. Nothing goes out on its own.</li>
              <li>Read only the conversations the hub started for you, so a guest&rsquo;s reply lands on their record.</li>
              <li>Show what was sent to the rest of the C127 team, the same as the contact log today.</li>
            </ul>
          </div>

          <div className="border-t border-line pt-3">
            <h3 className="flex items-center gap-2 text-sm font-bold">Adding other emails to the hub <PreviewTag /></h3>
            <p className="mt-1 text-sm text-ink-soft">For a conversation that started in Gmail, not here, there are two ways it could work. Neither is built yet.</p>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="rounded-md border border-line p-3">
                <span className="font-semibold">A label in Gmail.</span> You tag a conversation &ldquo;Add to C127 Hub&rdquo; the way you would file it in a folder. Within a few minutes it shows on that person&rsquo;s record.
              </li>
              <li className="rounded-md border border-line p-3">
                <span className="font-semibold">A button in Gmail.</span> A small C127 panel beside your email shows who the person is in the hub, with an &ldquo;Add to their record&rdquo; button. Nicer to use, and more to build and look after.
              </li>
            </ul>
          </div>
        </div>
      </Panel>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { PageHeader, Panel } from '@/components/ui';
import { useLive } from '@/lib/live/store';
import { supabaseBrowser } from '@/lib/supabase';

/** Each person sets their own password here, so a starter password is only ever used once. */
export default function AccountPage() {
  const { profile } = useLive();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
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
      <Panel title="Change your password" className="max-w-md">
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
    </>
  );
}

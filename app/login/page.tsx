'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next && next.startsWith('/') ? next : '/';
    } else {
      setError('That password did not match. Check it and try again.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/c127-logo-white.png" alt="Commission 127" className="mx-auto mb-8 w-56" />
        <form onSubmit={submit} className="rounded-lg bg-white p-6 shadow-xl">
          <h1 className="font-display text-3xl tracking-wide text-ink">C127 Hub</h1>
          <p className="mt-1 text-sm text-ink-soft">Families, churches, coaches and follow-up in one place. This is a demo with sample data.</p>
          <label htmlFor="password" className="label mt-5">Password</label>
          <input id="password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="field" autoComplete="current-password" />
          {error && <p role="alert" className="mt-2 text-sm text-alert">{error}</p>}
          <button type="submit" disabled={busy || !password} className="btn-primary mt-4 w-full font-display text-lg tracking-wider">
            {busy ? 'Opening…' : 'Open the hub'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-white/50">Because kids belong in families.</p>
      </div>
    </main>
  );
}

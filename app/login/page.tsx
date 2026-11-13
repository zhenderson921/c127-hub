'use client';

import { useState } from 'react';
import { hasSupabase, supabaseBrowser } from '@/lib/supabase';

function goNext() {
  const next = new URLSearchParams(window.location.search).get('next');
  window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [demoPw, setDemoPw] = useState('');
  const [error, setError] = useState('');
  const [demoError, setDemoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(!hasSupabase);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true);
    setError('');
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (err) {
      setError('That email and password did not match. Check them and try again.');
      setBusy(false);
      return;
    }
    // A personal sign-in always wins over an old demo session.
    await fetch('/api/logout', { method: 'POST' });
    goNext();
  }

  async function openDemo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDemoError('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: demoPw }) });
    if (res.ok) {
      await supabaseBrowser()?.auth.signOut();
      goNext();
    } else {
      setDemoError('That password did not match. Check it and try again.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/c127-logo-white.png" alt="Commission 127" className="mx-auto mb-8 w-56" />

        {hasSupabase && (
          <form onSubmit={signIn} className="rounded-lg bg-white p-6 shadow-xl">
            <h1 className="font-display text-3xl tracking-wide text-ink">C127 Hub</h1>
            <p className="mt-1 text-sm text-ink-soft">Sign in with your own account to work with C127&rsquo;s records.</p>
            <label htmlFor="email" className="label mt-5">Email</label>
            <input id="email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="username" />
            <label htmlFor="pw" className="label mt-3">Password</label>
            <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="field" autoComplete="current-password" />
            {error && <p role="alert" className="mt-2 text-sm text-alert">{error}</p>}
            <button type="submit" disabled={busy || !email || !pw} className="btn-primary mt-4 w-full font-display text-lg tracking-wider">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {showDemo ? (
          <form onSubmit={openDemo} className={`rounded-lg bg-white p-6 shadow-xl ${hasSupabase ? 'mt-4' : ''}`}>
            <h2 className="font-display text-2xl tracking-wide text-ink">{hasSupabase ? 'Demo' : 'C127 Hub'}</h2>
            <p className="mt-1 text-sm text-ink-soft">Explore the hub with invented sample data. Nothing you do here touches real records.</p>
            <label htmlFor="password" className="label mt-4">Demo password</label>
            <input id="password" type="password" value={demoPw} onChange={(e) => setDemoPw(e.target.value)} className="field" autoComplete="off" />
            {demoError && <p role="alert" className="mt-2 text-sm text-alert">{demoError}</p>}
            <button type="submit" disabled={busy || !demoPw} className="btn-ghost mt-4 w-full font-display text-lg tracking-wider">
              {busy ? 'Opening…' : 'Open the demo'}
            </button>
          </form>
        ) : (
          <button onClick={() => setShowDemo(true)} className="mt-4 w-full text-center text-sm text-white/60 underline hover:text-white">
            Open the demo with sample data
          </button>
        )}
        <p className="mt-6 text-center text-xs text-white/50">Because kids belong in families.</p>
      </div>
    </main>
  );
}

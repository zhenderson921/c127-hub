'use client';

import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { Badge, PageHeader, Panel } from '@/components/ui';
import { useLive } from '@/lib/live/store';
import { SUPABASE_KEY, SUPABASE_URL, supabaseBrowser } from '@/lib/supabase';
import { fmtDateLong } from '@/lib/util';

// Who can sign in to the hub. Only admins see this page, and the database
// refuses these changes from anyone else.

interface User {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'coach' | 'advocate';
  isAdmin: boolean;
  added: string;
}
const ROLE_LABEL = { staff: 'Staff', coach: 'Coach', advocate: 'Church advocate' } as const;

export default function UsersPage() {
  const { profile } = useLive();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' as 'staff' | 'coach', admin: false });

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { data, error: err } = await sb.from('profiles').select('id, full_name, email, role, is_admin, created_at').order('created_at');
    if (err) return setError(`Could not load the users: ${err.message}`);
    setUsers((data ?? []).map((r) => ({ id: r.id, name: r.full_name ?? '', email: r.email ?? '', role: r.role, isAdmin: r.is_admin, added: r.created_at })));
  }, []);
  useEffect(() => {
    if (profile?.isAdmin) load();
  }, [profile, load]);

  if (!profile?.isAdmin) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-white p-6 text-center">
        <h1 className="font-display text-3xl tracking-wide">Admins only</h1>
        <p className="mt-2 text-sm text-ink-soft">Adding people to the hub is limited to admins. Ask an admin if someone needs access.</p>
      </div>
    );
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true);
    setError('');
    setNotice('');
    const email = form.email.trim().toLowerCase();
    // Create the sign-in with a separate, throwaway connection so the admin stays signed in as themselves.
    const fresh = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: made, error: signUpError } = await fresh.auth.signUp({ email, password: form.password });
    // Someone who already has a sign-in (added earlier, or in the dashboard) just needs access.
    const exists = !!signUpError && /already/i.test(signUpError.message);
    const alreadyThere = exists || (!!made.user && (made.user.identities?.length ?? 0) === 0);
    if (signUpError && !exists) {
      setBusy(false);
      return setError(/signup/i.test(signUpError.message) ? 'New sign-ins are switched off in Supabase, so the hub cannot create one. Add the person in the Supabase dashboard, then add them here to give them access.' : `The sign-in was not created: ${signUpError.message}`);
    }
    const { error: grantError } = await sb.rpc('admin_grant_access', { user_email: email, name: form.name, new_role: form.role, make_admin: form.admin });
    setBusy(false);
    if (grantError) return setError(`Access was not given: ${grantError.message}`);
    setNotice(alreadyThere ? `${email} already had a sign-in, so their password was left as it is. They now have access.` : `${email} can sign in now. Give them the starter password yourself, and ask them to change it under "Change password".`);
    setForm({ name: '', email: '', password: '', role: 'staff', admin: false });
    load();
  }

  async function change(u: User, patch: { role?: User['role']; is_admin?: boolean }) {
    const sb = supabaseBrowser();
    if (!sb) return;
    setError('');
    setNotice('');
    const { error: err } = await sb.from('profiles').update(patch).eq('id', u.id);
    if (err) setError(`That change was not saved: ${err.message}`);
    load();
  }

  async function remove(u: User) {
    if (!window.confirm(`Remove ${u.name || u.email}'s access to the hub? They will still be able to sign in, but will see nothing.`)) return;
    const sb = supabaseBrowser();
    if (!sb) return;
    setError('');
    setNotice('');
    const { error: err } = await sb.from('profiles').delete().eq('id', u.id);
    if (err) setError(`Access was not removed: ${err.message}`);
    else setNotice(`${u.name || u.email} no longer has access.`);
    load();
  }

  return (
    <>
      <PageHeader title="Users" sub="The people who can sign in to the hub. Staff and coaches see and change everything. Admins can also add and remove people here." />
      {error && <div role="alert" className="mb-4 rounded-md border border-alert/20 bg-alert-light px-4 py-2 text-sm text-alert">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-md border border-brand/20 bg-brand-light px-4 py-2 text-sm text-brand-deep">{notice}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-paper">
                <tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Admin</th><th className="th">Added</th><th className="th"><span className="sr-only">Remove</span></th></tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const me = u.id === profile.id;
                  return (
                    <tr key={u.id} className="border-b border-line last:border-0">
                      <td className="td font-semibold">{u.name || <span className="font-normal text-ink-faint">No name</span>}{me && <span className="ml-2"><Badge tone="brand">You</Badge></span>}</td>
                      <td className="td">{u.email}</td>
                      <td className="td">
                        {me || u.role === 'advocate' ? ROLE_LABEL[u.role] : (
                          <select aria-label={`Role for ${u.name || u.email}`} className="field w-auto py-1" value={u.role} onChange={(e) => change(u, { role: e.target.value as User['role'] })}>
                            <option value="staff">Staff</option><option value="coach">Coach</option>
                          </select>
                        )}
                      </td>
                      <td className="td">
                        <input type="checkbox" aria-label={`${u.name || u.email} is an admin`} checked={u.isAdmin} disabled={me || u.role === 'advocate'} onChange={(e) => change(u, { is_admin: e.target.checked })} />
                      </td>
                      <td className="td text-ink-soft">{fmtDateLong(new Date(u.added).getTime())}</td>
                      <td className="td text-right">{!me && <button className="text-xs text-ink-soft underline hover:text-alert" onClick={() => remove(u)}>Remove access</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2 text-xs text-ink-soft">You cannot change your own role or remove yourself, so the hub always has an admin. A forgotten password is reset in the Supabase dashboard for now.</p>
        </Panel>

        <Panel title="Add someone">
          <form onSubmit={addUser} className="space-y-3 p-4">
            <div><label htmlFor="nu-name" className="label">Full name</label><input id="nu-name" className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label htmlFor="nu-email" className="label">Email</label><input id="nu-email" type="email" className="field" required autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <label htmlFor="nu-pw" className="label">Starter password</label>
              <input id="nu-pw" type="text" className="field" required minLength={8} autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="mt-1 text-xs text-ink-soft">At least 8 characters. You pass it on to them, and they replace it under &ldquo;Change password&rdquo;. If they already have a sign-in, this is ignored.</p>
            </div>
            <div>
              <label htmlFor="nu-role" className="label">Role</label>
              <select id="nu-role" className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'staff' | 'coach' })}>
                <option value="staff">Staff</option><option value="coach">Coach</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.checked })} />
              Make them an admin, so they can add people too
            </label>
            <button type="submit" className="btn-primary w-full" disabled={busy || !form.name.trim() || !form.email.trim() || form.password.length < 8}>{busy ? 'Adding…' : 'Add this person'}</button>
          </form>
        </Panel>
      </div>
    </>
  );
}

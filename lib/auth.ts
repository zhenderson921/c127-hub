export const AUTH_COOKIE = 'c127_hub_auth';

export function sitePassword(): string {
  // Set SITE_PASSWORD in the host's environment to change it without a code change.
  return process.env.SITE_PASSWORD || 'truereligion';
}

/** The cookie holds a hash, never the password itself. */
export async function authToken(): Promise<string> {
  const bytes = new TextEncoder().encode(`c127-hub:${sitePassword()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

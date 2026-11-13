/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // The map runs in the browser, so the public Mapbox token is baked in at build time.
    // Either variable name works on the host.
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || '',
    // The Supabase project URL and publishable key are public by design; row level
    // security decides what a signed-in person can see. Set either variable on the
    // host to point at a different project.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wczlyobrtoywztqvqldd.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_RQ5wh0GoiIGHjdB_tQgk-g_AWeKZn6Y',
  },
};
export default nextConfig;

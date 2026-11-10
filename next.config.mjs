/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // The map runs in the browser, so the public Mapbox token is baked in at build time.
    // Either variable name works on the host.
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || '',
  },
};
export default nextConfig;

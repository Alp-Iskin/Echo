import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mostly a client-side app (localStorage + optional on-device AI), but we use
  // one server route — /api/echo — to proxy Gemini so the API key stays
  // server-side. Netlify's Next.js runtime handles this for free.
};

export default nextConfig;

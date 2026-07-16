import type { NextConfig } from "next";

/**
 * Next.js configuration.
 *
 * `reactStrictMode` surfaces side-effect bugs early in development.
 * `poweredByHeader: false` removes the X-Powered-By header (minor hardening).
 * PWA is implemented with the native `app/manifest.ts` + a hand-rolled service
 * worker registered client-side (see src/presentation/components/sw-registrar.tsx),
 * so no extra build plugin is required.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Route Handlers stream tutor replies; keep this here as we add features.
  },
};

export default nextConfig;

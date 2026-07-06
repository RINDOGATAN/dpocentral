import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // CSP is set per-request in middleware with nonces (see src/middleware.ts)
];

const nextConfig: NextConfig = {
  // Sovereign/self-hosted bundles (deploy/sovereign) build a standalone
  // server for Docker. Cloud (Vercel) builds leave this unset — same code,
  // posture switched by env only.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true"
    ? { output: "standalone" as const }
    : {}),
  serverExternalPackages: [
    "@dpocentral/premium-skills",
    "@dpocentral/security",
    "@react-pdf/renderer",
    // PDF flow-graph rendering: native binding (resvg) + WASM (graphviz) must
    // be loaded at runtime, not bundled into the serverless chunk by Turbopack.
    "@resvg/resvg-js",
    "@hpcc-js/wasm-graphviz",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

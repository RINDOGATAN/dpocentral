import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { buildCommit, lastMigrationInTree } from "./src/lib/build-info";

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
  // The server names no framework in its responses (X-Powered-By).
  poweredByHeader: false,
  // The Docker image (deploy/docker) builds a standalone server.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true"
    ? { output: "standalone" as const }
    : {}),
  // Read at build time for /api/health (src/lib/build-info.ts): the running
  // server has neither prisma/migrations nor .git to look at.
  env: {
    BUILD_LAST_MIGRATION: lastMigrationInTree(),
    BUILD_COMMIT: buildCommit(),
  },
  serverExternalPackages: [
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

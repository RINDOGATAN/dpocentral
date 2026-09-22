// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Browser smoke walk (e2e/smoke.spec.ts).
 *
 * Runs against a LOCAL production build (`npx next build`) served by
 * `next start`, with a seeded local database and the self-hosted posture's
 * local sign-in (NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true at build time). Never
 * point it at the hosted service or its database.
 *
 *   npx next build && npx playwright test
 *
 * SMOKE_PORT (default 3101) picks the port; a server already listening there
 * is reused locally, never in CI.
 */

import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.SMOKE_PORT || 3101);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "phone-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: `npx next start --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

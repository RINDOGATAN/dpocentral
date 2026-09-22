// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Test-only error-boundary probe. With E2E_FAILURE_PROBE=true (the smoke
 * walk; never a real deployment) this page fails to render, so the walk can
 * check what a person sees; otherwise it does not exist (404).
 */

import { notFound } from "next/navigation";
import { failureProbeEnabled, PROBE_FAILURE_TEXT } from "@/lib/failure-probe";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default function ErrorBoundaryProbe() {
  if (!failureProbeEnabled()) notFound();
  throw new Error(PROBE_FAILURE_TEXT);
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";

// WORKSPACE_PASSPHRASE is a runtime (server-only) env var set by the suite
// installer; the sign-in page asks this endpoint whether to show the
// passphrase field. Must never be cached at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const passphraseRequired =
    (process.env.WORKSPACE_PASSPHRASE ?? "").trim().length > 0;
  return NextResponse.json({ passphraseRequired });
}

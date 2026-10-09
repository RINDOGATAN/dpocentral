// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isDsarModuleEnabled } from "@/config/features";

/**
 * The public request form (/dsar/<slug>) and status page (/dsar/status/<token>).
 * Not found when the rights-request module is not part of this plan
 * (NEXT_PUBLIC_DSAR_ENABLED=false). src/middleware.ts already answers these
 * addresses 404; this is the second lock.
 */
export default function PublicDsarLayout({ children }: { children: ReactNode }) {
  if (!isDsarModuleEnabled()) notFound();
  return <>{children}</>;
}

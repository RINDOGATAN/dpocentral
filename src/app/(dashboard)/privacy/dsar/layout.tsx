// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { ReactNode } from "react";
import { isDsarModuleEnabled } from "@/config/features";
import { DsarModuleOffDashboardNote } from "@/components/privacy/dsar-module-off-note";

/**
 * Every dashboard page of the rights-request module (/privacy/dsar/*). When
 * the module is not part of this plan (NEXT_PUBLIC_DSAR_ENABLED=false), the
 * pages are replaced by a short note, and none of their queries run.
 */
export default function DsarModuleLayout({ children }: { children: ReactNode }) {
  if (!isDsarModuleEnabled()) return <DsarModuleOffDashboardNote />;
  return <>{children}</>;
}

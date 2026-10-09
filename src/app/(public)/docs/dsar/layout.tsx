// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { ReactNode } from "react";
import { isDsarModuleEnabled } from "@/config/features";
import { DsarModuleOffNote } from "@/components/privacy/dsar-module-off-note";

/**
 * The public documentation of the rights-request module. Replaced by a short
 * note when the module is not part of this plan (NEXT_PUBLIC_DSAR_ENABLED=false).
 */
export default function PublicDsarDocsLayout({ children }: { children: ReactNode }) {
  if (!isDsarModuleEnabled()) return <DsarModuleOffNote />;
  return <>{children}</>;
}

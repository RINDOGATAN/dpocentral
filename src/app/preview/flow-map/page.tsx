// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { notFound } from "next/navigation";
import { FlowMapPreview } from "./flow-map-client";

// Dev-only design preview with mock data. Hidden in production builds unless
// explicitly enabled — internal previews must never ship on customer installs.
export default function FlowMapPreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_PREVIEW_ROUTES !== "true"
  ) {
    notFound();
  }

  return <FlowMapPreview />;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { isHostedDeployment } from "@/lib/hosted";
import { HostedPilotBanner, HostedPilotProvider } from "./hosted-pilot";

/**
 * Server wrapper for the root layout: tells client components whether this is
 * the hosted pilot and, if so, shows the pilot banner. Renders nothing extra
 * on the self-hosted kit.
 */
export function PilotShell({ children }: { children: React.ReactNode }) {
  const hosted = isHostedDeployment();
  return (
    <HostedPilotProvider hosted={hosted}>
      {children}
      {hosted && <HostedPilotBanner />}
    </HostedPilotProvider>
  );
}

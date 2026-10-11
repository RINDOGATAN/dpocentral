// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { isHostedDeployment } from "@/lib/hosted";
import { HostedPilotEndBar, HostedPilotProvider } from "./hosted-pilot";

/**
 * Server wrapper for the root layout: tells client components whether this is
 * the hosted pilot. It renders no bar: the public pages (landing, docs,
 * sign-in) carry none, and reserve no space for one.
 */
export function PilotShell({ children }: { children: React.ReactNode }) {
  return <HostedPilotProvider hosted={isHostedDeployment()}>{children}</HostedPilotProvider>;
}

/**
 * The pilot bar, for the signed-in application only (mounted at the
 * top of the dashboard layout). Renders nothing on the self-hosted kit.
 */
export function SignedInPilotBanner() {
  return isHostedDeployment() ? <HostedPilotEndBar /> : null;
}

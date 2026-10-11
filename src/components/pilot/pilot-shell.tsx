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
 * Offers the move to the paid plan only when the automatic upgrade is
 * switched on and a payment link is set for the viewer's currency: the
 * dashboard layout works that out on the server from the request headers
 * (upgradeLinkFor in src/lib/plan-upgrade.ts) and passes `upgrade`. Neither
 * the secret nor the link reaches the browser.
 */
export function SignedInPilotBanner({ upgrade = false }: { upgrade?: boolean }) {
  return isHostedDeployment() ? <HostedPilotEndBar upgrade={upgrade} /> : null;
}

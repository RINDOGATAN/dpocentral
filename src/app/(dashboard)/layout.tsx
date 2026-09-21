// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { SignedInPilotBanner } from "@/components/pilot/pilot-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      {/* The pilot banner is shown only once a person is signed in */}
      <SignedInPilotBanner />
    </>
  );
}

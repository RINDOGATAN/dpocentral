"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useSession } from "next-auth/react";

export function useUserType() {
  const { data: session, status, update } = useSession();
  const isLoading = status === "loading";
  return {
    userType: session?.user?.userType ?? null,
    isBusinessOwner: session?.user?.userType === "BUSINESS_OWNER",
    isProfessional: session?.user?.userType === "PRIVACY_PROFESSIONAL",
    // Only trigger onboarding when session is loaded and userType is null
    needsOnboarding: !isLoading && status === "authenticated" && session?.user?.userType == null,
    isLoading,
    refreshSession: update,
  };
}

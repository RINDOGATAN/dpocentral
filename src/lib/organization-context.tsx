"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";

interface Organization {
  id: string;
  name: string;
  slug: string;
  /** Hosted plan: "PILOT" or "EU_CLOUD" (the paid plan lifts the pilot limits). */
  plan?: string;
  /** The signed-in person's role in it (OWNER, ADMIN, ...), as the list returns it. */
  role?: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  setOrganization: (org: Organization) => void;
  refetchOrganizations: () => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganizationState] = useState<Organization | null>(null);
  // The provider wraps every page, signed-in or not. Asking for the list
  // before there is a session only earns a 401 (and a console error) on the
  // landing page, the sign-in page and the public pages.
  // A session being read again (useSession's update, after a change of
  // account type) still counts as signed in: the pages stay on screen.
  const { data: session, status: sessionStatus } = useSession();
  const refreshing = sessionStatus === "loading" && !!session;
  const signedIn = sessionStatus === "authenticated" || refreshing;

  const { data: orgsData, isLoading: listLoading, refetch } = trpc.organization.list.useQuery(undefined, {
    retry: false,
    enabled: signedIn,
  });
  const isLoading = (sessionStatus === "loading" && !refreshing) || (signedIn && listLoading);

  const organizations = orgsData ?? [];

  useEffect(() => {
    // Auto-select first organization if none selected
    if (!organization && organizations.length > 0) {
      // Check localStorage for last used org
      const savedOrgId = localStorage.getItem("currentOrganizationId");
      const savedOrg = organizations.find((o) => o.id === savedOrgId);
      setOrganizationState(savedOrg ?? organizations[0]);
    }
  }, [organizations, organization]);

  const setOrganization = (org: Organization) => {
    setOrganizationState(org);
    localStorage.setItem("currentOrganizationId", org.id);
  };

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizations,
        isLoading,
        setOrganization,
        refetchOrganizations: refetch,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

/**
 * The selected organisation, or null outside an OrganizationProvider (a
 * component that can also render on its own, such as the pilot banner).
 */
export function useSelectedOrganizationOrNull(): Organization | null {
  return useContext(OrganizationContext)?.organization ?? null;
}

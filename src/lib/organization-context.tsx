"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers";

/** What organization.list returns: the shape the root layout can hand over. */
export type OrganizationList = inferRouterOutputs<AppRouter>["organization"]["list"];

interface Organization {
  id: string;
  name: string;
  slug: string;
  /** The organisation's plan column, as stored. */
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

export function OrganizationProvider({
  children,
  initialOrganizations = null,
}: {
  children: ReactNode;
  /**
   * The list as the server already read it for this request, so the first
   * render has it and the shell does not wait on a round trip. Null when
   * the server did not read it (signed out, or the read failed).
   */
  initialOrganizations?: OrganizationList | null;
}) {
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
    ...(initialOrganizations && signedIn ? { initialData: initialOrganizations } : {}),
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

  // Several screens select an organisation from what a mutation returned
  // (create, copy, switch), which carries no role and possibly an old plan.
  // The list is the server's answer for this person, so its role and plan win
  // once it holds the selected organisation, right after onboarding, not
  // only after a reload.
  const listed = organization ? organizations.find((o) => o.id === organization.id) : undefined;
  const selected: Organization | null =
    organization && listed
      ? { ...organization, plan: listed.plan ?? organization.plan, role: listed.role ?? organization.role }
      : organization;

  return (
    <OrganizationContext.Provider
      value={{
        organization: selected,
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
 * component that can also render on its own).
 */
export function useSelectedOrganizationOrNull(): Organization | null {
  return useContext(OrganizationContext)?.organization ?? null;
}

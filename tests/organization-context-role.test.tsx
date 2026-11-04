// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The selected organisation takes its role and plan from the organisation
 * list once the list holds it. Screens that select an organisation from a
 * mutation's result (onboarding, copy, switch) pass no role; without this,
 * actions that need an owner or admin stayed hidden after onboarding until the
 * page was reloaded.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

const list = vi.hoisted(() => ({
  data: [] as Array<{ id: string; name: string; slug: string; plan?: string; role?: string }>,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, status: "authenticated" }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    organization: {
      list: {
        useQuery: () => ({ data: list.data, isLoading: false, refetch: () => {} }),
      },
    },
  },
}));

import { OrganizationProvider, useOrganization } from "@/lib/organization-context";

const handle: { select: ((org: { id: string; name: string; slug: string }) => void) | null } = { select: null };

function Probe() {
  const { organization, setOrganization } = useOrganization();
  useEffect(() => {
    handle.select = setOrganization;
  });
  return <p data-testid="selected">{organization ? `${organization.id}:${organization.role ?? "-"}:${organization.plan ?? "-"}` : "none"}</p>;
}

afterEach(() => {
  cleanup();
  handle.select = null;
  list.data = [];
  window.localStorage.clear();
});

describe("organization context: role and plan from the list", () => {
  it("fills the role and plan of an organisation selected from a mutation's result", () => {
    list.data = [{ id: "org1", name: "Harbour", slug: "harbour", plan: "PILOT", role: "OWNER" }];
    render(
      <OrganizationProvider>
        <Probe />
      </OrganizationProvider>
    );
    act(() => handle.select!({ id: "org1", name: "Harbour", slug: "harbour" }));
    expect(screen.getByTestId("selected").textContent).toBe("org1:OWNER:PILOT");
  });

  it("keeps the organisation as given while the list does not hold it yet", () => {
    list.data = [{ id: "other", name: "Other", slug: "other", plan: "PILOT", role: "MEMBER" }];
    render(
      <OrganizationProvider>
        <Probe />
      </OrganizationProvider>
    );
    act(() => handle.select!({ id: "org2", name: "New", slug: "new" }));
    expect(screen.getByTestId("selected").textContent).toBe("org2:-:-");
  });
});

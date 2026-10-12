// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Screens offer only what the person's role may do, mirroring the server's
 * procedures, and a vendor website without a scheme never breaks a page.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { abilitiesFor } from "@/lib/use-org-role";
import { websiteHost, websiteHref } from "@/lib/website";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("abilitiesFor", () => {
  it("mirrors writer, officer and admin procedures", () => {
    expect(abilitiesFor("VIEWER")).toMatchObject({ canWrite: false, isOfficer: false, isAdmin: false });
    expect(abilitiesFor("MEMBER")).toMatchObject({ canWrite: true, isOfficer: false, isAdmin: false });
    expect(abilitiesFor("PRIVACY_OFFICER")).toMatchObject({ canWrite: true, isOfficer: true, isAdmin: false });
    expect(abilitiesFor("ADMIN")).toMatchObject({ canWrite: true, isOfficer: true, isAdmin: true });
    expect(abilitiesFor("OWNER")).toMatchObject({ canWrite: true, isOfficer: true, isAdmin: true });
  });
  it("shows everything while the role is not known yet", () => {
    expect(abilitiesFor(undefined)).toMatchObject({ canWrite: true, isOfficer: true, isAdmin: true });
  });
  it("matches the server's role lists", () => {
    const trpc = src("src/server/trpc.ts");
    expect(trpc).toContain('withOrganizationAndRole("OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER")');
    expect(trpc).toContain('withOrganizationAndRole("OWNER", "ADMIN", "PRIVACY_OFFICER")');
    expect(trpc).toContain('withOrganizationAndRole("OWNER", "ADMIN")');
  });
});

describe("screens gate their actions", () => {
  const cases: Array<[string, string[]]> = [
    ["src/app/(dashboard)/privacy/data-inventory/page.tsx", ["canWrite && ("]],
    ["src/app/(dashboard)/privacy/data-inventory/[id]/page.tsx", ["canWrite && (", "isAdmin && ("]],
    ["src/app/(dashboard)/privacy/vendors/page.tsx", ["canWrite && ("]],
    ["src/app/(dashboard)/privacy/vendors/[id]/page.tsx", ["canWrite && (", "isAdmin && ("]],
    ["src/app/(dashboard)/privacy/incidents/page.tsx", ["isOfficer && ("]],
    ["src/app/(dashboard)/privacy/incidents/[id]/page.tsx", ["isOfficer && ("]],
    ["src/app/(dashboard)/privacy/assessments/page.tsx", ["canWrite && ("]],
    ["src/components/privacy/data-flow/DataFlowVisualization.tsx", ["canWrite && (", "isAdmin ? handleDeleteFlow : undefined"]],
  ];
  for (const [file, needles] of cases) {
    it(file, () => {
      const s = src(file);
      expect(s).toContain("useOrgRole()");
      for (const n of needles) expect(s).toContain(n);
    });
  }
});

describe("vendor website", () => {
  it("adds a scheme for the link and never throws", () => {
    expect(websiteHref("acme.com")).toBe("https://acme.com");
    expect(websiteHref("https://acme.com/x")).toBe("https://acme.com/x");
    expect(websiteHost("acme.com")).toBe("acme.com");
    expect(websiteHost("https://www.acme.com/privacy")).toBe("www.acme.com");
    expect(websiteHost("not a url at all")).toBe("not a url at all");
    expect(websiteHref("javascript:alert(1)")).toBe("https://javascript:alert(1)");
  });
});

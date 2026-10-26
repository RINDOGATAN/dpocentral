// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The roles documentation (public /docs and in-app /privacy/docs) comes from one
 * component and one message block, so the two pages cannot disagree, and its
 * statements match the code they describe.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ROLE_PERMISSION_COLUMNS,
  ROLE_PERMISSION_LIMITS,
  ROLE_PERMISSION_ROLES,
} from "@/components/docs/role-permissions";
import { REVIEWER_ROLES } from "@/lib/assessment-workflow";
import { AUDIT_READER_ROLES } from "@/lib/audit-access";
import { PORTABILITY_ROLES } from "@/server/services/portability/access";

const read = (p: string) => readFileSync(p, "utf8");
const messages = (lang: "en" | "es") => JSON.parse(read(`src/messages/${lang}.json`)).docs.roleAccess;

describe("roles documentation", () => {
  it("both docs pages render the same component", () => {
    for (const page of ["src/app/(public)/docs/page.tsx", "src/app/(dashboard)/privacy/docs/page.tsx"]) {
      expect(read(page)).toContain("<RolePermissions />");
    }
  });

  it("has every cell, paragraph and limit in English and Spanish, without long dashes", () => {
    for (const lang of ["en", "es"] as const) {
      const m = messages(lang);
      for (const role of ROLE_PERMISSION_ROLES) {
        for (const col of ROLE_PERMISSION_COLUMNS) expect(m.rows[role][col], `${lang} ${role} ${col}`).toBeTruthy();
      }
      for (const k of ROLE_PERMISSION_LIMITS) expect(m.limits.items[k]).toBeTruthy();
      expect(m.departments.body).toBeTruthy();
      expect(m.approvals.body).toBeTruthy();
      expect(JSON.stringify(m)).not.toMatch(/—|–/);
    }
  });

  it("matches the role rules in the code", () => {
    expect([...REVIEWER_ROLES]).toEqual(["OWNER", "ADMIN", "PRIVACY_OFFICER"]);
    expect([...AUDIT_READER_ROLES]).toEqual(["OWNER", "ADMIN", "PRIVACY_OFFICER"]);
    expect([...PORTABILITY_ROLES]).toEqual(["OWNER", "ADMIN"]);
    const en = messages("en");
    for (const role of ["MEMBER", "VIEWER"] as const) expect(en.rows[role].approves).toBe("No");
    expect(en.rows.ADMIN.deletesOrg).toBe("No");
    expect(en.rows.OWNER.deletesOrg).toBe("Yes");
    expect(read("src/server/routers/privacy/organizationDeletion.ts")).toContain("ownerOrgProcedure");
  });
});

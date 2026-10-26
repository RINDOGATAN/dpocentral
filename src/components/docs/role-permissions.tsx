// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getTranslations } from "next-intl/server";

/**
 * What each role can do, shared by the public documentation (/docs) and the
 * in-app help (/privacy/docs) so the two never disagree. The wording follows
 * the code:
 *   - role gates: src/server/trpc.ts (writer, officer, admin, owner);
 *   - approvals: src/lib/assessment-workflow.ts (REVIEWER_ROLES) and the
 *     assessment router (requestApproval, processApproval, submitAndApprove);
 *   - rights requests: src/lib/dsar-access.ts;
 *   - activity log: src/lib/audit-access.ts;
 *   - full programme export: src/server/services/portability/access.ts;
 *   - members and roles: src/server/routers/privacy/organization.ts;
 *   - departments: src/server/services/business-units/scope.ts;
 *   - deleting the organisation: src/server/routers/privacy/organizationDeletion.ts.
 * Change the text here when one of those changes.
 */

export const ROLE_PERMISSION_ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;
export const ROLE_PERMISSION_COLUMNS = ["sees", "edits", "approves", "exports", "manages", "deletesOrg"] as const;
export const ROLE_PERMISSION_LIMITS = ["auditLog", "fullExport", "owners", "deleteOrg", "viewers"] as const;

export async function RolePermissions() {
  const t = await getTranslations("docs.roleAccess");
  const tRole = await getTranslations("enums.role");

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[56rem]">
          <thead>
            <tr className="bg-muted/50">
              <th scope="col" className="text-left font-medium px-3 py-2">{t("columns.role")}</th>
              {ROLE_PERMISSION_COLUMNS.map((c) => (
                <th key={c} scope="col" className="text-left font-medium px-3 py-2">{t(`columns.${c}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_PERMISSION_ROLES.map((role, i) => (
              <tr key={role} className={`align-top ${i % 2 ? "bg-muted/20" : ""}`}>
                <th scope="row" className="text-left font-semibold px-3 py-2 whitespace-nowrap">{tRole(role)}</th>
                {ROLE_PERMISSION_COLUMNS.map((c) => (
                  <td key={c} className="px-3 py-2 text-muted-foreground">{t(`rows.${role}.${c}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{t("departments.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("departments.body")}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{t("approvals.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("approvals.body")}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">{t("limits.title")}</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {ROLE_PERMISSION_LIMITS.map((k) => (
            <li key={k}>{t(`limits.items.${k}`)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

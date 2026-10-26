// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Publishing the public rights-request form is a deliberate act.
 *
 * New organisations get the intake form seeded inactive
 * (src/server/services/dsar/defaultIntakeForm.ts): the public page shows the
 * organisation's privacy contact until a person switches the form on in the
 * rights-request settings. Switching it on or off writes one audit entry
 * (who and when, from the entry's own user and date; no personal data).
 *
 * Organisations opened before this change kept their active form. For them
 * "Confirm and publish" records the activation without changing the form.
 *
 * The guided path reads the latest of these entries (path-counts.ts): an
 * active form with a recorded activation meets step 4.1.
 */

export const DSAR_INTAKE_ACTIVATED = "DSAR_INTAKE_ACTIVATED";
export const DSAR_INTAKE_DEACTIVATED = "DSAR_INTAKE_DEACTIVATED";
export const DSAR_INTAKE_ACTIONS = [DSAR_INTAKE_ACTIVATED, DSAR_INTAKE_DEACTIVATED] as const;

export type IntakeActivation = "activated" | "deactivated" | null;

type AuditReader = {
  auditLog: {
    findFirst(args: {
      where: { organizationId: string; action: { in: string[] } };
      orderBy: { createdAt: "desc" };
      select: { action: true };
    }): Promise<{ action: string } | null>;
  };
};

/** The latest recorded activation or deactivation of the public form, if any. */
export async function latestIntakeActivation(db: AuditReader, organizationId: string): Promise<IntakeActivation> {
  const row = await db.auditLog.findFirst({
    where: { organizationId, action: { in: [...DSAR_INTAKE_ACTIONS] } },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  if (!row) return null;
  return row.action === DSAR_INTAKE_ACTIVATED ? "activated" : "deactivated";
}

/**
 * Whether a change of the form's active flag (or a confirmation) is to be
 * recorded: a change always is; switching on a form that is already on is
 * recorded only while no activation has been recorded yet ("Confirm and
 * publish"), so repeating it writes nothing.
 */
export function activationToRecord(
  wasActive: boolean,
  active: boolean,
  latest: IntakeActivation
): typeof DSAR_INTAKE_ACTIVATED | typeof DSAR_INTAKE_DEACTIVATED | null {
  if (active !== wasActive) return active ? DSAR_INTAKE_ACTIVATED : DSAR_INTAKE_DEACTIVATED;
  if (active && latest !== "activated") return DSAR_INTAKE_ACTIVATED;
  return null;
}

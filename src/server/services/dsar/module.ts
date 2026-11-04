// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request (DSAR) module, per organisation.
 *
 * In the community edition the module is open and never limited: the public
 * form takes every request, and closed requests keep their personal data for
 * the number of days set on the intake form (1 to 3650, default 90).
 *
 * Each public-form request writes one organisation audit-log entry (action
 * DSAR_PUBLIC_SUBMISSION, no personal data), which survives the request's
 * deletion or redaction.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

/** The organisation audit-log action of a request received through the public form. */
export const DSAR_PUBLIC_SUBMISSION = "DSAR_PUBLIC_SUBMISSION";

// ── Messages (English at the throw site; the formatter localises them) ──

export const DSAR_MODULE_MESSAGES = {
  /** The public form is not taking requests. */
  formClosed: "This form is not taking requests at the moment. Please contact the organization directly.",
} as const;

/** Retention after closing: the form's setting (1 to 3650 days, default 90). */
export function effectiveRetentionDays(formRetentionDays: number | null | undefined): number {
  return formRetentionDays ?? 90;
}

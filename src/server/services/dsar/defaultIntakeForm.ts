// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { DSARType } from "@prisma/client";
import type prisma from "@/lib/prisma";
import { DEFAULT_INTAKE_TEXT } from "@/lib/dsar-default-intake";

type PrismaLike = typeof prisma;

export const DEFAULT_INTAKE_FORM = {
  name: "DSAR Intake Form",
  slug: "request",
  title: DEFAULT_INTAKE_TEXT.title,
  description: DEFAULT_INTAKE_TEXT.description,
  fields: [],
  // The six GDPR rights (Articles 15 to 18, 20 and 21). The US-only request
  // types are chosen by the organisation in the settings.
  enabledTypes: [
    DSARType.ACCESS,
    DSARType.RECTIFICATION,
    DSARType.ERASURE,
    DSARType.RESTRICTION,
    DSARType.PORTABILITY,
    DSARType.OBJECTION,
  ],
  thankYouMessage: DEFAULT_INTAKE_TEXT.thankYouMessage,
  // Seeded off: publishing the public form is a person's deliberate act in
  // the settings (src/server/services/dsar/intake-activation.ts). While off,
  // the public page shows the organisation's privacy contact.
  isActive: false,
} as const;

/** The intake-form fields that tell an auto-seeded default from a set-up form. */
export interface IntakeFormShape {
  slug: string;
  title: string;
  description: string | null;
  thankYouMessage: string | null;
  privacyNoticeUrl: string | null;
  customCss: string | null;
  fields: unknown;
}

/**
 * Whether the org has actually set up its DSAR intake, as opposed to only
 * carrying the form we auto-seed at org creation (ensureDefaultIntakeForm).
 *
 * The seeded default is pristine: the fixed slug/title/description/thank-you,
 * no privacy-notice link, no custom CSS, no custom fields. Any change a person
 * makes on the DSAR settings page (a different public title or description,
 * their privacy-notice URL, custom fields or CSS) marks the intake as set up.
 * A brand-new organisation that has touched nothing reads as not set up, so
 * the rights step stays "not started" until there is a request or real setup.
 */
export function isIntakeConfigured(form: IntakeFormShape): boolean {
  const d = DEFAULT_INTAKE_FORM;
  if (form.slug !== d.slug) return true;
  if (form.title !== d.title) return true;
  if ((form.description ?? "") !== d.description) return true;
  if ((form.thankYouMessage ?? "") !== d.thankYouMessage) return true;
  if (form.privacyNoticeUrl && form.privacyNoticeUrl.length > 0) return true;
  if (form.customCss && form.customCss.length > 0) return true;
  if (Array.isArray(form.fields) && form.fields.length > 0) return true;
  return false;
}

/**
 * Idempotent: creates a default intake form for the org if none exists,
 * switched off until a person publishes it.
 * Returns the existing or newly-created form id.
 */
export async function ensureDefaultIntakeForm(
  prisma: PrismaLike,
  organizationId: string
): Promise<{ created: boolean; id: string }> {
  const existing = await prisma.dSARIntakeForm.findFirst({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) {
    return { created: false, id: existing.id };
  }

  const created = await prisma.dSARIntakeForm.create({
    data: {
      organizationId,
      name: DEFAULT_INTAKE_FORM.name,
      slug: DEFAULT_INTAKE_FORM.slug,
      title: DEFAULT_INTAKE_FORM.title,
      description: DEFAULT_INTAKE_FORM.description,
      fields: DEFAULT_INTAKE_FORM.fields,
      enabledTypes: [...DEFAULT_INTAKE_FORM.enabledTypes],
      thankYouMessage: DEFAULT_INTAKE_FORM.thankYouMessage,
      isActive: DEFAULT_INTAKE_FORM.isActive,
    },
    select: { id: true },
  });
  return { created: true, id: created.id };
}

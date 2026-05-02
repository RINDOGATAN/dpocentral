import { DSARType } from "@prisma/client";
import type prisma from "@/lib/prisma";

type PrismaLike = typeof prisma;

export const DEFAULT_INTAKE_FORM = {
  name: "DSAR Intake Form",
  slug: "request",
  title: "Data Subject Request",
  description: "Submit a request regarding your personal data",
  fields: [],
  enabledTypes: [
    DSARType.ACCESS,
    DSARType.RECTIFICATION,
    DSARType.ERASURE,
    DSARType.PORTABILITY,
  ],
  thankYouMessage:
    "Thank you for your request. We will process it within the legally required timeframe.",
  isActive: true,
} as const;

/**
 * Idempotent: creates a default intake form for the org if none exists.
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

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Applies a catalogue transfer pack (src/config/catalogue-transfer-packs.ts)
 * when a customer adds the pack's vendor from the catalogue: from the
 * vendor form (vendor.create with metadata.catalogSlug) or the quick start's
 * vendor import.
 *
 * For the vendor just added, it fills the international transfer to the
 * pack's destination (reusing the one the quick start created for that
 * vendor, or creating it), records the supplementary measures and the
 * Schrems II checklist points the vendor's terms answer, and creates the
 * transfer impact assessment on the system TIA template, PENDING_APPROVAL,
 * with an approval request to the organisation's owner (or, failing an
 * owner, an administrator or privacy officer). Nothing is approved on the
 * customer's behalf, and the transfer's verdict is left PENDING: the
 * customer confirms the vendor, checks the register entry and approves.
 *
 * Idempotent: an organisation that already holds a transfer from this pack
 * is left alone, so adding the vendor again never duplicates the work.
 * Applies on the hosted service and on the self-hosted kit: the vendor is
 * the customer's own. Every record carries metadata.source = the pack's
 * sourceRef; its texts are shown in the reader's language by
 * src/lib/system-content/ (./catalogue-transfer-content-pack.ts).
 */

import { ApprovalStatus, AssessmentStatus, AssessmentType, type Prisma } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import { ASSESSMENT_TEMPLATES_V2 } from "@/config/assessment-templates-v2";
import {
  transferPackFor,
  type CatalogueTransferPack,
  type PackLocale,
} from "@/config/catalogue-transfer-packs";
import { withChecklistAnswer } from "@/lib/transfer-checklist";
import { todoLawTiaApprover } from "@/server/services/todolaw-transfer-assessment";

/** Marker on the transfer and the assessment: the pack version that wrote them. */
export const PACK_MARKER = "catalogueTransferPack";

type TemplateQuestion = { id: string; type: string; options?: { en: string; es: string }[] };
type TemplateSection = { id: string; questions: TemplateQuestion[] };

const TIA_TEMPLATE = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA") as unknown as {
  sections: TemplateSection[];
};

function optionIn(question: TemplateQuestion, english: string, locale: PackLocale): string {
  const option = question.options?.find((o) => o.en === english);
  if (!option) throw new Error(`TIA option not in template: ${question.id} "${english}"`);
  return option[locale];
}

/** The answers the pack gives, one per question it answers: [sectionId, questionId, response]. */
export function packTiaResponses(
  pack: CatalogueTransferPack,
  locale: PackLocale,
  now: Date = new Date(),
): Array<{ sectionId: string; questionId: string; response: Prisma.InputJsonValue }> {
  const out: Array<{ sectionId: string; questionId: string; response: Prisma.InputJsonValue }> = [];
  const nextReview = new Date(now);
  nextReview.setUTCFullYear(nextReview.getUTCFullYear() + 1);
  for (const section of TIA_TEMPLATE.sections) {
    for (const q of section.questions) {
      const choice = pack.tia.choices[q.id];
      const text = pack.tia.text[locale][q.id];
      let response: Prisma.InputJsonValue | undefined;
      if (typeof choice === "boolean") response = choice;
      else if (Array.isArray(choice)) response = choice.map((c) => optionIn(q, c, locale));
      else if (typeof choice === "string") response = optionIn(q, choice, locale);
      else if (text) response = text;
      else if (q.id === "tiav2_5_2") response = nextReview.toISOString().slice(0, 10);
      if (response !== undefined) out.push({ sectionId: section.id, questionId: q.id, response });
    }
  }
  return out;
}

export type PackResult =
  | { applied: true; transferId: string; assessmentId: string | null }
  | { applied: false; reason: "no-pack" | "done" | "no-vendor" };

/**
 * Applies the pack for `slug` to the vendor just added. Never throws for a
 * missing pack; callers treat it as best effort.
 */
export async function applyCatalogueTransferPack(
  db: Db,
  args: { organizationId: string; vendorId: string; slug: string | null | undefined; locale: PackLocale; now?: Date },
): Promise<PackResult> {
  const pack = transferPackFor(args.slug);
  if (!pack) return { applied: false, reason: "no-pack" };
  const { organizationId, vendorId, locale } = args;
  const now = args.now ?? new Date();

  const vendor = await db.vendor.findFirst({ where: { id: vendorId, organizationId }, select: { id: true } });
  if (!vendor) return { applied: false, reason: "no-vendor" };

  const already = await db.dataTransfer.findFirst({
    where: { organizationId, metadata: { path: ["source"], equals: pack.sourceRef } },
    select: { id: true },
  });
  if (already) return { applied: false, reason: "done" };

  const t = pack.transfer;
  // The quick start may already have written a transfer for this vendor and
  // destination; reuse it unless the customer has started an assessment on it.
  const existing = await db.dataTransfer.findFirst({
    where: { organizationId, vendorId, destinationCountry: t.destinationCountry },
    select: { id: true, metadata: true, processingActivityId: true, _count: { select: { assessments: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (existing && existing._count.assessments > 0) return { applied: false, reason: "done" };

  const template = await db.assessmentTemplate.findFirst({
    where: { type: AssessmentType.TIA, isActive: true, supersededAt: null, isSystem: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let metadata: Record<string, unknown> = { ...((existing?.metadata ?? {}) as Record<string, unknown>) };
  for (const [itemId, answer] of Object.entries(pack.checklist)) {
    metadata = withChecklistAnswer(metadata, itemId, { state: answer.state, note: answer.note[locale], at: now.toISOString() });
  }
  metadata.source = pack.sourceRef;
  metadata[PACK_MARKER] = pack.version;
  const measures = Object.fromEntries(pack.supplementaryMeasures.map((m) => [m, true]));
  const transferData = {
    name: t.name[locale],
    description: t.description[locale],
    destinationOrg: t.destinationOrg,
    mechanism: t.mechanism,
    safeguards: t.safeguards[locale],
    documentUrl: t.documentUrl,
    adequacyScopeReference: t.adequacyScopeReference ?? null,
    supplementaryMeasures: measures,
    complianceStatus: "PENDING",
    metadata: metadata as Prisma.InputJsonValue,
  };

  const result = await db.$transaction(async (tx) => {
    const transferId = existing
      ? (await tx.dataTransfer.update({ where: { id: existing.id }, data: transferData, select: { id: true } })).id
      : (
          await tx.dataTransfer.create({
            data: { organizationId, vendorId, destinationCountry: t.destinationCountry, isActive: true, ...transferData },
            select: { id: true },
          })
        ).id;
    if (!template) return { transferId, assessmentId: null };

    const assessment = await tx.assessment.create({
      data: {
        organizationId,
        templateId: template.id,
        dataTransferId: transferId,
        processingActivityId: existing?.processingActivityId ?? undefined,
        name: pack.tia.title.name[locale],
        description: pack.tia.title.description[locale],
        status: AssessmentStatus.PENDING_APPROVAL,
        submittedAt: now,
        metadata: { source: pack.sourceRef, [PACK_MARKER]: pack.version, locale },
      },
      select: { id: true },
    });
    await tx.assessmentResponse.createMany({
      data: packTiaResponses(pack, locale, now).map((r) => ({ assessmentId: assessment.id, ...r })),
    });
    const approverId = await todoLawTiaApprover(tx as unknown as Parameters<typeof todoLawTiaApprover>[0], organizationId);
    if (approverId) {
      await tx.assessmentApproval.create({
        data: { assessmentId: assessment.id, approverId, level: 1, status: ApprovalStatus.PENDING },
      });
    }
    return { transferId, assessmentId: assessment.id };
  });
  return { applied: true, ...result };
}

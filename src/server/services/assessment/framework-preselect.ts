// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A new DPIA's first question (which frameworks it is measured against) is
 * answered from the jurisdictions the organisation declared, so a
 * California-only organisation is not measured against the EU framework
 * until someone notices the question. The answer is an ordinary response with
 * a note saying where it came from: the person changes it like any other.
 */

import type { Db } from "@/lib/prisma";
import {
  FRAMEWORK_QUESTION_ID,
  frameworkAnswerFor,
  frameworksForJurisdictions,
} from "@/config/assessment-frameworks";

const NOTE = {
  en: "Preselected from the jurisdictions your organization declared. Change it if this assessment needs other frameworks.",
  es: "Preseleccionado a partir de las jurisdicciones que declaró tu organización. Cámbialo si esta evaluación necesita otros marcos.",
} as const;

/** The section of the template that holds the framework question, if any. */
export function frameworkSectionId(sections: unknown): string | null {
  if (!Array.isArray(sections)) return null;
  for (const section of sections as Array<{ id?: unknown; questions?: unknown }>) {
    if (!Array.isArray(section?.questions)) continue;
    if ((section.questions as Array<{ id?: unknown }>).some((q) => q?.id === FRAMEWORK_QUESTION_ID)) {
      return typeof section.id === "string" ? section.id : null;
    }
  }
  return null;
}

export async function preselectDpiaFrameworks(
  prisma: Db,
  input: {
    organizationId: string;
    assessmentId: string;
    sections: unknown;
    userId: string;
    locale: "en" | "es";
  }
): Promise<boolean> {
  const sectionId = frameworkSectionId(input.sections);
  if (!sectionId) return false;

  const declared = await prisma.organizationJurisdiction.findMany({
    where: { organizationId: input.organizationId },
    select: { jurisdiction: { select: { code: true } } },
  });
  const frameworks = frameworksForJurisdictions(declared.map((d) => d.jurisdiction.code));
  if (!frameworks) return false;

  await prisma.assessmentResponse.create({
    data: {
      assessmentId: input.assessmentId,
      questionId: FRAMEWORK_QUESTION_ID,
      sectionId,
      response: frameworkAnswerFor(frameworks),
      notes: NOTE[input.locale],
      responderId: input.userId,
    },
  });
  return true;
}

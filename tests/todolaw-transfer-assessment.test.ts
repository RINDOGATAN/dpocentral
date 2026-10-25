// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { todoLawTiaResponses } from "@/server/services/todolaw-transfer-assessment";
import {
  TODOLAW_CHECKLIST,
  TODOLAW_SUPPLEMENTARY_MEASURES,
  TODOLAW_TIA_CHOICES,
  TODOLAW_TIA_TEXT,
} from "@/config/todolaw-transfer-assessment";
import { SCHREMS_II_CHECKLIST, SUPPLEMENTARY_MEASURES } from "@/config/transfer-compliance-rules";
import { ASSESSMENT_TEMPLATES_V2 } from "@/config/assessment-templates-v2";

const tia = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA") as unknown as {
  sections: { questions: { id: string }[] }[];
};
const questionIds = tia.sections.flatMap((s) => s.questions.map((q) => q.id));

describe("the ready-made TODO.LAW transfer assessment", () => {
  it("answers every question of the TIA template, in both languages", () => {
    for (const locale of ["en", "es"] as const) {
      const answered = todoLawTiaResponses(locale, new Date("2026-10-24T12:00:00Z")).map((r) => r.questionId);
      expect(answered.sort()).toEqual([...questionIds].sort());
    }
  });

  it("uses only options the template offers, in the organisation's language", () => {
    const es = todoLawTiaResponses("es");
    const tool = es.find((r) => r.questionId === "tiav2_1_1");
    expect(tool?.response).toBe("Cláusulas contractuales tipo (art. 46)");
    const next = todoLawTiaResponses("en", new Date("2026-10-24T12:00:00Z")).find((r) => r.questionId === "tiav2_5_2");
    expect(next?.response).toBe("2027-10-24");
  });

  it("never claims encryption keys the importer cannot reach", () => {
    expect(TODOLAW_TIA_CHOICES.tiav2_3_1).not.toContain("Encryption at rest, importer cannot access the keys");
    expect(TODOLAW_TIA_TEXT.en.tiav2_3_4).toMatch(/not against compelled disclosure/);
  });

  it("answers every checklist point and names only existing measures", () => {
    expect(Object.keys(TODOLAW_CHECKLIST).sort()).toEqual(SCHREMS_II_CHECKLIST.map((c) => c.id).sort());
    const ids = SUPPLEMENTARY_MEASURES.map((m) => m.id);
    for (const m of TODOLAW_SUPPLEMENTARY_MEASURES) expect(ids).toContain(m);
  });

  it("uses SCC, not CCT, and no long dashes", () => {
    const all = JSON.stringify([TODOLAW_TIA_TEXT, TODOLAW_CHECKLIST]);
    expect(all).not.toMatch(/\bCCT\b/);
    expect(all).not.toContain("—");
  });

  it("relies on the SCC and the measures, with no adequacy or Data Privacy Framework claim", () => {
    const all = JSON.stringify([TODOLAW_TIA_TEXT, TODOLAW_CHECKLIST, TODOLAW_TIA_CHOICES]);
    expect(TODOLAW_TIA_CHOICES.tiav2_2_1).toBe("No adequacy decision");
    expect(all).not.toMatch(/Privacy Framework|Marco de Privacidad|\bDPF\b|partial adequacy/i);
  });
});

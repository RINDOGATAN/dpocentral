// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The v2 question sets must be valid against the shape the assessment renderer
 * consumes, carry help on every regulator-facing question, and hold EN and
 * Castilian ES in parity. These are pure checks on the config, so a bad template
 * fails the build, not a person filling one in.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_TEMPLATES_V2,
  RENDERER_QUESTION_TYPES,
  serializeSections,
  templateSeedData,
  templateV2Messages,
  type BiText,
  type V2Question,
} from "@/config/assessment-templates-v2";

const nonEmpty = (v: BiText | undefined) =>
  !!v && v.en.trim().length > 0 && v.es.trim().length > 0;

const allQuestions = ASSESSMENT_TEMPLATES_V2.flatMap((t) =>
  t.sections.flatMap((s) => s.questions),
);

/** A question a regulator reads a keyword from: the structured input types. */
const isRegulatorFacing = (q: V2Question) =>
  q.type === "select" || q.type === "multiselect" || q.type === "boolean";

describe("v2 templates — structure", () => {
  it("are the four free-text templates, one each, versioned 2.0", () => {
    expect(ASSESSMENT_TEMPLATES_V2).toHaveLength(4);
    expect(ASSESSMENT_TEMPLATES_V2.map((t) => t.type).sort()).toEqual([
      "CUSTOM",
      "LIA",
      "PIA",
      "TIA",
    ]);
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      expect(t.version).toBe("2.0");
      expect(t.id).toBe(`system-${String(t.type).toLowerCase()}-template-v2`);
    }
  });

  it("supersede the matching v1 system row of the same type", () => {
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      expect(t.supersedes).toBe(`system-${String(t.type).toLowerCase()}-template`);
    }
  });

  it("every question uses a type the renderer handles", () => {
    for (const q of allQuestions) {
      expect(RENDERER_QUESTION_TYPES).toContain(q.type);
    }
  });

  it("question and section ids are unique within each template", () => {
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      const qids = t.sections.flatMap((s) => s.questions.map((q) => q.id));
      expect(new Set(qids).size).toBe(qids.length);
      const sids = t.sections.map((s) => s.id);
      expect(new Set(sids).size).toBe(sids.length);
    }
  });

  it("uses fresh v2 ids that cannot collide with the v1 bundle entries", () => {
    // v1 ids are lia1, tia1, custom1, q1_1…; v2 ids carry a v2 marker.
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      for (const s of t.sections) {
        expect(s.id).toContain("v2");
        for (const q of s.questions) expect(q.id).toContain("v2");
      }
    }
  });

  it("choice questions carry options; other types do not need them", () => {
    for (const q of allQuestions) {
      if (q.type === "select" || q.type === "multiselect") {
        expect(q.options && q.options.length).toBeGreaterThan(0);
        const values = q.options!.map((o) => o.en);
        expect(new Set(values).size).toBe(values.length);
      }
    }
  });

  it("a follow-up's showIf points at a real question in the same template", () => {
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      const ids = new Set(t.sections.flatMap((s) => s.questions.map((q) => q.id)));
      for (const s of t.sections) {
        for (const q of s.questions) {
          if (q.showIf) expect(ids.has(q.showIf.questionId)).toBe(true);
        }
      }
    }
  });

  it("uses the law's own vocabulary where the directive names it (lawful bases, transfer tools)", () => {
    const pia = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "PIA")!;
    const basis = pia.sections.flatMap((s) => s.questions).find((q) => q.id === "piav2_2_1")!;
    for (const marker of ["Art. 6(1)(a)", "Art. 6(1)(f)"]) {
      expect(basis.options!.some((o) => o.en.includes(marker))).toBe(true);
    }
    const tia = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA")!;
    const tool = tia.sections.flatMap((s) => s.questions).find((q) => q.id === "tiav2_1_1")!;
    for (const marker of ["Adequacy", "Standard Contractual Clauses", "Binding Corporate Rules", "Art. 49"]) {
      expect(tool.options!.some((o) => o.en.includes(marker))).toBe(true);
    }
  });
});

describe("v2 templates — help", () => {
  it("every regulator-facing (choice / yes-no) question has help in EN and ES", () => {
    for (const q of allQuestions) {
      if (isRegulatorFacing(q)) {
        expect(nonEmpty(q.help), `help missing on ${q.id}`).toBe(true);
      }
    }
  });

  it("help names an article or source", () => {
    for (const q of allQuestions) {
      if (isRegulatorFacing(q) && q.help) {
        expect(/Source:|Fuente:/.test(q.help.en)).toBe(true);
        expect(/Source:|Fuente:/.test(q.help.es)).toBe(true);
      }
    }
  });

  it("help avoids long dashes in published copy", () => {
    for (const q of allQuestions) {
      if (q.help) {
        expect(q.help.en.includes("—")).toBe(false);
        expect(q.help.es.includes("—")).toBe(false);
      }
    }
  });
});

describe("v2 templates — bilingual parity", () => {
  it("every template name and description is EN + ES", () => {
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      expect(nonEmpty(t.name)).toBe(true);
      expect(nonEmpty(t.description)).toBe(true);
    }
  });

  it("every section title/description and question text/option/help is EN + ES", () => {
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      for (const s of t.sections) {
        expect(nonEmpty(s.title)).toBe(true);
        expect(nonEmpty(s.description)).toBe(true);
        for (const q of s.questions) {
          expect(nonEmpty(q.text)).toBe(true);
          for (const o of q.options ?? []) expect(nonEmpty(o)).toBe(true);
          if (q.help) expect(nonEmpty(q.help)).toBe(true);
        }
      }
    }
  });
});

describe("serializeSections — the DB JSON", () => {
  const lia = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "LIA")!;
  const json = serializeSections(lia);

  it("mirrors the section/question shape with English strings", () => {
    expect(json).toHaveLength(lia.sections.length);
    const q0 = (json[0].questions as Record<string, unknown>[])[0];
    expect(q0.id).toBe("liav2_1_1");
    expect(q0.required).toBe(true);
    expect(typeof q0.text).toBe("string");
    expect(Array.isArray(q0.options)).toBe(true);
  });

  it("preserves a follow-up's showIf", () => {
    const pia = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "PIA")!;
    const pjson = serializeSections(pia);
    const follow = pjson
      .flatMap((s) => s.questions as Record<string, unknown>[])
      .find((q) => q.id === "piav2_1_4")!;
    expect(follow.showIf).toBeTruthy();
    expect((follow.showIf as { questionId: string }).questionId).toBe("piav2_1_3");
  });

  it("templateSeedData produces a system, active, current row", () => {
    const data = templateSeedData(lia);
    expect(data.isSystem).toBe(true);
    expect(data.isActive).toBe(true);
    expect(data.version).toBe("2.0");
    expect(data.type).toBe("LIA");
  });
});

describe("templateV2Messages — the message bundle", () => {
  const en = templateV2Messages("en");
  const es = templateV2Messages("es");

  it("carries every template, section and question for both locales", () => {
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      const key = String(t.type).toLowerCase();
      for (const locale of [en, es]) {
        expect(locale[key].template[t.id]).toBeTruthy();
        for (const s of t.sections) {
          expect(locale[key].section[s.id]).toBeTruthy();
          for (const q of s.questions) {
            expect(locale[key].question[q.id]).toBeTruthy();
          }
        }
      }
    }
  });

  it("keeps EN and ES option lists the same length (positional matching)", () => {
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      const key = String(t.type).toLowerCase();
      for (const s of t.sections) {
        for (const q of s.questions) {
          if (q.options) {
            expect(en[key].question[q.id].options).toHaveLength(q.options.length);
            expect(es[key].question[q.id].options).toHaveLength(q.options.length);
          }
        }
      }
    }
  });
});

describe("the delivery migration is additive and idempotent", () => {
  const sql = readFileSync(
    join(__dirname, "..", "prisma", "migrations", "20260928170000_assessment_question_sets_v2", "migration.sql"),
    "utf8",
  );

  it("inserts each v2 template guarded by ON CONFLICT DO NOTHING", () => {
    const inserts = sql.match(/INSERT INTO "assessment_templates"/g) ?? [];
    const conflicts = sql.match(/ON CONFLICT \("id"\) DO NOTHING;/g) ?? [];
    expect(inserts).toHaveLength(ASSESSMENT_TEMPLATES_V2.length);
    // One ON CONFLICT guard per INSERT statement (the trailing ";" excludes the
    // description in the header comment).
    expect(conflicts).toHaveLength(ASSESSMENT_TEMPLATES_V2.length);
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      expect(sql).toContain(`'${t.id}'`);
    }
  });

  it("supersedes only the v1 system rows, guarded on supersededAt IS NULL", () => {
    expect(sql).toContain('SET "supersededAt" = NOW()');
    expect(sql).toContain('"supersededAt" IS NULL');
    expect(sql).toContain('"isSystem" = true');
    expect(sql).toContain('"organizationId" IS NULL');
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      expect(sql).toContain(`'${t.supersedes}'`);
    }
  });

  it("never drops, deletes or renames (additive only)", () => {
    expect(/\bDROP\b|\bDELETE\b|\bALTER\b/i.test(sql)).toBe(false);
  });
});

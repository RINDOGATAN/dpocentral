// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Not legal advice" is assumed (owner's decision, 15 Oct 2026): no screen of
 * the app says that its content is not legal advice, in English or in
 * Spanish. The sentences that carried it were reworded, not removed, so each
 * still reads well. A referral to a lawyer for legal advice (the incident
 * expert card) is not a disclaimer and stays.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { VENDOR_QUESTIONNAIRE_V1, VENDOR_QUESTIONNAIRE_V2 } from "@/config/vendor-questionnaires";
import {
  VENDOR_QUESTIONNAIRE_EARLIER_DESCRIPTIONS,
  localizeQuestionnaire,
} from "@/config/vendor-questionnaires-es";

const DISCLAIMER =
  /not legal advice|no legal advice|not a legal opinion|no (es|constituyen?) asesoramiento jur[ií]dico|no asesoramiento jur[ií]dico|ni constituye asesoramiento|no es un dictamen jur[ií]dico/i;

function strings(o: unknown, at = ""): [string, string][] {
  if (typeof o === "string") return [[at, o]];
  if (o && typeof o === "object") {
    return Object.entries(o).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k));
  }
  return [];
}

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("no screen says its content is not legal advice", () => {
  for (const [locale, bundle] of [["en", en], ["es", es]] as const) {
    it(`in the ${locale} messages`, () => {
      const hits = strings(bundle).filter(([, v]) => DISCLAIMER.test(v)).map(([k]) => k);
      expect(hits).toEqual([]);
    });
  }

  it("in the template, questionnaire and help texts the app shows", () => {
    for (const file of [
      "src/config/assessment-templates-v2.ts",
      "src/config/vendor-questionnaires.ts",
      "src/config/help/pages.ts",
      "src/server/services/export/assessment-report.tsx",
    ]) {
      // Only the strings shown, not the code comments.
      const shown = read(file)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      expect(shown, file).not.toMatch(DISCLAIMER);
    }
  });

  it("rewords the applicability note as decided", () => {
    expect(en.applicability.editableNote).toBe(
      "Guidance only, with the mapping still under review. You can change your answers at any time."
    );
    expect(es.applicability.editableNote).toBe(
      "Información meramente orientativa, con las correspondencias aún pendientes de revisión. Puedes cambiar tus respuestas cuando quieras."
    );
  });

  it("keeps the footer's advice to verify with counsel", () => {
    expect(en.footer.disclaimer).toBe(
      "DPO Central provides informational tools and templates. Verify with qualified counsel before relying on outputs."
    );
    expect(es.footer.disclaimer).toBe(
      "DPO Central ofrece herramientas y plantillas informativas. Verifica los resultados con un abogado cualificado antes de utilizarlos."
    );
  });

  it("shows a questionnaire stored with the earlier description in today's words", () => {
    for (const [earlier, today] of Object.entries(VENDOR_QUESTIONNAIRE_EARLIER_DESCRIPTIONS)) {
      expect(earlier).toMatch(DISCLAIMER);
      expect([VENDOR_QUESTIONNAIRE_V1.description, VENDOR_QUESTIONNAIRE_V2.description]).toContain(today);
      const stored = { name: VENDOR_QUESTIONNAIRE_V2.name, description: earlier, sections: [] };
      expect(localizeQuestionnaire(stored, "en").description).toBe(today);
      expect(localizeQuestionnaire(stored, "es").description).not.toMatch(DISCLAIMER);
      expect(localizeQuestionnaire(stored, "es").description).not.toBe(today);
    }
  });
});

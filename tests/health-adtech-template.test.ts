/**
 * "Health data in advertising: CCPA risk assessment and GDPR DPIA"
 * (src/config/health-adtech-template.ts): bilingual content, jurisdiction-
 * driven questions (src/lib/assessment-conditions.ts) and the result that
 * the report prints (src/lib/health-adtech/results.ts).
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  HEALTH_ADTECH_SECTIONS,
  HEALTH_ADTECH_TEMPLATE_ID,
  JURISDICTIONS,
  healthAdtechMessages,
  healthAdtechTemplateData,
  type JurisdictionCode,
} from "@/config/health-adtech-template";
import {
  answerMapFrom,
  hiddenByConditions,
  visibleProgress,
  visibleSections,
} from "@/lib/assessment-conditions";
import { computeHealthAdtechResult, isHealthAdtechTemplate } from "@/lib/health-adtech/results";
import { objectLookup, translateSections, translateTemplateMeta } from "@/lib/template-i18n-core";
import {
  allLocalizedSections,
  sectionsForLocale,
} from "@/server/services/assessment/template-locales";
import { assessmentProgress, unansweredRequired } from "@/server/services/assessment/progress";

const stored = healthAdtechTemplateData.sections;
const template = { type: "DPIA", sections: stored };

const label = (code: JurisdictionCode, lang: "en" | "es" = "en") =>
  JURISDICTIONS.find((j) => j.code === code)![lang];

const jurisdictions = (codes: JurisdictionCode[], lang: "en" | "es" = "en") => ({
  questionId: "hd1_1",
  response: JSON.stringify(codes.map((c) => label(c, lang))),
});

const visibleIds = (responses: Array<{ questionId: string; response: unknown }>) =>
  new Set(
    visibleSections(stored, answerMapFrom(responses), allLocalizedSections("DPIA", stored)).flatMap(
      (s) => (s.questions ?? []).map((q) => q.id)
    )
  );

const answer = (questionId: string, response: string) => ({ questionId, response });

describe("content", () => {
  it("has unique section and question ids that do not clash with the standard DPIA", () => {
    const ids = HEALTH_ADTECH_SECTIONS.flatMap((s) => [s.id, ...s.questions.map((q) => q.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("hd"))).toBe(true);
  });

  it("covers the nine parts of the brief plus the jurisdiction section", () => {
    expect(HEALTH_ADTECH_SECTIONS.map((s) => s.id)).toEqual([
      "hd1", "hd2", "hd3", "hd4", "hd5", "hd6", "hd7", "hd8", "hd9", "hd10",
    ]);
    const hd1 = HEALTH_ADTECH_SECTIONS[0].questions;
    expect(hd1.find((q) => q.id === "hd1_2")!.options!.en).toHaveLength(7); // six triggers + none
    const impacts = HEALTH_ADTECH_SECTIONS[4].questions.find((q) => q.id === "hd5_1")!;
    expect(impacts.options!.en).toHaveLength(8);
    expect(HEALTH_ADTECH_SECTIONS[5].questions.filter((q) => q.type === "select")).toHaveLength(5);
  });

  it("offers every jurisdiction the brief names", () => {
    expect(JURISDICTIONS.map((j) => j.code)).toEqual([
      "EU", "UK", "CA", "WA", "NV", "MD", "CT", "CO", "VA", "TX", "OR", "US_OTHER",
    ]);
  });

  it("has the same option count and the same [to verify] marks in both languages", () => {
    for (const s of HEALTH_ADTECH_SECTIONS) {
      for (const q of s.questions) {
        if (q.options) expect(q.options.es).toHaveLength(q.options.en.length);
        const enMarks = (q.help?.en.match(/\[to verify\]/g) ?? []).length;
        const esMarks = (q.help?.es.match(/\[por verificar\]/g) ?? []).length;
        expect(esMarks, q.id).toBe(enMarks);
        expect(Boolean(q.help?.en.includes("Source:")), q.id).toBe(Boolean(q.help?.es.includes("Fuente:")));
      }
    }
  });

  it("addresses the reader as tú in Spanish", () => {
    const all = JSON.stringify(healthAdtechMessages("es"));
    expect(all).not.toMatch(/\busted(es)?\b/i);
    expect(all).toMatch(/Selecciona|Responde|Describe/);
  });

  it("gives every legal statement a source", () => {
    const legal = /\b(Art\.|Article|CCPA|GDPR|Washington|Nevada|Maryland|prohibit)/;
    for (const s of HEALTH_ADTECH_SECTIONS) {
      for (const q of s.questions) {
        if (q.help && legal.test(q.help.en)) {
          expect(q.help.en, q.id).toMatch(/Source:/);
        }
      }
    }
  });

  it("is a DPIA template marked for its own scoring", () => {
    expect(healthAdtechTemplateData.type).toBe("DPIA");
    expect(isHealthAdtechTemplate(healthAdtechTemplateData)).toBe(true);
    expect(isHealthAdtechTemplate({ scoringLogic: { method: "weighted_average" } })).toBe(false);
  });
});

describe("message bundles", () => {
  it("contain the template's current text in both languages (run scripts/sync-health-adtech-messages.ts)", () => {
    for (const [locale, bundle] of [["en", en], ["es", es]] as const) {
      const dpia = (bundle as any).templates.dpia;
      const expected = healthAdtechMessages(locale);
      for (const group of ["template", "section", "question"] as const) {
        for (const [key, value] of Object.entries(expected[group])) {
          expect(dpia[group][key], `${locale} ${group}.${key}`).toEqual(value);
        }
      }
    }
  });

  it("translate the stored sections and the template name into Spanish", () => {
    const esSections = sectionsForLocale("DPIA", stored, "es");
    expect(esSections[0].title).toBe("Alcance y análisis de umbral");
    expect(esSections[0].questions![0].options).toContain("UE/EEE (RGPD)");
    const meta = translateTemplateMeta(
      { id: HEALTH_ADTECH_TEMPLATE_ID, type: "DPIA", name: "x", description: "y" },
      objectLookup((es as any).templates)
    );
    expect(meta.name).toMatch(/^Datos de salud en publicidad/);
  });

  it("leave the standard DPIA translations in place", () => {
    const esDpia = translateSections(
      "DPIA",
      [{ id: "s1", title: "Processing Description", questions: [] }],
      objectLookup((es as any).templates)
    );
    expect(esDpia[0].title).toBe("Descripción del tratamiento");
  });
});

describe("jurisdictions change the questions", () => {
  it("asks no jurisdiction-specific question before a jurisdiction is chosen", () => {
    const ids = visibleIds([]);
    for (const id of ["hd1_2", "hd1_3", "hd1_4", "hd2_4", "hd8_1", "hd8_4", "hd8_5", "hd9_3"]) {
      expect(ids.has(id), id).toBe(false);
    }
    expect(ids.has("hd1_1")).toBe(true);
    expect(ids.has("hd6_1")).toBe(true);
    // The jurisdiction section disappears when all of its questions are hidden.
    const hidden = hiddenByConditions(stored, {}, []);
    expect(hidden.sections.has("hd8")).toBe(true);
  });

  it("Washington or Nevada adds consent, authorisation and the geofencing prohibition", () => {
    for (const code of ["WA", "NV"] as const) {
      const ids = visibleIds([jurisdictions([code])]);
      expect([...ids].filter((id) => id.startsWith("hd8_"))).toEqual(["hd8_1", "hd8_2", "hd8_3"]);
    }
  });

  it("Maryland adds the prohibition on selling sensitive data", () => {
    const ids = visibleIds([jurisdictions(["MD"])]);
    expect(ids.has("hd8_4")).toBe(true);
    expect(ids.has("hd8_1")).toBe(false);
    expect(ids.has("hd1_4")).toBe(true);
  });

  it("California adds its triggers, the right to limit, the timetable and the attestation", () => {
    const ids = visibleIds([jurisdictions(["CA"])]);
    for (const id of ["hd1_2", "hd8_5", "hd8_6", "hd8_7"]) expect(ids.has(id), id).toBe(true);
    expect(ids.has("hd1_3")).toBe(false);
    expect(ids.has("hd9_3")).toBe(false);
  });

  it("EU/EEA or UK adds Article 35 and Article 36", () => {
    for (const code of ["EU", "UK"] as const) {
      const ids = visibleIds([jurisdictions([code])]);
      for (const id of ["hd1_3", "hd2_4", "hd8_10", "hd9_3"]) expect(ids.has(id), id).toBe(true);
      expect(ids.has("hd1_2")).toBe(false);
    }
  });

  it("works on answers saved in Spanish", () => {
    const ids = visibleIds([jurisdictions(["WA", "EU"], "es")]);
    expect(ids.has("hd8_3")).toBe(true);
    expect(ids.has("hd9_3")).toBe(true);
  });

  it("does not require hidden questions on submission, and counts only visible ones", () => {
    const base = [jurisdictions(["CA"])];
    const missing = unansweredRequired(template, base);
    expect(missing).toContain("hd8_7");
    expect(missing).not.toContain("hd8_3");
    expect(missing).not.toContain("hd9_3");

    const withWa = [jurisdictions(["CA", "WA"])];
    expect(unansweredRequired(template, withWa)).toContain("hd8_3");

    const p1 = assessmentProgress(template, base);
    const p2 = assessmentProgress(template, withWa);
    expect(p2.totalQuestions).toBe(p1.totalQuestions + 3);
    expect(p1.answeredQuestions).toBe(1);
  });

  it("keeps the original count for templates without conditions", () => {
    const plain = {
      type: "LIA",
      sections: [{ id: "a", title: "A", questions: [{ id: "a1", text: "?", required: true }] }],
    };
    const p = assessmentProgress(plain, [
      { questionId: "a1", response: "x" },
      { questionId: "r::1", response: "y" },
    ]);
    expect(p).toEqual({ totalQuestions: 1, answeredQuestions: 2, completionPercentage: 200 });
    expect(unansweredRequired(plain, [])).toEqual(["a1"]);
    expect(visibleProgress(plain.sections, []).total).toBe(1);
  });
});

describe("jurisdictions change the report", () => {
  const facts = [
    answer("hd8_1", "No"),
    answer("hd8_2", "Yes"),
    answer("hd8_3", "Yes"),
    answer("hd8_4", "Yes"),
    answer("hd8_5", "No"),
    answer("hd9_1", "High"),
  ];

  it("gives a different result for the same facts when the jurisdictions change", () => {
    const eu = computeHealthAdtechResult([jurisdictions(["EU"]), ...facts]);
    const wa = computeHealthAdtechResult([jurisdictions(["WA"]), ...facts]);

    expect(eu.jurisdictions.map((j) => j.code)).toEqual(["EU"]);
    expect(eu.priorConsultation?.required).toBe(true);
    expect(eu.blocking).toBe(false);

    expect(wa.jurisdictions.map((j) => j.code)).toEqual(["WA"]);
    expect(wa.priorConsultation).toBeNull();
    expect(wa.blocking).toBe(true);
    const waFindings = wa.jurisdictions[0].findings.map((f) => f.text.en).join(" ");
    expect(waFindings).toMatch(/Geofencing/);
    expect(waFindings).toMatch(/Consent to collect/);
  });

  it("lists the consent model and sourced obligations per jurisdiction", () => {
    const r = computeHealthAdtechResult([jurisdictions(["MD", "CA", "CT"]), ...facts]);
    const md = r.jurisdictions.find((j) => j.code === "MD")!;
    expect(md.consentModel.en).toMatch(/selling sensitive data is prohibited \(Com\. Law 14-4607\(a\)\(2\)\)/);
    expect(md.consentModel.en).not.toMatch(/\[to verify\]/);
    expect(md.obligations[0].source.en).toMatch(/MODPA/);
    expect(md.findings.some((f) => f.severity === "blocking")).toBe(true);

    const ca = r.jurisdictions.find((j) => j.code === "CA")!;
    expect(ca.consentModel.en).toMatch(/right to limit/);
    const timetable = ca.obligations.find((o) => /1 April 2028/.test(o.text.en))!;
    expect(timetable.toVerify).toBe(false);
    expect(timetable.source.en).toMatch(/11 CCR 7155, 7157\(a\), 7157\(e\)/);
    expect(timetable.text.es).toMatch(/1 de abril de 2028/);
    const attestation = ca.obligations.find((o) => /Attestation/.test(o.text.en))!;
    expect(attestation.toVerify).toBe(false);
    expect(attestation.source.en).toMatch(/11 CCR 7157\(b\)\(5\), 7157\(c\)/);
    expect(ca.findings.map((f) => f.text.en).join(" ")).toMatch(/right to limit/);

    const ct = r.jurisdictions.find((j) => j.code === "CT")!;
    expect(ct.obligations.every((o) => /CTDPA/.test(o.source.en))).toBe(true);
    // Order follows the option list, not the order of selection.
    expect(r.jurisdictions.map((j) => j.code)).toEqual(["CA", "MD", "CT"]);
  });

  it("cites the primary sources for Washington and Nevada and does not flag them", () => {
    const r = computeHealthAdtechResult([jurisdictions(["WA", "NV"])]);
    const cites = { WA: ["RCW 19.373.030", "RCW 19.373.070", "RCW 19.373.080"], NV: ["NRS 603A.500", "NRS 603A.535", "NRS 603A.540"] };
    for (const j of r.jurisdictions) {
      expect(j.consentModel.en).not.toMatch(/\[to verify\]/);
      expect(j.consentModel.es).not.toMatch(/\[por verificar\]/);
      expect(j.obligations.some((o) => o.toVerify)).toBe(false);
      const expected = cites[j.code as "WA" | "NV"];
      expect(j.consentModel.en).toContain(expected[0]);
      expect(j.obligations.map((o) => o.source.en)).toEqual(
        expected.map((c) => `Primary source (checked 16 September 2026): ${c}`)
      );
      expect(j.obligations.every((o) => o.source.es.startsWith("Fuente primaria (comprobada el 16 de septiembre de 2026): "))).toBe(true);
    }
  });

  it("does not flag the EU and UK consent models", () => {
    const r = computeHealthAdtechResult([jurisdictions(["EU", "UK"])]);
    for (const j of r.jurisdictions) {
      expect(j.consentModel.en).toMatch(/Art\. 9\(2\)\(a\)/);
      expect(j.consentModel.en).not.toMatch(/\[to verify\]/);
    }
  });

  it("still marks the unsourced US state items as to verify", () => {
    const r = computeHealthAdtechResult([jurisdictions(["CT", "CO", "VA", "TX", "OR", "US_OTHER"])]);
    for (const j of r.jurisdictions) {
      const optOut = j.obligations.find((o) => /right to opt out|opt-out and assessment rules/.test(o.text.en))!;
      expect(optOut.toVerify, j.code).toBe(true);
    }
    const other = r.jurisdictions.find((j) => j.code === "US_OTHER")!;
    expect(other.consentModel.en).toMatch(/\[to verify\]/);
    expect(other.consentModel.es).toMatch(/\[por verificar\]/);
  });

  it("keeps the unsourced help text flagged and cites the checked sources", () => {
    const help = (id: string) =>
      HEALTH_ADTECH_SECTIONS.flatMap((s) => s.questions).find((q) => q.id === id)!.help!;
    for (const id of ["hd1_2", "hd2_4", "hd6_1", "hd8_8", "hd8_9"]) expect(help(id).en, id).toMatch(/\[to verify\]/);
    const cited: Record<string, string> = {
      hd5_1: "11 CCR 7152(a)(5)-(6)",
      hd7_1: "11 CCR 7152(a)(5)-(6)",
      hd8_1: "RCW 19.373.030; Nevada NRS 603A.500",
      hd8_2: "RCW 19.373.070; Nevada NRS 603A.535",
      hd8_3: "RCW 19.373.080; NRS 603A.540",
      hd8_4: "Md. Com. Law 14-4607(a)(1),(2)",
      hd8_6: "11 CCR 7155(a),(b) and 7157(a),(e)",
      hd8_7: "11 CCR 7157(b)(5),(c)",
    };
    for (const [id, cite] of Object.entries(cited)) {
      expect(help(id).en, id).toContain(cite);
      expect(help(id).en, id).not.toMatch(/\[to verify\]|workshop brief/);
      expect(help(id).es, id).not.toMatch(/\[por verificar\]|encargo del taller/);
    }
  });

  it("bands the five factors and reads Spanish answers", () => {
    const factors = (lang: "en" | "es", picks: number[]) =>
      ["hd6_1", "hd6_2", "hd6_3", "hd6_4", "hd6_5"].map((id, i) => {
        const q = HEALTH_ADTECH_SECTIONS[5].questions.find((x) => x.id === id)!;
        return answer(id, q.options![lang][picks[i]]);
      });
    expect(computeHealthAdtechResult(factors("en", [0, 0, 1, 1, 1])).fiveFactor).toMatchObject({
      score: 3,
      band: "LOW",
    });
    expect(computeHealthAdtechResult(factors("es", [3, 3, 3, 2, 3])).fiveFactor).toMatchObject({
      score: 14,
      band: "VERY_HIGH",
    });
    const partial = computeHealthAdtechResult(factors("en", [1, 1, 1, 1, 1]).slice(0, 3));
    expect(partial.fiveFactor).toMatchObject({ answered: 3, band: null });
  });

  it("records the mitigation choice, the decision, the signature and the risk level", () => {
    const r = computeHealthAdtechResult([
      jurisdictions(["EU"]),
      answer("hd7_1", "Suprimir los datos relacionados con la salud de los consumidores de estados con consentimiento expreso"),
      answer("hd9_1", "Medium"),
      answer("hd9_2", "Proceed with the safeguards listed"),
      answer("hd10_1", "Chief Privacy Officer"),
      answer("hd10_2", "2026-09-17"),
      answer("hd10_3", "2027-09-17"),
    ]);
    expect(r.mitigation?.en).toBe("Suppress health-related data for consumers in opt-in states");
    expect(r.determination?.es).toBe("Seguir adelante con las garantías indicadas");
    expect(r.priorConsultation?.required).toBe(false);
    expect(r.signature).toEqual({
      signer: "Chief Privacy Officer",
      date: "2026-09-17",
      reviewDate: "2027-09-17",
    });
    expect(r.riskLevel).toBe("MEDIUM");
    expect(r.riskScore).toBe(38);
  });

  it("raises the risk level to at least High on a blocking finding", () => {
    const r = computeHealthAdtechResult([
      jurisdictions(["MD"]),
      answer("hd8_4", "Yes"),
      answer("hd9_1", "Low"),
    ]);
    expect(r.blocking).toBe(true);
    expect(r.riskLevel).toBe("HIGH");
  });
});

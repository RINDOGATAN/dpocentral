// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Copy found in a walk of the product in both languages:
 *
 * C1 risk indicators on the compliance page are worded in the reader's language
 * C2 counts read "1 data asset", not "1 data assets"
 * C3 one name in Spanish for "What applies" ("Qué se te aplica")
 * C4 the Spanish sign-in sentence agrees in gender
 * C5 the DPIA hint points at the list below it; no "rules of European Union"
 * C6 no "bootstrap" jargon; no "industria" in Spanish
 * C7 the landing's email field is required (a blank submit is not sent)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const tEn = createTranslator({ locale: "en", messages: en });
const tEs = createTranslator({ locale: "es", messages: es });

const KEYS = [
  "overdueDsars",
  "highRiskVendorsUnassessed",
  "openSevereIncidents",
  "draftAssessments",
  "contractsExpiring",
  "assetsWithoutActivity",
] as const;

describe("C1: risk indicators", () => {
  it.each(KEYS)("%s is worded in both languages, singular and plural", (key) => {
    for (const t of [tEn, tEs]) {
      const one = t(`pages.reports.risk.items.${key}`, { count: 1 });
      const two = t(`pages.reports.risk.items.${key}`, { count: 2 });
      expect(one).toMatch(/^1 /);
      expect(two).toMatch(/^2 /);
      expect(one).not.toBe(two);
    }
  });

  it("the server sends keys and counts, not English sentences", () => {
    const router = read("src/server/routers/privacy/reports.ts");
    for (const key of KEYS) expect(router).toContain(`key: "${key}"`);
    expect(router).not.toMatch(/still in draft`|not linked to processing activities`/);
    expect(read("src/app/(dashboard)/privacy/reports/page.tsx")).toContain("tp(`risk.items.${indicator.key}`");
  });
});

describe("C2: counts agree with their number", () => {
  it("reads 1 data asset, 2 data assets", () => {
    expect(tEn("pages.processingActivities.assetsCount", { count: 1 })).toBe("1 data asset");
    expect(tEn("pages.processingActivities.assetsCount", { count: 2 })).toBe("2 data assets");
    expect(tEn("pages.processingActivities.subjectTypesCount", { count: 1 })).toBe("1 subject type");
    expect(tEn("pages.processingActivities.categoriesCount", { count: 1 })).toBe("1 data category");
    expect(tEn("pages.elementDetail.retentionDays", { days: 1 })).toBe("1 day");
  });
});

describe("C3 to C6: wording", () => {
  const esText = JSON.stringify(es);
  const enText = JSON.stringify(en);

  it("names What applies one way in Spanish", () => {
    expect(esText).not.toContain("Qué te aplica");
    expect(tEs("pages.quickstart.steps.applies")).toBe(tEs("guided.steps.applies.label"));
  });

  it("agrees in gender on the sign-in page", () => {
    const sentence = `${tEs("auth.bySigningIn")} ${tEs("auth.termsOfService")} ${tEs("auth.and")} ${tEs("auth.privacyPolicy")}`;
    expect(sentence).toBe("Al iniciar sesión, aceptas las Condiciones del servicio y la Política de privacidad");
  });

  it("points the DPIA hint at the list below it", () => {
    expect(tEn("pages.assessmentDetail.completeness.submitHint")).toContain("listed below");
    expect(enText).not.toContain("the rules of {framework}");
    expect(esText).not.toContain("las normas de {framework}");
  });

  it("avoids jargon and Latin American terms", () => {
    expect(enText).not.toMatch(/bootstrap/i);
    expect(esText).not.toMatch(/\bindustrias?\b/i);
  });
});

describe("C7: the landing's sign-up email", () => {
  it("is required and never sent blank", () => {
    const page = read("src/landing/components/StartupProductPage.tsx");
    expect(page.match(/type="email"\s+required/g)?.length).toBe(2);
    expect(page).toContain("if (!emailInput.trim()) return;");
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Wording checks:
 *   - the TIA's Spanish name is "Evaluación de impacto de la transferencia"
 *     (singular), capitalised as a name in the vendor questionnaire;
 *   - on the hosted service the adviser persona says "up to five
 *     organizations", the number ORGANIZATIONS_PER_ACCOUNT holds;
 *   - the Spanish DPA texts say "Fecha de entrada en vigor" and spell out
 *     "ATD" where the clause guidance first uses it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { VENDOR_QUESTIONNAIRES_ES } from "@/config/vendor-questionnaires-es";
import { ORGANIZATIONS_PER_ACCOUNT } from "@/server/services/pilot/limits";

const ROOT = path.join(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

function filesUnder(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(ROOT, rel)).isDirectory() ? filesUnder(rel) : [rel];
  });
}

describe("the TIA's Spanish name", () => {
  it("is singular everywhere outside the Dealroom pack", () => {
    const files = ["src/messages/es.json", ...filesUnder("src/config"), ...filesUnder("src/lib").filter((f) => !f.includes("dealroom"))];
    for (const f of files) {
      expect(read(f), f).not.toMatch(/mpacto de las transferencias/);
    }
  });

  it("reads as a name in the template list and the type labels", () => {
    expect(read("src/messages/es.json")).toContain('"name": "Evaluación de impacto de la transferencia (EIT)"');
    expect(read("src/config/assessment-templates-v2.ts")).toContain(
      'L("Transfer Impact Assessment", "Evaluación de impacto de la transferencia (EIT)")',
    );
  });

  it("starts with a capital letter in the vendor questionnaire", () => {
    const q =
      VENDOR_QUESTIONNAIRES_ES[
        "Have you conducted a Transfer Impact Assessment (TIA) to evaluate the legal framework and surveillance risks in the recipient country?"
      ];
    expect(q).toContain("una Evaluación de impacto de la transferencia (EIT)");
  });
});

describe("the adviser persona on the hosted service", () => {
  it("says up to five organizations, the account's limit", () => {
    expect(ORGANIZATIONS_PER_ACCOUNT).toBe(5);
    expect(en.onboarding.privacyProfessionalDescHosted).toContain("up to five organizations");
    expect(en.pages.settings.accountType.privacyProfessionalDescHosted).toContain("up to five organizations");
    expect(es.onboarding.privacyProfessionalDescHosted).toContain("hasta cinco organizaciones");
    expect(es.pages.settings.accountType.privacyProfessionalDescHosted).toContain("hasta cinco organizaciones");
    // The self-hosted kit keeps the line without a number.
    expect(en.onboarding.privacyProfessionalDesc).toContain("several organizations");
  });

  it("is still offered on hosted, with the hosted line", () => {
    const welcome = read("src/components/privacy/onboarding-welcome.tsx");
    expect(welcome).toContain('"PRIVACY_PROFESSIONAL" as UserType');
    expect(welcome).toContain("privacyProfessionalDescHosted");
    expect(read("src/app/(dashboard)/privacy/settings/page.tsx")).toContain("privacyProfessionalDescHosted");
  });
});

describe("the Spanish DPA texts", () => {
  const pack = "src/lib/dealroom/contract-pack";

  it('say "Fecha de entrada en vigor", never "Fecha de Efectividad"', () => {
    for (const f of filesUnder(pack).filter((f) => f.endsWith(".json"))) {
      expect(read(f), f).not.toMatch(/Efectividad/);
    }
    expect(read(`${pack}/dpa/boilerplate.json`)).toContain('(\\"Fecha de entrada en vigor\\")');
  });

  it("spell out ATD at its first use in the clause guidance", () => {
    const clauses = JSON.parse(read(`${pack}/dpa/clauses.json`)) as {
      clauses: Array<{ plainDescription?: { es?: string }; options: Array<{ consPartyB?: { es?: string[] }; plainDescription?: { es?: string } }> }>;
    };
    const guidance: string[] = [];
    for (const c of clauses.clauses) {
      if (c.plainDescription?.es) guidance.push(c.plainDescription.es);
      for (const o of c.options) {
        guidance.push(...(o.consPartyB?.es ?? []));
        if (o.plainDescription?.es) guidance.push(o.plainDescription.es);
      }
    }
    const first = guidance.find((g) => /\bATD\b/.test(g))!;
    expect(first).toContain("acuerdo de encargo de tratamiento de datos (ATD)");
  });

  it("keep the manifest hashes in step with the files", () => {
    const manifest = JSON.parse(read(`${pack}/manifest.json`)) as { files: Record<string, string> };
    for (const f of ["dpa/clauses.json", "dpa/boilerplate.json"]) {
      const hash = createHash("sha256").update(readFileSync(path.join(ROOT, pack, f))).digest("hex");
      expect(manifest.files[f], f).toBe(hash);
    }
  });
});

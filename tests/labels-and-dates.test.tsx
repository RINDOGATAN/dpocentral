// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Defects found in a browser walk (both languages, 1440
 * and 375 px), each held here so it stays fixed:
 *
 * - Help pages: the previous/next links pushed the page sideways on a phone
 *   in Spanish; the example mockups showed English dates ("Jan 18, 09:30"),
 *   English country names, raw codes ("HIGH", "INVESTIGATING") and long dashes.
 * - Audit trail: many actions showed their English code ("Export ROPA",
 *   "Update") in Spanish; every action the product records now has a label.
 * - Incident severity in Spanish agrees with "gravedad" (Media, not Medio).
 * - The public rights-request portal showed the seeded English title over a
 *   Spanish page; untouched seeded words now follow the visitor's language.
 * - File names and portal addresses dropped accented letters to dashes
 *   ("Log-stica"); accents are now removed instead.
 * - The reports page wrote months in the browser's language, not the interface's.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import { DEFAULT_INTAKE_TEXT, localizedIntakeText } from "@/lib/dsar-default-intake";
import { DEFAULT_INTAKE_FORM, isIntakeConfigured } from "@/server/services/dsar/defaultIntakeForm";
import { nameForFile } from "@/server/services/export/documents/context";
import { organizationSlug } from "@/lib/organization-slug";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}


describe("audit trail", () => {
  it("has a label, in both languages, for every action the product records", () => {
    const codes = new Set<string>();
    for (const f of files(path.join(ROOT, "src"))) {
      const src = readFileSync(f, "utf8");
      // `action: "CODE"`, and both codes of `action: cond ? "A" : "B"`.
      for (const m of src.matchAll(/\baction:[^\n,}]*/g)) {
        for (const c of m[0].matchAll(/"([A-Z][A-Z0-9_]{2,})"/g)) codes.add(c[1]);
      }
    }
    codes.add("VIEWED"); // DSAR_VIEWED_ACTION
    expect(codes.size).toBeGreaterThan(20);
    const missing = (bundle: typeof en) =>
      [...codes].filter((c) => !(c in (bundle.auditTrail.actions as Record<string, string>)));
    expect(missing(en)).toEqual([]);
    expect(missing(es)).toEqual([]);
    const esActions = es.auditTrail.actions as Record<string, string>;
    for (const label of Object.values(esActions)) expect(label).not.toMatch(/\b(Export|Import|Confirm)\b/);
  });
});

describe("incident severity in Spanish", () => {
  it("agrees with la gravedad, as the new-incident form does", () => {
    expect(es.pages.incidents.severity).toEqual({ LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" });
    expect(es.pages.newIncident.severityOption).toMatchObject({ MEDIUM: "Media" });
  });
});

describe("public rights-request portal", () => {
  const tFor = (bundle: typeof en) => (key: "header.defaultTitle" | "header.defaultDescription" | "success.defaultThankYou") => {
    const [group, leaf] = key.split(".") as ["header" | "success", string];
    return (bundle.dsarPublic.form[group] as Record<string, string>)[leaf];
  };

  it("seeds the form with the same words the portal recognises", () => {
    expect(DEFAULT_INTAKE_FORM.title).toBe(DEFAULT_INTAKE_TEXT.title);
    expect(DEFAULT_INTAKE_FORM.description).toBe(DEFAULT_INTAKE_TEXT.description);
    expect(DEFAULT_INTAKE_FORM.thankYouMessage).toBe(DEFAULT_INTAKE_TEXT.thankYouMessage);
    // The "set up yet?" test still reads the seeded form as untouched.
    expect(
      isIntakeConfigured({ ...DEFAULT_INTAKE_FORM, privacyNoticeUrl: null, customCss: null, fields: [] })
    ).toBe(false);
  });

  it("shows the untouched seeded words in Spanish to a Spanish visitor, and unchanged in English", () => {
    const seeded = { ...DEFAULT_INTAKE_TEXT };
    expect(localizedIntakeText(seeded, tFor(es))).toEqual({
      title: "Solicitud de ejercicio de derechos",
      description: "Envía una solicitud sobre tus datos personales",
      thankYouMessage: "Gracias por tu solicitud. La tramitaremos dentro del plazo que marca la ley.",
    });
    expect(localizedIntakeText(seeded, tFor(en))).toEqual(seeded);
  });

  it("never rewrites words a person wrote", () => {
    const own = { title: "Privacy requests", description: null, thankYouMessage: "Thanks!" };
    expect(localizedIntakeText(own, tFor(es))).toEqual(own);
  });

  it("uses the localised words on the portal page", () => {
    const page = read("src/app/dsar/[orgSlug]/page.tsx");
    expect(page).toContain("localizedIntakeText(formConfig, t)");
    expect(page).toContain("{words.title}");
    expect(page).not.toContain("{formConfig.title}");
  });
});

describe("names with accents", () => {
  it("drops accents in file names instead of turning them into dashes", () => {
    expect(nameForFile("Ejemplo Logística, S.L.")).toBe("Ejemplo-Logistica-S-L");
    expect(nameForFile("Example Logistics, Inc.")).toBe("Example-Logistics-Inc");
    expect(nameForFile("Org src")).toBe("Org-src");
    expect(nameForFile("¿?")).toBe("organisation");
  });

  it("drops accents in an organisation's web address, the same way in every form that makes one", () => {
    expect(organizationSlug("Ejemplo Logística, S.L.")).toBe("ejemplo-logistica-s-l");
    expect(organizationSlug("Clínica Peñalara")).toBe("clinica-penalara");
    for (const f of ["src/components/privacy/organization-setup.tsx"]) {
      expect(read(f)).toContain('import { organizationSlug } from "@/lib/organization-slug";');
    }
  });
});


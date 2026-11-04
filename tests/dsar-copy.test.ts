// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Clarity fixes from a full walk of the app (12 Oct 2026): rights-request
 * screens offer no action the plan refuses, the public form names the
 * organisation and never doubles a full stop, the settings save is
 * confirmed, user-facing text gives no developer instructions, and module
 * names are in the reader's language.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { withoutFinalStop } from "@/lib/sentence";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("public rights-request form", () => {
  it("does not double the full stop after a name that ends with one", () => {
    expect(withoutFinalStop("Ejemplo Clínica, S.L.")).toBe("Ejemplo Clínica, S.L");
    expect(es.dsarPublic.form.closed.withoutContact.replace("{orgName}", withoutFinalStop("Ejemplo, S.L."))).toBe(
      "Ponte en contacto directamente con Ejemplo, S.L."
    );
    expect(withoutFinalStop("Acme Inc")).toBe("Acme Inc");
  });

  it("names the organisation under the seeded title", () => {
    const page = src("src/app/dsar/[orgSlug]/page.tsx");
    expect(page).toContain("formConfig.description === DEFAULT_INTAKE_TEXT.description");
    expect(es.dsarPublic.form.header.fallbackDescription).toContain("{orgName}");
    expect(en.dsarPublic.form.header.fallbackDescription).toContain("{orgName}");
  });
});

describe("rights requests open to every organisation", () => {
  it("always offers the buttons that add a request", () => {
    const list = src("src/app/(dashboard)/privacy/dsar/page.tsx");
    expect(list).not.toContain("canAdd");
    const form = src("src/app/(dashboard)/privacy/dsar/new/page.tsx");
    expect(form).not.toContain("dsar-new-addon-off");
  });

  it("has the words in both languages", () => {
    for (const m of [en, es]) {
      expect(m.dsarSettings.actions.saved.length).toBeGreaterThan(3);
    }
  });

  it("confirms a settings save", () => {
    expect(src("src/app/(dashboard)/privacy/dsar/settings/page.tsx")).toContain('toast.success(t("actions.saved"))');
  });
});

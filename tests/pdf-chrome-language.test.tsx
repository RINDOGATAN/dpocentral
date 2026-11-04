// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Every PDF's footer and empty-table line are in the report's language: the
 * disclaimer reuses the app footer's wording in that language.
 */
import { describe, expect, it } from "vitest";
import React from "react";
// The shared primitives read the language with AsyncLocalStorage (no React
// context in server routes), so a render inside withPdfLocale is enough.
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { withPdfLocale, PDF_CHROME, toPdfLocale } from "@/server/services/export/pdf-locale";
import { PageFooter, DataTable } from "@/server/services/export/pdf-styles";
import { PageFrame } from "@/server/services/export/design-system/primitives/PageFrame";
import { CategoryTable } from "@/server/services/export/design-system/primitives/CategoryTable";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("shared PDF wording", () => {
  it("uses the app footer's disclaimer in each language", () => {
    expect(PDF_CHROME.en.disclaimer).toBe(en.footer.disclaimer);
    expect(PDF_CHROME.es.disclaimer).toBe(es.footer.disclaimer);
  });

  it("maps any Spanish locale to Spanish and everything else to English", () => {
    expect(toPdfLocale("es")).toBe("es");
    expect(toPdfLocale("es-ES")).toBe("es");
    expect(toPdfLocale("en")).toBe("en");
    expect(toPdfLocale(undefined)).toBe("en");
  });

  it("writes the footers in Spanish inside a Spanish document", () => {
    const out = withPdfLocale("es", () => html(<>
      <PageFooter date="2026-10-12" />
      <PageFrame eyebrow="RAT" orgName="Ejemplo" date="2026-10-12"><></></PageFrame>
    </>));
    expect(out).toContain(es.footer.disclaimer);
    expect(out).toContain(es.pdf.chrome.generatedBy);
    expect(out).not.toContain("not legal advice");
  });

  it("writes empty tables in Spanish", () => {
    const out = withPdfLocale("es", () => html(<>
      <DataTable headers={["A"]} rows={[]} />
      <CategoryTable columns={[{ header: "A", width: 1 }]} rows={[]} />
    </>));
    expect(out).toContain(es.pdf.chrome.noRecords);
    expect(out).not.toContain("No records");
  });

  it("does not leak a language into a render outside it", async () => {
    await withPdfLocale("es", async () => {
      await Promise.resolve();
    });
    expect(html(<PageFooter date="2026-10-12" />)).toContain(en.footer.disclaimer);
  });

  it("keeps English without a language", () => {
    expect(html(<PageFooter date="2026-10-12" />)).toContain(en.footer.disclaimer);
  });
});

describe("cover", () => {
  it("writes the cover's date line and notice in Spanish", async () => {
    const { CoverPage } = await import("@/server/services/export/pdf-styles");
    const out = withPdfLocale("es", () => html(<CoverPage orgName="Ejemplo" title="Registro" date="2026-10-12" />));
    expect(out).toContain(es.pdf.common.confidentialBody);
    expect(out).toContain(es.pdf.common.generated.replace("{date}", "2026-10-12"));
    expect(out).not.toContain("CONFIDENTIAL. This document");
  });
});

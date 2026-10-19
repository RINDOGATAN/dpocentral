// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The processor contract (DPA) and the transfer impact assessment (TIA) are
 * rendered inside withPdfLocale, so the shared footer and cover lines are in
 * the contract's language: a Spanish contract no longer carries the English
 * disclaimer on every page.
 */

import { describe, it, expect, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const seen = vi.hoisted(() => ({ disclaimers: [] as string[] }));

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  const { pdfChrome } = await import("@/server/services/export/pdf-locale");
  return {
    ...actual,
    renderToBuffer: async () => {
      seen.disclaimers.push(pdfChrome().disclaimer);
      return Buffer.from("%PDF");
    },
  };
});

const SELECTIONS = {
  "scope-processing": "scope-standard",
  "processing-instructions": "instructions-standard",
  "subprocessor-approval": "subproc-general-30d",
  "data-transfer": "transfer-sccs",
  "security-measures": "security-annex",
  "breach-notification": "breach-72h",
  "data-subject-rights": "rights-standard",
  "audit-rights": "audit-reports",
  "data-deletion": "deletion-return-or-delete-60d",
  confidentiality: "confidentiality-standard",
  "liability-indemnification": "liability-2x",
  "breach-liability-cap": "breachcap-supercap-2x",
  "term-termination": "term-30d-cure",
  "governing-law-jurisdiction": "glj-es-madrid",
  "government-access-requests": "gov-access-full",
};

function input(language: "en" | "es") {
  return {
    facts: {
      "processing-purpose": "Sending marketing e-mails.",
      "data-categories": "contact-details",
      "processor-establishment": "US",
      "subprocessor-list": "AWS (hosting)",
    },
    selections: SELECTIONS,
    context: {
      language,
      effectiveDate: new Date("2026-10-19T00:00:00Z"),
      governingLaw: "SPAIN",
      controller: { name: "Ejemplo, S.L.", address: "Madrid", signatoryName: "Ana", signatoryTitle: "DPD" },
      processor: { name: "Mailer Inc.", address: "San Francisco" },
    },
  };
}

describe("the DPA and the TIA print the shared lines in the contract's language", () => {
  it("Spanish contract, Spanish footer; English contract, English footer", async () => {
    const { renderDpaPdf, renderTiaPdf } = await import("@/server/services/export/dpa/render");
    await renderDpaPdf(input("es") as never, "Org");
    await renderTiaPdf(input("es") as never, "Org");
    await renderDpaPdf(input("en") as never, "Org");
    expect(seen.disclaimers).toEqual([es.footer.disclaimer, es.footer.disclaimer, en.footer.disclaimer]);
  });
});

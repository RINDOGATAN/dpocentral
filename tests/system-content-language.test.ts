// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The records the app writes itself (the TODO.LAW processor, its transfer and
 * its ready-made TIA) are shown in the reader's language
 * (src/lib/system-content/): whatever language they were stored in, unedited
 * text reads in the reader's language, edited text reads as typed.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));

import { createSystemContentLocalizer } from "@/lib/system-content/localize";
import {
  currentReaderLanguage,
  localizeForReader,
  localizeSystemContent,
  withReaderLanguage,
} from "@/lib/system-content/runtime";
import { TODOLAW_LINKS, TODOLAW_PROCESSOR_TEXT } from "@/config/todolaw-processor-text";
import { TODOLAW_CHECKLIST, TODOLAW_TIA_TITLE } from "@/config/todolaw-transfer-assessment";
import { todoLawTiaResponses } from "@/server/services/todolaw-transfer-assessment";
import { createInnerTRPCContext, createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { sessionFor } from "./helpers";

type Lang = "en" | "es";

/** What the TODO.LAW writers store for an organisation opened in `lang`. */
function writtenRecords(lang: Lang) {
  const t = TODOLAW_PROCESSOR_TEXT[lang];
  const now = new Date("2026-10-26T10:00:00Z");
  return {
    vendor: {
      name: "TODO.LAW",
      description: t.description,
      metadata: { dpaUrl: TODOLAW_LINKS.dpa[lang], subprocessorsUrl: TODOLAW_LINKS.subprocessors[lang] },
      contracts: [
        {
          name: t.contractName("1.8"),
          description: t.contractDescription(TODOLAW_LINKS.subprocessors[lang]),
          documentUrl: TODOLAW_LINKS.dpa[lang],
          startDate: now,
        },
      ],
    },
    transfer: {
      name: t.transferName,
      description: t.transferDescription,
      safeguards: t.safeguards,
      metadata: {
        checklist: Object.fromEntries(
          Object.entries(TODOLAW_CHECKLIST).map(([id, a]) => [id, { state: a.state, note: a.note[lang] }]),
        ),
      },
    },
    assessment: {
      name: TODOLAW_TIA_TITLE[lang].name,
      description: TODOLAW_TIA_TITLE[lang].description,
      responses: todoLawTiaResponses(lang, now),
    },
  };
}

describe("TODO.LAW records read in the reader's language", () => {
  for (const [stored, reader] of [
    ["es", "en"],
    ["en", "es"],
  ] as const) {
    it(`stored in ${stored}, read in ${reader}: every field matches what the writer stores in ${reader}`, () => {
      expect(localizeSystemContent(writtenRecords(stored), reader)).toEqual(writtenRecords(reader));
    });
  }

  for (const lang of ["en", "es"] as const) {
    it(`stored and read in ${lang}: unchanged, same object`, () => {
      const records = writtenRecords(lang);
      expect(localizeSystemContent(records, lang)).toEqual(records);
    });
  }

  it("the Spanish view of a Spanish record is exactly the stored Spanish text", () => {
    const es = writtenRecords("es");
    const shown = localizeSystemContent(es, "es");
    expect(shown.assessment.name).toBe("EIT: TODO.LAW (acceso desde Estados Unidos)");
    expect(shown.transfer.name).toBe("TODO.LAW: acceso desde Estados Unidos");
    expect(shown).toBe(es);
  });

  it("an English reader sees the TIA title and choices in English", () => {
    const shown = localizeSystemContent(writtenRecords("es"), "en");
    expect(shown.assessment.name).toBe("TIA: TODO.LAW (access from the United States)");
    const basis = shown.assessment.responses.find((r) => r.questionId === "tiav2_1_1");
    expect(basis?.response).toBe("Standard Contractual Clauses (Art. 46)");
  });

  it("an edited field is shown as typed, in either language", () => {
    const records = writtenRecords("es");
    records.transfer.description = "Texto revisado por nuestro DPO.";
    records.assessment.responses[0] = { ...records.assessment.responses[0], response: "Nuestra propia respuesta" };
    const shown = localizeSystemContent(records, "en");
    expect(shown.transfer.description).toBe("Texto revisado por nuestro DPO.");
    expect(shown.assessment.responses[0].response).toBe("Nuestra propia respuesta");
    expect(shown.transfer.name).toBe("TODO.LAW: access from the United States");
  });

  it("dates and other objects are left as they are", () => {
    const shown = localizeSystemContent(writtenRecords("es"), "en");
    expect(shown.vendor.contracts[0].startDate).toBeInstanceOf(Date);
  });
});

describe("the generic localizer", () => {
  const l = createSystemContentLocalizer([
    {
      id: "test",
      texts: [{ en: "https://x.test/en", es: "https://x.test/es" }],
      patterns: [{ en: "Version {v}, see {link}", es: "Versión {v}, consulta {link}" }],
      questionOptions: { q1: [{ en: "Low", es: "Bajo" }, { en: "High", es: "Alto" }] },
    },
  ]);

  it("fills a pattern in the other language and swaps a known value inside it", () => {
    expect(l.text("Version 1.7, see https://x.test/en", "es")).toBe("Versión 1.7, consulta https://x.test/es");
  });

  it("leaves strings it does not know", () => {
    expect(l.text("Low", "es")).toBe("Low");
  });

  it("maps option labels only on answers to the pack's questions", () => {
    expect(l.deep({ questionId: "q1", response: ["Low", "High"] }, "es")).toEqual({ questionId: "q1", response: ["Bajo", "Alto"] });
    expect(l.deep({ questionId: "other", response: "Low" }, "es")).toEqual({ questionId: "other", response: "Low" });
  });

  it("returns the same reference when nothing changes", () => {
    const v = { a: ["x", { b: "y" }] };
    expect(l.deep(v, "en")).toBe(v);
  });
});

describe("the reader's language per request", () => {
  it("outside a request, values come back as stored", () => {
    const es = writtenRecords("es");
    expect(localizeForReader(es)).toBe(es);
    expect(currentReaderLanguage()).toBeNull();
  });

  it("inside one, values come back in its language", () => {
    const shown = withReaderLanguage("en", () => localizeForReader(writtenRecords("es")));
    expect(shown.transfer.name).toBe("TODO.LAW: access from the United States");
  });

  const router = createTRPCRouter({ lang: protectedProcedure.query(() => currentReaderLanguage()) });
  const call = (cookies: Record<string, string>, acceptLanguage: string | null) =>
    router
      .createCaller(
        createInnerTRPCContext({ session: sessionFor("u1"), getCookie: (n) => cookies[n], acceptLanguage }),
      )
      .lang();

  it("a signed-in call reads in the cookie's language", async () => {
    expect(await call({ locale: "en" }, "es-ES,es;q=0.9")).toBe("en");
    expect(await call({ locale: "es" }, "en-US")).toBe("es");
  });

  it("without a cookie, the browser's language, else English, as the interface", async () => {
    expect(await call({}, "es-ES,es;q=0.9")).toBe("es");
    expect(await call({}, "fr-FR")).toBe("en");
    expect(await call({}, null)).toBe("en");
  });
});

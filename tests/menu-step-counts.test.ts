// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The menu's status line for the inventory, activities and vendors steps
 * states counts ("1 confirmed, 2 in draft") instead of the word "draft".
 * The tick and the programme figure keep their rule, unchanged: held here
 * too, so a change to the line cannot move them.
 */

import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { evaluateRegister, registerFor, stepRecordCounts, type DocumentFacts } from "@/config/document-register";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, programFigure } from "@/components/guided/path";
import { recordCountsText, stepNoteText } from "@/components/guided/document-words";
import { registerRows, stepDocumentRows } from "@/lib/programme-overview";

const tr = (locale: "en" | "es") =>
  createTranslator({
    locale,
    messages: locale === "en" ? en : es,
    namespace: "documentRegister",
  } as never) as unknown as (key: string, values?: Record<string, string | number>) => string;

const facts = (over: Partial<DocumentFacts>): DocumentFacts => ({
  ...EMPTY_PATH_COUNTS,
  activitiesIncomplete: 0,
  dpiaAssessments: 0,
  dpiaApproved: 0,
  dpiaAccess: "available",
  dpaContracts: 0,
  incidentsMissingImpact: 0,
  incidentNotifications: 0,
  aiAssistOn: false,
  dsarCompleted: 0,
  ...over,
});

const line = (f: DocumentFacts, stepId: string, locale: "en" | "es") => {
  const docs = evaluateRegister(registerFor({ dsarEnabled: true }), f);
  const rows = stepDocumentRows(DPO_CENTRAL_PATH, evaluatePath(DPO_CENTRAL_PATH, f), docs)[stepId] ?? [];
  return stepNoteText(tr(locale), rows, stepRecordCounts(f));
};

const MIXED = facts({
  processingActivities: 3,
  processingActivitiesDrafts: 2,
  vendors: 3,
  vendorsDrafts: 2,
  dataAssets: 3,
  dataAssetsDrafts: 2,
});

describe("menu step lines state counts", () => {
  it("activities: one confirmed and two drafts reads exactly that, with the tick unchanged", () => {
    expect(line(MIXED, "ropa", "en")).toBe("Records of processing (ROPA) · 1 confirmed, 2 in draft");
    expect(line(MIXED, "ropa", "es")).toContain("· 1 confirmada, 2 en borrador");
    const statuses = evaluatePath(DPO_CENTRAL_PATH, MIXED);
    expect(statuses.ropa).toBe("done");
    expect(statuses.vendors).toBe("done");
    expect(statuses.dataInventory).toBe("done");
  });

  it("Spanish agrees in gender and number per step", () => {
    const t = tr("es");
    const c = (confirmed: number) => ({ confirmed, drafts: 1, incomplete: 0 });
    expect(recordCountsText(t, "ropa", c(2))).toBe("2 confirmadas, 1 en borrador");
    expect(recordCountsText(t, "vendors", c(1))).toBe("1 confirmado, 1 en borrador");
    expect(recordCountsText(t, "vendors", c(2))).toBe("2 confirmados, 1 en borrador");
    expect(recordCountsText(t, "dataInventory", c(1))).toBe("1 confirmado, 1 en borrador");
    expect(recordCountsText(t, "dataInventory", c(2))).toBe("2 confirmados, 1 en borrador");
  });

  it("vendors: counts replace the word draft on the register only", () => {
    const text = line(MIXED, "vendors", "en");
    expect(text).toContain("Vendor register · 1 confirmed, 2 in draft");
    expect(text).toContain("DPA");
  });

  it("confirmed but incomplete records add their count", () => {
    const f = facts({ processingActivities: 4, processingActivitiesDrafts: 1, activitiesIncomplete: 1 });
    expect(line(f, "ropa", "en")).toContain("· 3 confirmed, 1 in draft, 1 with missing details");
    expect(line(f, "ropa", "es")).toContain("· 3 confirmadas, 1 en borrador, 1 con datos pendientes");
    const onlyIncomplete = facts({ processingActivities: 2, activitiesIncomplete: 1 });
    expect(line(onlyIncomplete, "ropa", "en")).toContain("· 2 confirmed, 1 with missing details");
  });

  it("only drafts: zero confirmed is stated", () => {
    const f = facts({ processingActivities: 2, processingActivitiesDrafts: 2 });
    expect(line(f, "ropa", "en")).toContain("· 0 confirmed, 2 in draft");
    expect(line(f, "ropa", "es")).toContain("· 0 confirmadas, 2 en borrador");
  });

  it("all confirmed keeps the existing done wording; none keeps the empty wording", () => {
    const done = facts({ processingActivities: 3, vendors: 2, dataAssets: 2 });
    expect(line(done, "ropa", "en")).toBe("Records of processing (ROPA) · ready");
    expect(line(done, "vendors", "en")).toContain("Vendor register · ready");
    expect(line(facts({}), "ropa", "en")).toContain("needs: a processing activity");
    expect(line(facts({}), "vendors", "en")).toContain("needs: a vendor");
  });

  it("the inventory step gets a line only while drafts wait", () => {
    const t = tr("en");
    const counts = stepRecordCounts(MIXED);
    expect(recordCountsText(t, "dataInventory", counts.dataInventory, { onlyIfDrafts: true })).toBe(
      "1 confirmed, 2 in draft",
    );
    expect(
      recordCountsText(t, "dataInventory", stepRecordCounts(facts({ dataAssets: 2 })).dataInventory, {
        onlyIfDrafts: true,
      }),
    ).toBeNull();
    expect(recordCountsText(t, "dataInventory", stepRecordCounts(facts({})).dataInventory)).toBeNull();
  });

  it("the programme figure is unchanged by the line", () => {
    const f = MIXED;
    const figure = programFigure(DPO_CENTRAL_PATH, evaluatePath(DPO_CENTRAL_PATH, f));
    expect(figure.confirmed).toBeGreaterThan(0);
    expect(registerRows(evaluateRegister(registerFor({ dsarEnabled: true }), f)).length).toBeGreaterThan(0);
  });
});

describe("Spanish acronym for the legitimate interest assessment", () => {
  it("is EIL in Spanish messages and LIA stays in English", () => {
    expect(JSON.stringify(es)).not.toMatch(/\bLIA\b(?!":)/);
    expect(JSON.stringify(es)).toContain("Evaluación del interés legítimo (EIL)");
    expect(JSON.stringify(es)).toContain('"LIA_short":"EIL"');
    expect(JSON.stringify(en)).toContain("Legitimate interest assessments (LIA)");
  });
});

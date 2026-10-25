// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import {
  checklistAnswersOf,
  checklistSection,
  checklistTarget,
  pendingChecklistItems,
  withChecklistAnswer,
} from "@/lib/transfer-checklist";
import { SCHREMS_II_CHECKLIST } from "@/config/transfer-compliance-rules";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

describe("Schrems II checklist answers", () => {
  it("keeps other metadata keys and replaces one answer", () => {
    const first = withChecklistAnswer({ source: "x" }, "s2_1_map_transfers", { state: "DONE", note: "ok" });
    const second = withChecklistAnswer(first, "s2_1_map_transfers", { state: "NA" });
    expect(second.source).toBe("x");
    expect(checklistAnswersOf(second)).toEqual({ s2_1_map_transfers: { state: "NA" } });
  });

  it("ignores malformed entries", () => {
    expect(checklistAnswersOf({ schremsChecklist: { a: { state: "MAYBE" }, b: "x", c: { state: "DONE" } } })).toEqual({
      c: { state: "DONE" },
    });
    expect(checklistAnswersOf(null)).toEqual({});
  });

  it("counts unanswered and pending items as pending", () => {
    const answers = { a: { state: "DONE" as const }, b: { state: "PENDING" as const }, c: { state: "NA" as const } };
    expect(pendingChecklistItems(["a", "b", "c", "d"], answers)).toEqual(["b", "d"]);
  });

  it("maps every item to a section and a place to act", () => {
    for (const item of SCHREMS_II_CHECKLIST) {
      expect(["know", "tool", "law", "measures", "procedural", "monitor"]).toContain(checklistSection(item.id));
      expect(["transfers", "edit", "measures", "tia"]).toContain(checklistTarget(item.id));
    }
    expect(checklistTarget("s2_4_measures_effective")).toBe("measures");
    expect(checklistTarget("s2_5_documentation")).toBe("tia");
  });

  it("has every item and measure in both languages", () => {
    for (const messages of [en, es]) {
      const detail = messages.pages.transfers.detail as unknown as {
        checklistItems: Record<string, { question: string; help: string }>;
        measures: Record<string, { name: string; description: string }>;
      };
      for (const item of SCHREMS_II_CHECKLIST) {
        expect(detail.checklistItems[item.id]?.question).toBeTruthy();
        expect(detail.checklistItems[item.id]?.help).toBeTruthy();
      }
    }
  });

  it("uses SCC, not CCT, in Spanish", () => {
    expect(JSON.stringify(es)).not.toMatch(/\bCCT\b/);
  });
});

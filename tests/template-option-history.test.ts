// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A choice is saved as the option text shown at the time. When the Spanish
 * wording of an option list is corrected, the earlier list is kept in
 * src/config/template-option-history.json so that answers saved before the
 * fix still match their option by position (display, conditions, progress,
 * export and the health ad-tech report).
 */

import { describe, it, expect } from "vitest";
import es from "@/messages/es.json";
import history from "@/config/template-option-history.json";
import { legacyOptionLists, legacySections, localizeValues } from "@/lib/template-i18n-core";

type Tree = Record<string, unknown>;
const read = (key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], (es as Tree).templates);

const entries = Object.entries((history as Record<string, Record<string, string[][]>>).es);

describe("template option history", () => {
  it("holds entries", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it("keeps each earlier list the same length as the current one, and different from it", () => {
    const bad = entries.filter(([key, lists]) => {
      const current = read(key);
      return !Array.isArray(current) || lists.some((l) => l.length !== current.length || JSON.stringify(l) === JSON.stringify(current));
    });
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it("shows an answer saved under the earlier wording as the current option", () => {
    for (const [key, lists] of entries) {
      const [type, , questionId] = key.split(".");
      const current = read(key) as string[];
      const old = lists[0];
      const i = old.findIndex((o, n) => o !== current[n]);
      expect(legacyOptionLists(type, questionId)).toEqual(lists);
      expect(localizeValues([old[i]], undefined, current)).toEqual([old[i]]);
      expect(localizeValues([old[i]], current, current, legacyOptionLists(type, questionId))).toEqual([current[i]]);
    }
  });

  it("offers the earlier lists to condition matching", () => {
    const [key, lists] = entries[0];
    const [type, , questionId] = key.split(".");
    const sections = [{ id: "s", title: "S", questions: [{ id: questionId, text: "Q", options: lists[0].map((_, i) => `en ${i}`) }] }];
    const legacy = legacySections(type, sections);
    expect(legacy.some((s) => JSON.stringify(s[0].questions?.[0].options) === JSON.stringify(lists[0]))).toBe(true);
  });
});

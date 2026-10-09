// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Cards a person clicks are buttons (F7 of the September browser round): the
 * quick start's path cards and industry template cards, the assessment type
 * and template cards, and the All clients cards are named in the
 * accessibility tree and reachable with the keyboard.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cardButton } from "@/lib/card-button";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const key = (k: string, sameTarget = true) => {
  const target = {};
  return {
    key: k,
    target,
    currentTarget: sameTarget ? target : {},
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLElement>;
};

describe("cardButton", () => {
  it("is a named, focusable button", () => {
    const props = cardButton(() => {}, { label: "Healthcare" });
    expect(props).toMatchObject({ role: "button", tabIndex: 0, "aria-label": "Healthcare" });
    expect("aria-pressed" in props).toBe(false);
  });

  it("says whether a choice is chosen", () => {
    expect(cardButton(() => {}, { label: "x", pressed: true })["aria-pressed"]).toBe(true);
    expect(cardButton(() => {}, { label: "x", pressed: false })["aria-pressed"]).toBe(false);
  });

  it("activates on click, Enter and Space, not on other keys", () => {
    const go = vi.fn();
    const props = cardButton(go, { label: "x" });
    props.onClick();
    props.onKeyDown(key("Enter"));
    props.onKeyDown(key(" "));
    props.onKeyDown(key("Tab"));
    expect(go).toHaveBeenCalledTimes(3);
  });

  it("leaves keys on a control inside the card to that control", () => {
    const go = vi.fn();
    cardButton(go, { label: "x" }).onKeyDown(key("Enter", false));
    expect(go).not.toHaveBeenCalled();
  });
});

/** Every <Card ...> that has a click handler in the file. */
function clickableCards(src: string): string[] {
  return (src.match(/<Card\b[\s\S]*?>/g) ?? []).filter((c) => /onClick=|cardButton\(/.test(c));
}

describe("the pages", () => {
  for (const file of [
    "src/app/(dashboard)/privacy/quickstart/page.tsx",
    "src/app/(dashboard)/privacy/assessments/new/page.tsx",
  ]) {
    it(`every clickable card is a card button in ${file}`, () => {
      const cards = clickableCards(read(file));
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card).toContain("cardButton(");
        expect(card).not.toMatch(/\bonClick=/);
      }
    });
  }

  it("the quick start's path and industry cards are all card buttons", () => {
    const cards = clickableCards(read("src/app/(dashboard)/privacy/quickstart/page.tsx"));
    // Recommended, vendor import, industry template, and one per template.
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it("a client row or card opens through a real button named by the client", () => {
    // The firm view (owner's decision d9): a table on wide screens, one card
    // per client on a phone; neither the row nor the card is clickable as a
    // whole, the client's name is the button.
    const src = read("src/app/(dashboard)/privacy/clients/page.tsx");
    for (const card of src.match(/<Card\b[\s\S]*?>/g) ?? []) expect(card).not.toMatch(/onClick=/);
    expect(src).not.toMatch(/<tr\b[^>]*onClick=/);
    expect(src).toMatch(/<button\s+type="button"\s+onClick=\{onOpen\}[\s\S]*?\{row\.name\}\s*<\/button>/);
  });
});

// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards guide in the landing's hosting section ("You choose where it lives" /
 * "Tú eliges dónde se aloja"), as on the storefront (todolaw PR #59): after the ways
 * boxes, closed by default, opens in place (no dialog, no new route), real radio buttons
 * with labels, the result announced, the recommended box marked, and a quiet bar on
 * phones. Spanish: three ways only, and no kit, hardware, "ejecut" or "$" in the guide.
 * English: the five ways.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import LandingSections from "@/landing/components/LandingSections";
import { COPY, QUESTIONS, optionsFor, type Locale } from "@/landing/content/safeguards";

const ROOT = path.resolve(__dirname, "..");
const dict = (l: Locale) =>
  JSON.parse(readFileSync(path.join(ROOT, `src/landing/i18n/${l}/dpo-startups.json`), "utf8")) as Record<string, string>;
const es = dict("es");
const en = dict("en");

beforeAll(() => {
  // framer-motion's whileInView needs an IntersectionObserver; jsdom has none.
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

const mount = (locale: Locale) => {
  const d = locale === "es" ? es : en;
  return render(<LandingSections t={(k) => d[k] ?? k} locale={locale} videos={[]} />);
};
const guide = (heading: string) => screen.getByRole("heading", { name: heading }).closest("section") as HTMLElement;
const waysSection = (locale: Locale) => document.querySelector(`section[aria-labelledby="${locale}.ways-heading"]`) as HTMLElement;
const boxes = (locale: Locale) => Array.from(waysSection(locale).querySelectorAll("article")) as HTMLElement[];
const marked = (locale: Locale) =>
  boxes(locale)
    .filter((a) => a.dataset.recommended === "true")
    .map((a) => a.querySelector("h3")?.textContent);

describe("safeguards guide, Spanish", () => {
  const c = COPY.es;

  it("is a closed section after the boxes, inside the hosting section, that opens in place", () => {
    mount("es");
    const g = guide(c.heading);
    expect(waysSection("es").contains(g)).toBe(true);
    // After the boxes.
    const last = boxes("es").at(-1)!;
    expect(last.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(g).queryAllByRole("radio")).toHaveLength(0);
    const toggle = within(g).getByRole("button", { name: c.open });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe(c.close);
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    // Six questions, each a group of labelled radio buttons; no "inside our office" in Spain.
    expect(within(g).getAllByRole("group")).toHaveLength(6);
    expect(within(g).getAllByRole("radio")).toHaveLength(QUESTIONS.reduce((n, q) => n + optionsFor(q, "es").length, 0));
    expect(within(g).getByRole("radio", { name: c.questions.loc.options.servers })).toBeTruthy();
    // The boxes are still the three Spanish ways.
    expect(boxes("es").map((a) => a.querySelector("h3")?.textContent)).toEqual([es["es.ways.w1.title"], es["es.ways.w2.title"], es["es.ways.w3.title"]]);
  });

  it("announces the result and marks the matching box", () => {
    mount("es");
    const g = guide(c.heading);
    fireEvent.click(within(g).getByRole("button", { name: c.open }));
    const status = within(g).getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain(c.empty);
    expect(marked("es")).toEqual([]);

    fireEvent.click(within(g).getByRole("radio", { name: c.questions.data.options.special }));
    expect(status.textContent).toContain(c.names.managed!);
    expect(marked("es")).toEqual([es["es.ways.w2.title"]]);

    fireEvent.click(within(g).getByRole("radio", { name: c.questions.loc.options.servers }));
    expect(status.textContent).toContain(c.names.deploy!);
    expect(marked("es")).toEqual([es["es.ways.w3.title"]]);
    const see = within(g).getByRole("link", { name: new RegExp(c.see) });
    expect(see.getAttribute("href")).toBe(`#${boxes("es")[2].id}`);

    fireEvent.click(within(g).getByRole("button", { name: c.reset }));
    expect(status.textContent).toContain(c.empty);
    expect(marked("es")).toEqual([]);

    // Closing the guide clears the mark.
    fireEvent.click(within(g).getAllByRole("radio", { name: c.questions.iso.options.yes })[0]); // question 4 (isolation)
    expect(marked("es")).toHaveLength(1);
    fireEvent.click(within(g).getByRole("button", { name: c.close }));
    expect(marked("es")).toEqual([]);
  });

  it("on phones keeps a quiet bar with the way's name and a link to the full result", () => {
    mount("es");
    const g = guide(c.heading);
    fireEvent.click(within(g).getByRole("button", { name: c.open }));
    expect(within(g).queryByTestId("safeguards-bar")).toBeNull();
    fireEvent.click(within(g).getByRole("radio", { name: c.questions.data.options.real }));
    const bar = within(g).getByTestId("safeguards-bar");
    expect(bar.className).toMatch(/\blg:hidden\b/);
    expect(bar.className).toMatch(/\bsticky\b/);
    expect(bar.textContent).toContain(c.names.managed!);
    // It does not announce: only the card's status is live.
    expect(bar.closest("[aria-live]")).toBeNull();
    expect(bar.querySelector("[aria-live], [role=status]")).toBeNull();
    expect(within(g).getAllByRole("status")).toHaveLength(1);
    const link = within(bar).getByRole("link", { name: c.seeResult });
    const card = document.getElementById(link.getAttribute("href")!.slice(1))!;
    expect(card.contains(within(g).getByRole("status"))).toBe(true);
    card.scrollIntoView = vi.fn();
    fireEvent.click(link);
    expect(card.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(card);
  });

  it("names the cloud as its box does, hosted in the EU, with the AI provider caveat", () => {
    mount("es");
    const g = guide(c.heading);
    fireEvent.click(within(g).getByRole("button", { name: c.open }));
    fireEvent.click(within(g).getByRole("radio", { name: c.questions.loc.options.any }));
    expect(within(g).getByRole("status").textContent).toContain(es["es.ways.w1.title"]);
    expect(g.textContent).toContain("Lo alojamos nosotros, en la UE.");
    expect(g.textContent).toContain("que puede estar fuera de la UE.");
    expect(waysSection("es").textContent).toContain("Garantías y alojamiento");
  });

  it("shows no kit, TODO.LAW Box, Docker, 'ejecut' or '$' in the guide with any answer chosen", () => {
    mount("es");
    const g = guide(c.heading);
    fireEvent.click(within(g).getByRole("button", { name: c.open }));
    // "Tu propio hardware" (the customer's own equipment) is allowed; the TODO.LAW Box is not.
    const bad = /\bkit\b|TODO\.LAW hardware|Hardware TODO\.LAW|Law-Firm-in-a-Box|\bBox\b|Docker|Instalador local|ejecut|\$|€/i;
    expect(g.textContent).not.toMatch(bad);
    for (const r of within(g).getAllByRole("radio")) {
      fireEvent.click(r);
      expect(g.textContent).not.toMatch(bad);
      expect(g.textContent).not.toMatch(/Estados Unidos/);
    }
    // The panel says why, without the classifier sentence; question 6 keeps its example.
    expect(within(g).getByText(c.whyP)).toBeTruthy();
    expect(g.textContent).not.toMatch(/clasificador/);
    expect(g.textContent).toContain("ISO 27001");
  });
});

describe("safeguards guide, English", () => {
  const c = COPY.en;

  it("keeps the five boxes and offers all five ways", () => {
    mount("en");
    expect(boxes("en")).toHaveLength(5);
    const g = guide(c.heading);
    expect(waysSection("en").contains(g)).toBe(true);
    fireEvent.click(within(g).getByRole("button", { name: c.open }));
    expect(within(g).getByRole("radio", { name: c.questions.loc.options.office })).toBeTruthy();
    const status = within(g).getByRole("status");
    const title = (n: number) => en[`en.ways.w${n}.title`];

    // The cloud.
    fireEvent.click(within(g).getByRole("radio", { name: c.questions.loc.options.any }));
    expect(status.textContent).toContain(title(1));
    expect(marked("en")).toEqual([title(1)]);

    // Managed.
    fireEvent.click(within(g).getByRole("radio", { name: c.questions.data.options.real }));
    expect(status.textContent).toContain(title(4));
    expect(marked("en")).toEqual([title(4)]);

    // The Box: inside the office, no IT team.
    fireEvent.click(within(g).getByRole("radio", { name: c.questions.loc.options.office }));
    fireEvent.click(within(g).getAllByRole("radio", { name: "No" })[0]); // question 4 has a longer "No"; this is the IT team's
    expect(status.textContent).toContain(title(3));
    expect(marked("en")).toEqual([title(3)]);
    expect(within(g).getByRole("link", { name: new RegExp(c.see) }).getAttribute("href")).toBe(`#${boxes("en")[2].id}`);

    // Deployment and training: own servers, no IT team.
    fireEvent.click(within(g).getByRole("radio", { name: c.questions.loc.options.servers }));
    expect(status.textContent).toContain(title(5));
    expect(marked("en")).toEqual([title(5)]);

    // The kit: own servers, an IT team.
    fireEvent.click(within(g).getAllByRole("radio", { name: "Yes" })[1]); // the IT team's "Yes"
    expect(status.textContent).toContain(title(2));
    expect(marked("en")).toEqual([title(2)]);
    expect(within(g).getByText(c.whyP)).toBeTruthy();
    expect(g.textContent).toContain("ISO 27001");
  });

  it("states no prices, no long dash and no US hosting in the guide", () => {
    mount("en");
    const g = guide(c.heading);
    fireEvent.click(within(g).getByRole("button", { name: c.open }));
    for (const r of within(g).getAllByRole("radio")) fireEvent.click(r);
    expect(g.textContent).not.toMatch(/[$€]|—|–/);
    expect(g.textContent).not.toMatch(/United States|classifier/);
  });

  it("is closed in the server-rendered page, so the page's links are unchanged", () => {
    mount("en");
    const g = guide(c.heading);
    expect(within(g).queryByRole("form")).toBeNull();
    expect(within(g).queryAllByRole("link")).toHaveLength(0);
  });
});

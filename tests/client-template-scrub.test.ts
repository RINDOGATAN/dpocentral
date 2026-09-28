// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The scrub (directive stage 2b, "Start from another client"): the source
 * client's name is replaced by the new client's; every other pointer at the
 * source is flagged, not copied silently. The names below are invented.
 */

import { describe, expect, it } from "vitest";
import { flagTerms, makeScrubber } from "@/lib/client-template/scrub";

const SOURCE = { name: "Northwind Holdings Ltd", domain: "northwind.example" };
const TARGET = "Bluefield Partners";

describe("replacing the source's name", () => {
  const { scrub } = makeScrubber(SOURCE, TARGET);

  it("replaces the full name in any letter case, as a whole phrase", () => {
    const r = scrub("This policy binds Northwind Holdings Ltd and NORTHWIND HOLDINGS LTD staff.");
    expect(r.text).toBe("This policy binds Bluefield Partners and Bluefield Partners staff.");
    expect(r.replaced).toBe(2);
    expect(r.flags).toEqual([]);
  });

  it("does not replace inside a longer word", () => {
    const r = makeScrubber({ name: "Quillon" }, TARGET).scrub("Quillonware is a supplier.");
    expect(r.text).toBe("Quillonware is a supplier.");
    expect(r.replaced).toBe(0);
  });

  it("leaves text without the source untouched", () => {
    const r = scrub("Staff must not paste personal data into public tools.");
    expect(r).toEqual({ text: "Staff must not paste personal data into public tools.", replaced: 0, flags: [] });
  });
});

describe("flagging the other pointers at the source", () => {
  const { scrub } = makeScrubber(SOURCE, TARGET);

  it("flags a short form of the name instead of changing it", () => {
    const r = scrub("Questions go to the Northwind legal team.");
    expect(r.text).toBe("Questions go to the Northwind legal team.");
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]).toMatchObject({ term: "Northwind", kind: "name" });
    expect(r.flags[0].snippet).toContain("Northwind legal team");
  });

  it("flags an e-mail address or web address on the source's domain, once", () => {
    const r = scrub("Write to privacy@northwind.example or see https://www.northwind.example/privacy.");
    expect(r.flags.map((f) => f.term)).toEqual(["northwind.example", "northwind.example"]);
    expect(r.flags.every((f) => f.kind === "domain")).toBe(true);
  });

  it("does not flag generic company words", () => {
    expect(flagTerms(SOURCE).map((t) => t.term)).not.toContain("holdings");
    expect(flagTerms(SOURCE).map((t) => t.term)).not.toContain("ltd");
    const r = scrub("Our holdings are listed; the Ltd is registered.");
    expect(r.flags).toEqual([]);
  });

  it("does not flag a word the new client's own name carries", () => {
    const { scrub: s } = makeScrubber({ name: "Northwind Retail" }, "Northwind Logistics");
    const r = s("Northwind Retail and Northwind share a policy.");
    expect(r.text).toBe("Northwind Logistics and Northwind share a policy.");
    expect(r.flags).toEqual([]);
  });

  it("ignores a public mail provider as a domain", () => {
    expect(flagTerms({ name: "Solo", domain: "gmail.com" }).filter((t) => t.kind === "domain")).toEqual([]);
  });
});

describe("scrubbing structured content", () => {
  it("scrubs every string inside a template's sections and keeps the shape", () => {
    const { scrubJson } = makeScrubber(SOURCE, TARGET);
    const sections = [
      {
        id: "s1",
        title: "Northwind Holdings Ltd context",
        questions: [
          { id: "q1", text: "Has Northwind approved this?", required: true },
          { id: "q2", text: "Who owns it?", options: ["Legal", "IT"] },
        ],
      },
    ];
    const r = scrubJson(sections);
    expect(r.value[0].title).toBe("Bluefield Partners context");
    expect(r.value[0].questions[0].required).toBe(true);
    expect(r.value[0].questions[1].options).toEqual(["Legal", "IT"]);
    expect(r.replaced).toBe(1);
    expect(r.flags.map((f) => f.term)).toEqual(["Northwind"]);
  });
});

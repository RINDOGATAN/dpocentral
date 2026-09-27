// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { resolveAutoTemplateId } from "../src/lib/assessment-template";

describe("resolveAutoTemplateId — a single template is chosen automatically", () => {
  it("auto-selects the sole template of a type", () => {
    expect(resolveAutoTemplateId("", [{ id: "only" }])).toBe("only");
  });

  it("shows the picker (returns empty) when more than one template exists", () => {
    expect(resolveAutoTemplateId("", [{ id: "a" }, { id: "b" }])).toBe("");
  });

  it("respects an explicit choice over the single-template default", () => {
    expect(resolveAutoTemplateId("chosen", [{ id: "only" }])).toBe("chosen");
    expect(resolveAutoTemplateId("b", [{ id: "a" }, { id: "b" }])).toBe("b");
  });

  it("returns empty while templates are loading or none exist", () => {
    expect(resolveAutoTemplateId("", undefined)).toBe("");
    expect(resolveAutoTemplateId("", null)).toBe("");
    expect(resolveAutoTemplateId("", [])).toBe("");
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * isIntakeConfigured tells an org that has actually set up its DSAR intake
 * from one that only carries the form we auto-seed at org creation. The Guided
 * rights step reads it (path-config.ts): a brand-new org stays "not started".
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTAKE_FORM,
  isIntakeConfigured,
  type IntakeFormShape,
} from "@/server/services/dsar/defaultIntakeForm";

/** The form exactly as ensureDefaultIntakeForm seeds it (nulls where unset). */
const pristine: IntakeFormShape = {
  slug: DEFAULT_INTAKE_FORM.slug,
  title: DEFAULT_INTAKE_FORM.title,
  description: DEFAULT_INTAKE_FORM.description,
  thankYouMessage: DEFAULT_INTAKE_FORM.thankYouMessage,
  privacyNoticeUrl: null,
  customCss: null,
  fields: [],
};

describe("isIntakeConfigured", () => {
  it("reads the auto-seeded default as NOT set up", () => {
    expect(isIntakeConfigured(pristine)).toBe(false);
  });

  it("counts any real change on the settings page as set up", () => {
    expect(isIntakeConfigured({ ...pristine, slug: "privacy-request" })).toBe(true);
    expect(isIntakeConfigured({ ...pristine, title: "Exercise your rights" })).toBe(true);
    expect(isIntakeConfigured({ ...pristine, description: "Tell us what you need" })).toBe(true);
    expect(isIntakeConfigured({ ...pristine, thankYouMessage: "We got it." })).toBe(true);
    expect(
      isIntakeConfigured({ ...pristine, privacyNoticeUrl: "https://example.com/privacy" }),
    ).toBe(true);
    expect(isIntakeConfigured({ ...pristine, customCss: ".intake-form{}" })).toBe(true);
    expect(isIntakeConfigured({ ...pristine, fields: [{ name: "reference" }] })).toBe(true);
  });

  it("ignores empty strings and an empty field list (still just the default)", () => {
    expect(
      isIntakeConfigured({ ...pristine, privacyNoticeUrl: "", customCss: "", fields: [] }),
    ).toBe(false);
  });
});

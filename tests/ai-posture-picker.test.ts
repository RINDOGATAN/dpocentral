// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { isPickerDisabled, isPostureSelectable, showPostureSave } from "@/lib/ai-posture-picker";

const base = { isAdmin: true, pending: false, usJurisdictionBlocked: true, posture: "cloud_us", dirty: false };

describe("AI posture picker for an organization that declares a US state", () => {
  it("offers only off", () => {
    expect(isPostureSelectable("off", true)).toBe(true);
    for (const p of ["cloud_us", "cloud_eu", "local_gateway"]) expect(isPostureSelectable(p, true)).toBe(false);
  });
  it("keeps the picker open while AI is still saved as on, so it can be switched off", () => {
    expect(isPickerDisabled(base)).toBe(false);
  });
  it("shows the save flow once off is chosen, and not for any other posture", () => {
    expect(showPostureSave({ ...base, posture: "off", dirty: true })).toBe(true);
    expect(showPostureSave({ ...base, posture: "cloud_us", dirty: true })).toBe(false);
  });
  it("disables the picker when AI is already off", () => {
    expect(isPickerDisabled({ ...base, posture: "off" })).toBe(true);
  });
});

describe("AI posture picker for other organizations", () => {
  const open = { ...base, usJurisdictionBlocked: false };
  it("offers every posture and the usual save flow", () => {
    for (const p of ["off", "cloud_us", "cloud_eu", "local_gateway"]) expect(isPostureSelectable(p, false)).toBe(true);
    expect(isPickerDisabled({ ...open, posture: "off" })).toBe(false);
    expect(showPostureSave({ ...open, dirty: true })).toBe(true);
  });
  it("is read-only for non-admins and while saving", () => {
    expect(isPickerDisabled({ ...open, isAdmin: false })).toBe(true);
    expect(isPickerDisabled({ ...open, pending: true })).toBe(true);
    expect(showPostureSave({ ...open, isAdmin: false, dirty: true })).toBe(false);
  });
});

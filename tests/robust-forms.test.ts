// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Create forms under real use:
 *
 * R1 a double click on a create button creates one record (the lock is taken
 *    synchronously, before the disabled state reaches the button)
 * R2 an expired session reads as a sentence with what to do, not "UNAUTHORIZED"
 * R3 name fields stop at the length the server accepts
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderHook } from "@testing-library/react";
import { useSubmitLock } from "@/lib/use-submit-lock";
import { sessionEndedMessage } from "@/lib/error-reference";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("R1: one submission at a time", () => {
  it("refuses a second acquire until released", () => {
    const { result } = renderHook(() => useSubmitLock());
    expect(result.current.acquire()).toBe(true);
    expect(result.current.acquire()).toBe(false);
    result.current.release();
    expect(result.current.acquire()).toBe(true);
  });

  it.each([
    ["src/app/(dashboard)/privacy/dsar/new/page.tsx", "submitLock"],
    ["src/app/(dashboard)/privacy/transfers/page.tsx", "submitLock"],
    ["src/app/(dashboard)/privacy/data-inventory/page.tsx", "activityLock"],
    ["src/app/(dashboard)/privacy/data-inventory/page.tsx", "transferLock"],
  ])("%s guards its create with %s", (file, lock) => {
    const src = read(file);
    expect(src).toContain(`if (!${lock}.acquire()) return;`);
    expect(src).toContain(`{ onSettled: ${lock}.release }`);
  });
});

describe("R2: an expired session", () => {
  it("is explained in both languages", () => {
    expect(sessionEndedMessage("en")).toMatch(/session has ended/);
    expect(sessionEndedMessage("es")).toMatch(/sesión ha terminado/);
    expect(sessionEndedMessage("es")).not.toMatch(/usted/i);
  });

  it("replaces the bare code in the tRPC error formatter", () => {
    const trpc = read("src/server/trpc.ts");
    expect(trpc).toContain('error.code === "UNAUTHORIZED"');
    expect(trpc).toContain("message = sessionEndedMessage(locale());");
  });
});

describe("R3: name length", () => {
  it.each([
    "src/app/(dashboard)/privacy/data-inventory/new/page.tsx",
    "src/app/(dashboard)/privacy/data-inventory/[id]/edit/page.tsx",
    "src/app/(dashboard)/privacy/data-inventory/activities/[id]/edit/page.tsx",
    "src/app/(dashboard)/privacy/data-inventory/page.tsx",
  ])("%s caps the name at the server's 200 characters", (file) => {
    expect(read(file)).toContain("maxLength={200}");
  });
});

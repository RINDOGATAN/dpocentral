// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it, vi } from "vitest";
import {
  maskEmail,
  maskName,
  maskedSupportView,
  supportReadDsar,
  type SupportDb,
} from "@/server/services/dsar/support-access";
import { parseArgs } from "../scripts/dsar-support-read";

const request = {
  id: "dsar-1",
  requesterName: "Maria Lopez",
  requesterEmail: "maria@example.com",
  requesterPhone: "+34 600 000 000",
  requesterAddress: null,
  description: "Please send me everything you hold about me, Maria Lopez.",
  requestedData: "All",
  responseNotes: null,
  communications: [{ id: "c1", subject: "About my data, Maria", direction: "OUTBOUND" }],
  status: "IN_PROGRESS",
};

function db(row: unknown = request) {
  const create = vi.fn(async () => ({}));
  const value: SupportDb = {
    dSARRequest: {
      findFirst: vi.fn(async () => ({ id: "dsar-1", organizationId: "org-a" })),
      findUnique: vi.fn(async () => row),
    },
    dSARAuditLog: { create },
  };
  return { value, create };
}

describe("support read masking", () => {
  it("masks names and e-mail addresses but keeps their shape", () => {
    expect(maskName("Maria Lopez")).toBe("M**** L****");
    expect(maskEmail("maria@example.com")).toBe("m****@e******.com");
  });

  it("shows no identity or content by default", async () => {
    const { value, create } = db();
    const out = (await supportReadDsar(value, { request: "dsar-1", operator: "op", reason: "ticket 1" })) as Record<
      string,
      unknown
    >;
    const text = JSON.stringify(out);
    expect(text).not.toContain("Maria");
    expect(text).not.toContain("maria@example.com");
    expect(text).not.toContain("600 000");
    expect(out.status).toBe("IN_PROGRESS");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({ identityShown: false, contentShown: false }),
        }),
      })
    );
  });

  it("shows identity or content only when asked, and records it", async () => {
    const { value, create } = db();
    const out = (await supportReadDsar(value, {
      request: "dsar-1",
      operator: "op",
      reason: "ticket 1",
      showIdentity: true,
    })) as Record<string, unknown>;
    expect(out.requesterEmail).toBe("maria@example.com");
    expect(String(out.description)).toMatch(/^\[hidden/);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ details: expect.objectContaining({ identityShown: true, contentShown: false }) }),
      })
    );
    const both = maskedSupportView(request, { showIdentity: true, showContent: true });
    expect(both.description).toBe(request.description);
  });

  it("parses the two flags", () => {
    expect(parseArgs(["--request", "R", "--by", "op", "--reason", "t", "--show-content"])).toEqual({
      request: "R",
      operator: "op",
      reason: "t",
      showContent: true,
    });
  });
});

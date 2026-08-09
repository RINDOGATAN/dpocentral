// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDealroomDeal,
  downloadDealroomDocument,
} from "@/lib/dealroom/intake-client";
import type { DealroomFactPackage } from "@/lib/dealroom/intake-types";

const PKG: DealroomFactPackage = {
  schema: "dealroom.solo-intake/1",
  contractType: "DPA",
  governingLaw: "SPAIN",
  dealName: "Acme DPA",
  selectionPolicy: "defaults",
  selections: { "breach-notification": "72h" },
  parameters: {
    "processing-purpose": "Providing the contracted service.",
    "data-categories": "contact-details",
    "processor-establishment": "US",
  },
};

describe("dealroom intake client", () => {
  beforeEach(() => {
    process.env.DEALROOM_API_KEY = "drk_test";
    process.env.DEALROOM_URL = "http://localhost:8486";
  });

  it("POSTs the fact package with auth and idempotency headers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        agentDealRoomId: "ad_1",
        status: "AGREED",
        unresolvedClauseIds: [],
        documents: { pdf: "/p", docx: "/d", txt: "/t", tia: "/x" },
      }),
    });
    const res = await createDealroomDeal(PKG, {
      idempotencyKey: "dpa-eng-42",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe("AGREED");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://localhost:8486/api/v1/agent/deals");
    expect(init.headers.Authorization).toBe("Bearer drk_test");
    expect(init.headers["Idempotency-Key"]).toBe("dpa-eng-42");
    expect(JSON.parse(init.body).contractType).toBe("DPA");
  });

  it("surfaces intake validation errors with details", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: "Invalid selections",
        details: { invalid: [{ clauseId: "x", wanted: "y", reason: "unknown option" }] },
      }),
    });
    await expect(
      createDealroomDeal(PKG, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/Invalid selections[\s\S]*unknown option/);
  });

  it("downloads documents with the white-label switch as a query param", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    await downloadDealroomDocument("/api/v1/agent/deals/ad_1/tia", {
      whiteLabel: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "http://localhost:8486/api/v1/agent/deals/ad_1/tia?whitelabel=1",
    );
  });

  it("refuses to run without an API key", async () => {
    delete process.env.DEALROOM_API_KEY;
    await expect(createDealroomDeal(PKG)).rejects.toThrow(/DEALROOM_API_KEY/);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One reference for a rights request. The requester and the staff read the
 * same short reference (REQ-ABC123 in English, SOL-ABC123 in Spanish), derived
 * from the request's publicId; the publicId itself stays the token of the
 * status link, which keeps the link unguessable. The acknowledgement mailer
 * reports whether a mail went out, so the thank-you screen says "sent" only
 * when it was.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: (locale === "es" ? es : en) as unknown as Record<string, unknown>,
      namespace,
    }),
}));

const PUBLIC_ID = "cmvx8e4zb006qi5i7nf58t8ep";

const input = {
  to: "jane@example.com",
  requesterName: "Jane Public",
  organizationName: "Acme",
  publicId: PUBLIC_ID,
  type: "ACCESS" as const,
  dueDate: new Date("2026-12-01T00:00:00Z"),
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the short reference", () => {
  it("is the same shape for a real request and for the decoy of a refused submission", async () => {
    const { formatRequestRef } = await import("@/lib/request-ref");
    const { decoyPublicId } = await import("@/server/services/dsar/public-intake-guard");
    expect(formatRequestRef(PUBLIC_ID, "en")).toBe("REQ-58T8EP");
    expect(formatRequestRef(PUBLIC_ID, "es")).toBe("SOL-58T8EP");
    expect(formatRequestRef(decoyPublicId(), "en")).toMatch(/^REQ-[A-Z0-9]{6}$/);
  });
});

describe("sendDSARConfirmationEmail", () => {
  it("resolves false and sends nothing when no mailer is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendDSARConfirmationEmail } = await import("@/server/services/dsar/sendConfirmationEmail");
    await expect(sendDSARConfirmationEmail(input)).resolves.toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.logger.warn).toHaveBeenCalled();
  });

  it("resolves true once the mail is handed to the mailer, with the short reference and the token link", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const { sendDSARConfirmationEmail } = await import("@/server/services/dsar/sendConfirmationEmail");
    await expect(sendDSARConfirmationEmail({ ...input, locale: "en" })).resolves.toBe(true);
    const html = (mocks.send.mock.calls[0] as [{ html: string }])[0].html;
    expect(html).toContain("REQ-58T8EP");
    expect(html).toContain(`/dsar/status/${PUBLIC_ID}`);
    // The raw id appears only inside the link, never as the reference.
    expect(html.replace(`/dsar/status/${PUBLIC_ID}`, "")).not.toContain(PUBLIC_ID);

    await expect(sendDSARConfirmationEmail({ ...input, locale: "es" })).resolves.toBe(true);
    const htmlEs = (mocks.send.mock.calls[1] as [{ html: string }])[0].html;
    expect(htmlEs).toContain("SOL-58T8EP");
  });

  it("resolves false when the mailer throws", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    mocks.send.mockRejectedValue(new Error("boom"));
    const { sendDSARConfirmationEmail } = await import("@/server/services/dsar/sendConfirmationEmail");
    await expect(sendDSARConfirmationEmail(input)).resolves.toBe(false);
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});

describe("the other requester-facing texts carry the same reference", () => {
  it("extension e-mail: short reference in the text, token in the link", async () => {
    const { renderExtensionEmail } = await import("@/server/services/dsar/sendExtensionEmail");
    const mail = renderExtensionEmail({
      requesterName: "Jane Public",
      organizationName: "Acme",
      publicId: PUBLIC_ID,
      newDueDate: new Date("2026-12-01T00:00:00Z"),
      locale: "en",
    });
    expect(mail.text).toContain("Reference number: REQ-58T8EP");
    expect(mail.text).toContain(`/dsar/status/${PUBLIC_ID}`);
  });

  it("model replies: the reference placeholder is the short reference", async () => {
    const { modelReplyValues } = await import("@/lib/dsar-model-replies");
    const facts = {
      requesterName: "Jane Public",
      publicId: PUBLIC_ID,
      receivedAt: new Date("2026-10-01T10:00:00Z"),
      dueDate: new Date("2026-11-01T10:00:00Z"),
      organizationName: "Acme",
      statusLink: `https://example.test/dsar/status/${PUBLIC_ID}`,
    };
    expect(modelReplyValues(facts, "en").reference).toBe("REQ-58T8EP");
    expect(modelReplyValues(facts, "es").reference).toBe("SOL-58T8EP");
    expect(modelReplyValues(facts, "en").status_link).toContain(PUBLIC_ID);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Model replies to rights requests:
 * the approved texts, chosen by type and language, the placeholders the app
 * fills, and the rule that a message still holding a placeholder is not sent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    dSARRequest: { findFirst: vi.fn(), update: vi.fn() },
    dSARCommunication: { create: vi.fn() },
  },
  sendCommunication: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({ sendDSARConfirmationEmail: vi.fn() }));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({
  sendDSARCommunicationEmail: mocks.sendCommunication,
}));

import { DSAR_MODEL_REPLIES, MODEL_REPLY_PLACEHOLDERS } from "@/config/dsar-model-replies";
import {
  fillModelReply,
  fillPlaceholders,
  letterDate,
  modelRepliesFor,
  modelReplyValues,
  remainingPlaceholders,
} from "@/lib/dsar-model-replies";
import { dsarRouter } from "@/server/routers/privacy/dsar";
import { callerFor, sessionFor } from "./helpers";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const placeholdersIn = (text: string) => [...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).sort();

describe("the approved texts", () => {
  it("are the six models: acknowledgement, identity, extension, refusal, one favourable reply per right, repetitive", () => {
    expect(DSAR_MODEL_REPLIES.map((r) => r.id)).toEqual([
      "acknowledgement",
      "identity",
      "extension",
      "refusal",
      "favourable-access",
      "favourable-rectification",
      "favourable-erasure",
      "favourable-erasure-blocked",
      "favourable-objection",
      "favourable-restriction",
      "favourable-portability",
      "repetitive",
    ]);
  });

  it("use only the known placeholders, the same ones in English and Spanish", () => {
    for (const r of DSAR_MODEL_REPLIES) {
      const enP = placeholdersIn(r.text.en.subject + r.text.en.body);
      const esP = placeholdersIn(r.text.es.subject + r.text.es.body);
      expect(esP, r.id).toEqual(enP);
      for (const p of enP) expect(MODEL_REPLY_PLACEHOLDERS).toContain(p);
    }
  });

  it("carry the approved wording (sample sentences, verbatim)", () => {
    const all = JSON.stringify(DSAR_MODEL_REPLIES);
    for (const sentence of [
      "We will answer within one month of receipt, that is, by {due_date}.",
      "Te responderemos en el plazo de un mes desde que la recibimos, es decir, a más tardar el {due_date}.",
      "Under Article 12(3) GDPR we are therefore extending the time limit. We will answer by {new_due_date} at the latest.",
      "Agencia Española de Protección de Datos, C/ Jorge Juan 6, 28001 Madrid; electronic office: sede.aepd.gob.es",
      "Los datos bloqueados no se usan para ningún fin",
      "Conforme al artículo 13.3 de la Ley Orgánica 3/2018 (LOPDGDD)",
    ]) {
      expect(all).toContain(sentence);
    }
  });

  it("open and close every favourable reply the same way", () => {
    for (const r of DSAR_MODEL_REPLIES.filter((x) => x.id.startsWith("favourable-"))) {
      expect(r.text.en.body.startsWith("Dear {requester_name},\n\nWe have dealt with your request of {received_date} (reference {reference}).")).toBe(true);
      expect(r.text.en.body.endsWith("Kind regards,\n{controller_name}")).toBe(true);
      expect(r.text.es.body.startsWith("Hola, {requester_name}:\n\nHemos atendido tu solicitud del {received_date} (referencia {reference}).")).toBe(true);
      expect(r.text.es.body.endsWith("Un saludo,\n{controller_name}")).toBe(true);
    }
  });

  it("have no long dash, and the Spanish addresses the requester as tú", () => {
    const all = JSON.stringify(DSAR_MODEL_REPLIES);
    expect(all).not.toContain("—");
    const spanish = DSAR_MODEL_REPLIES.map((r) => r.text.es.body).join(" ");
    expect(spanish).not.toMatch(/\busted(es)?\b/i);
  });

  it("have a name in both languages for the picker", () => {
    for (const r of DSAR_MODEL_REPLIES) {
      expect((en.pages.dsarDetail.modelReplies.names as Record<string, string>)[r.id]).toBeTruthy();
      expect((es.pages.dsarDetail.modelReplies.names as Record<string, string>)[r.id]).toBeTruthy();
    }
  });
});

describe("choosing by type", () => {
  const ids = (type: string) => modelRepliesFor(type).map((r) => r.id);

  it("offers the general models for every type, and the favourable reply of the request's right", () => {
    expect(ids("ACCESS")).toEqual(["acknowledgement", "identity", "extension", "refusal", "favourable-access", "repetitive"]);
    expect(ids("ERASURE")).toEqual([
      "acknowledgement",
      "identity",
      "extension",
      "refusal",
      "favourable-erasure",
      "favourable-erasure-blocked",
    ]);
    expect(ids("PORTABILITY")).toContain("favourable-portability");
    expect(ids("PORTABILITY")).not.toContain("repetitive");
    expect(ids("OTHER")).toEqual(["acknowledgement", "identity", "extension", "refusal"]);
  });
});

describe("filling", () => {
  const facts = {
    requesterName: "Ana García",
    publicId: "PUB-1",
    receivedAt: new Date("2026-10-01T10:00:00Z"),
    dueDate: new Date("2026-11-01T10:00:00Z"),
    organizationName: "Acme SL",
    statusLink: "https://dpocentral.todo.law/dsar/status/PUB-1",
    privacyContact: "privacidad@acme.example",
  };

  it("fills what the app knows and leaves the rest for staff", () => {
    const reply = DSAR_MODEL_REPLIES.find((r) => r.id === "acknowledgement")!;
    const filled = fillModelReply(reply, "es", modelReplyValues(facts, "es"));
    expect(filled.subject).toBe("Hemos recibido tu solicitud (PUB-1)");
    expect(filled.body).toContain("Hola, Ana García:");
    expect(filled.body).toContain("Recibimos tu solicitud el 1 de octubre de 2026.");
    expect(filled.body).toContain("a más tardar el 1 de noviembre de 2026.");
    expect(filled.body).toContain("aquí: https://dpocentral.todo.law/dsar/status/PUB-1.");
    expect(filled.body).toContain("escríbenos a privacidad@acme.example.");
    expect(filled.body.endsWith("Un saludo,\nAcme SL")).toBe(true);
    expect(remainingPlaceholders(filled.subject, filled.body)).toEqual([]);
  });

  it("leaves the free text placeholders, and the privacy contact when none is set", () => {
    const reply = DSAR_MODEL_REPLIES.find((r) => r.id === "refusal")!;
    const filled = fillModelReply(reply, "en", modelReplyValues({ ...facts, privacyContact: null }, "en"));
    expect(filled.body).toContain("We have examined your request of 1 October 2026 (reference PUB-1).");
    expect(remainingPlaceholders(filled.subject, filled.body)).toEqual(["{reasons}", "{privacy_contact}"]);
  });

  it("fills the extension date once the deadline is extended, with the first period's end as the due date", () => {
    const extended = {
      ...facts,
      dueDate: new Date("2027-01-01T10:00:00Z"),
      extendedDueDate: new Date("2027-01-01T10:00:00Z"),
      originalDueDate: "2026-11-01T10:00:00.000Z",
    };
    const v = modelReplyValues(extended, "en");
    expect(v.new_due_date).toBe("1 January 2027");
    expect(v.due_date).toBe("1 November 2026");
    const notYet = modelReplyValues(facts, "en");
    expect(notYet.new_due_date).toBeUndefined();
    const reply = DSAR_MODEL_REPLIES.find((r) => r.id === "extension")!;
    expect(remainingPlaceholders(fillModelReply(reply, "en", notYet).body)).toEqual(["{reasons}", "{new_due_date}"]);
  });

  it("leaves a placeholder whose value is empty", () => {
    expect(fillPlaceholders("{requester_name} {reference}", { requester_name: " ", reference: "R" })).toBe("{requester_name} R");
    expect(letterDate(null, "en")).toBeUndefined();
  });

  it("finds only known placeholders, each once", () => {
    expect(remainingPlaceholders("{reasons} and {reasons}", "{x} {details}")).toEqual(["{reasons}", "{details}"]);
  });
});

describe("sending", () => {
  function caller() {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue({
      id: "m",
      userId: "user-a",
      organizationId: "org-a",
      role: "OWNER",
      organization: { id: "org-a", name: "Acme", slug: "acme", pilotStartedAt: new Date() },
      user: { locale: null },
    });
    return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<typeof dsarRouter.createCaller>;
  }
  const base = { organizationId: "org-a", dsarRequestId: "dsar-1", channel: "Email" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({
      id: "dsar-1",
      requesterEmail: "ana@example.com",
      requesterName: "Ana",
      publicId: "PUB-1",
      acknowledgedAt: new Date(),
      redactedAt: null,
      metadata: null,
      organization: { name: "Acme" },
    });
    mocks.prisma.dSARCommunication.create.mockResolvedValue({ id: "c-1" });
  });

  it("refuses a message to the requester that still holds a placeholder, in the subject or the body", async () => {
    await expect(
      caller().addCommunication({ ...base, direction: "OUTBOUND", subject: "Answer", content: "For these reasons: {reasons}." })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("placeholder") });
    await expect(
      caller().addCommunication({ ...base, direction: "OUTBOUND", subject: "({reference})", content: "Done." })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.dSARCommunication.create).not.toHaveBeenCalled();
    expect(mocks.sendCommunication).not.toHaveBeenCalled();
  });

  it("sends a completed reply", async () => {
    await caller().addCommunication({ ...base, direction: "OUTBOUND", subject: "Answer (PUB-1)", content: "Hello Ana, done." });
    expect(mocks.prisma.dSARCommunication.create).toHaveBeenCalled();
    expect(mocks.sendCommunication).toHaveBeenCalledOnce();
  });

  it("records an incoming message as it came, braces and all", async () => {
    await caller().addCommunication({ ...base, direction: "INBOUND", content: "My {details} are wrong" });
    expect(mocks.prisma.dSARCommunication.create).toHaveBeenCalled();
  });
});

/**
 * Public DSAR intake regression tests (dsar.submitPublic).
 *
 * The anonymous public request path must: accept a valid submission and file
 * it under exactly the organization named by orgSlug; reject malformed input
 * (bad email) before touching the database; and never create a request for an
 * organization that has no active intake form or does not exist (no
 * cross-tenant leakage — a request only ever lands under the resolved org's
 * id).
 *
 * Prisma and the confirmation-email side effect are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  // The shared counters (rate_limit_counters), kept in memory: one INSERT ...
  // ON CONFLICT per hit, keyed by bucket and window start.
  const counters = new Map<string, number>();
  return {
    counters,
    prisma: {
      organization: { findUnique: vi.fn() },
      dSARRequest: { create: vi.fn(), count: vi.fn(async () => 0) },
      dSARAuditLog: { create: vi.fn() },
      auditLog: { create: vi.fn(async () => ({})), count: vi.fn(async () => 0) },
      $queryRaw: vi.fn(async (_sql: TemplateStringsArray, key: string, start: Date) => {
        const k = `${key}|${start.toISOString()}`;
        const n = (counters.get(k) ?? 0) + 1;
        counters.set(k, n);
        return [{ count: n }];
      }),
    },
    sendConfirmation: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({
  sendDSARConfirmationEmail: mocks.sendConfirmation,
}));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({
  sendDSARCommunicationEmail: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { createInnerTRPCContext } from "@/server/trpc";
import { issueFormToken } from "@/server/services/dsar/public-intake-guard";
import { callerFor } from "./helpers";

const anon = () => callerFor(dsarRouter, null) as ReturnType<typeof dsarRouter.createCaller>;

/** A form loaded ten seconds ago, for `orgSlug`. */
const token = (orgSlug = "acme") => issueFormToken(orgSlug, new Date(Date.now() - 10_000));

const validSubmission = () => ({
  orgSlug: "acme",
  type: "ACCESS" as const,
  requesterName: "Jane Public",
  requesterEmail: "jane@example.com",
  formToken: token(),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.counters.clear();
  mocks.prisma.dSARAuditLog.create.mockResolvedValue({});
  mocks.sendConfirmation.mockResolvedValue(undefined);
});

it("accepts a valid public submission and files it under the named org", async () => {
  mocks.prisma.organization.findUnique.mockResolvedValue({
    id: "org-acme",
    name: "Acme",
    slug: "acme",
    dsarIntakeForms: [{ id: "form-1", isActive: true }],
    jurisdictions: [{ isPrimary: true, jurisdiction: { dsarDeadlineDays: 30 } }],
  });
  mocks.prisma.dSARRequest.create.mockResolvedValue({
    id: "req-1",
    publicId: "DSAR-PUBLIC-1",
  });

  const result = await anon().submitPublic(validSubmission());

  expect(result).toEqual({ publicId: "DSAR-PUBLIC-1", acknowledgementSent: true });
  // Filed under the resolved org, submitted status — no cross-tenant target.
  expect(mocks.prisma.dSARRequest.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-acme",
        status: "SUBMITTED",
        requesterEmail: "jane@example.com",
      }),
    })
  );
  expect(mocks.sendConfirmation).toHaveBeenCalledOnce();
});

it("rejects a malformed submission (invalid email) before any DB write", async () => {
  await expect(
    anon().submitPublic({ ...validSubmission(), requesterEmail: "not-an-email" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });

  expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});

it("rejects an empty requester name", async () => {
  await expect(
    anon().submitPublic({ ...validSubmission(), requesterName: "" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});

it("does not create a request for an unknown org", async () => {
  mocks.prisma.organization.findUnique.mockResolvedValue(null);

  await expect(
    anon().submitPublic({ ...validSubmission(), orgSlug: "does-not-exist", formToken: token("does-not-exist") })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});

it("does not create a request for an org with no active intake form", async () => {
  mocks.prisma.organization.findUnique.mockResolvedValue({
    id: "org-acme",
    name: "Acme",
    slug: "acme",
    dsarIntakeForms: [], // intake not enabled
    jurisdictions: [],
  });

  await expect(anon().submitPublic(validSubmission())).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
});

it("dates a portal request by the organisation's laws when none is marked primary (California: 45 days)", async () => {
  const before = Date.now();
  mocks.prisma.organization.findUnique.mockResolvedValue({
    id: "org-acme",
    name: "Acme",
    slug: "acme",
    dsarIntakeForms: [{ id: "form-1", isActive: true }],
    jurisdictions: [{ isPrimary: false, jurisdiction: { code: "CCPA", dsarDeadlineDays: 45 } }],
  });
  mocks.prisma.dSARRequest.create.mockResolvedValue({ id: "req-2", publicId: "DSAR-PUBLIC-2" });

  await anon().submitPublic(validSubmission());

  const { data } = mocks.prisma.dSARRequest.create.mock.calls[0][0];
  const days = (data.dueDate.getTime() - data.receivedAt.getTime()) / 86_400_000;
  expect(Math.round(days)).toBe(45);
  expect(data.receivedAt.getTime()).toBeGreaterThanOrEqual(before);
  // The query reads every jurisdiction, not only a primary one.
  const query = mocks.prisma.organization.findUnique.mock.calls[0][0];
  expect(query.include.jurisdictions.where).toBeUndefined();
});

// ── Abuse protection (src/server/services/dsar/public-intake-guard.ts) ────

const ACME = {
  id: "org-acme",
  name: "Acme",
  slug: "acme",
  dsarIntakeForms: [{ id: "form-1", isActive: true }],
  jurisdictions: [],
};

/** A caller whose request came from `clientIp` (as the proxy reports it). */
const from = (clientIp: string | null) =>
  dsarRouter.createCaller(
    createInnerTRPCContext({ session: null, getCookie: () => undefined, clientIp })
  );

const counterKeys = () => [...mocks.counters.keys()].map((k) => k.split("|")[0]!);

describe("abuse protection on the public form", () => {
  let n = 0;
  beforeEach(() => {
    mocks.prisma.organization.findUnique.mockResolvedValue(ACME);
    mocks.prisma.dSARRequest.create.mockImplementation(async () => ({
      id: `req-${++n}`,
      publicId: `PUB-${n}`,
    }));
  });

  it("refuses a submission whose hidden field is filled, before reading the organisation", async () => {
    await expect(
      anon().submitPublic({ ...validSubmission(), website: "https://spam.example" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("could not accept") });
    expect(mocks.prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
    expect(counterKeys()).toContain("dsar-rejected:honeypot");
  });

  it("accepts an empty hidden field", async () => {
    await expect(anon().submitPublic({ ...validSubmission(), website: "" })).resolves.toMatchObject({
      publicId: expect.any(String),
    });
  });

  it("refuses a submission without a form token, or with a forged one", async () => {
    const { formToken: _t, ...noToken } = validSubmission();
    await expect(anon().submitPublic(noToken)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const [issued] = token().split(".");
    await expect(
      anon().submitPublic({ ...validSubmission(), formToken: `${issued}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
    expect(counterKeys().filter((k) => k === "dsar-rejected:token_invalid")).toHaveLength(1);
    expect(mocks.counters.get(`dsar-rejected:token_invalid|${dayStart()}`)).toBe(2);
  });

  it("refuses a token issued for another organisation's form", async () => {
    await expect(
      anon().submitPublic({ ...validSubmission(), formToken: token("other-org") })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.dSARRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a form sent less than three seconds after it loaded (minimum fill time)", async () => {
    await expect(
      anon().submitPublic({ ...validSubmission(), formToken: issueFormToken("acme", new Date(Date.now() - 1_000)) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("take a moment") });
    await expect(
      anon().submitPublic({ ...validSubmission(), formToken: issueFormToken("acme", new Date(Date.now() - 3_500)) })
    ).resolves.toMatchObject({ publicId: expect.any(String) });
  });

  it("refuses a form loaded more than a day ago", async () => {
    await expect(
      anon().submitPublic({
        ...validSubmission(),
        formToken: issueFormToken("acme", new Date(Date.now() - 25 * 60 * 60 * 1000)),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("reload the page") });
    expect(counterKeys()).toContain("dsar-rejected:token_expired");
  });

  it("hands the form a token that is accepted once the minimum fill time has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T10:00:00Z"));
    const form = await anon().getPublicForm({ orgSlug: "acme" });
    vi.setSystemTime(new Date("2026-10-11T10:00:05Z"));
    await expect(
      anon().submitPublic({ ...validSubmission(), formToken: form.formToken })
    ).resolves.toMatchObject({ publicId: expect.any(String) });
    vi.useRealTimers();
  });

  it("limits one client address to 10 submissions a day, shared across instances, and not other addresses", async () => {
    for (let i = 0; i < 10; i++) {
      await from("203.0.113.7").submitPublic({ ...validSubmission(), requesterEmail: `p${i}@example.com` });
    }
    await expect(
      from("203.0.113.7").submitPublic({ ...validSubmission(), requesterEmail: "p11@example.com" })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mocks.prisma.dSARRequest.create).toHaveBeenCalledTimes(10);
    await expect(
      from("198.51.100.4").submitPublic({ ...validSubmission(), requesterEmail: "other@example.com" })
    ).resolves.toMatchObject({ publicId: expect.any(String) });
    expect(counterKeys()).toContain("dsar-rejected:ip_limit");
    expect(counterKeys()).toContain("dsar-rejected:ip_limit:org:org-acme");
  });

  it("applies no address limit when no proxy reported an address", async () => {
    for (let i = 0; i < 12; i++) {
      await from(null).submitPublic({ ...validSubmission(), requesterEmail: `q${i}@example.com` });
    }
    expect(mocks.prisma.dSARRequest.create).toHaveBeenCalledTimes(12);
    expect(counterKeys().some((k) => k.startsWith("dsar-ip:"))).toBe(false);
  });

  it("limits one organisation to 50 public submissions a day, from any address", async () => {
    for (let i = 0; i < 50; i++) {
      await from(`10.0.${Math.floor(i / 5)}.${i}`).submitPublic({
        ...validSubmission(),
        requesterEmail: `r${i}@example.com`,
      });
    }
    await expect(
      from("10.9.9.9").submitPublic({ ...validSubmission(), requesterEmail: "r51@example.com" })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: expect.stringContaining("unusual number") });
    expect(mocks.prisma.dSARRequest.create).toHaveBeenCalledTimes(50);
  });

  it("starts the daily count again the next day (UTC)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T23:59:00Z"));
    for (let i = 0; i < 10; i++) {
      await from("203.0.113.8").submitPublic({ ...validSubmission(), requesterEmail: `s${i}@example.com` });
    }
    await expect(from("203.0.113.8").submitPublic(validSubmission())).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    vi.setSystemTime(new Date("2026-10-12T00:01:00Z"));
    await expect(from("203.0.113.8").submitPublic(validSubmission())).resolves.toMatchObject({
      publicId: expect.any(String),
    });
    vi.useRealTimers();
  });

  it("sends at most three acknowledgements a day to one address, across organisations; the request still stands", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      // Different organisations, different case: one recipient.
      const slug = `org-${i}`;
      mocks.prisma.organization.findUnique.mockResolvedValueOnce({ ...ACME, id: `org-${i}`, slug });
      results.push(
        await anon().submitPublic({
          ...validSubmission(),
          orgSlug: slug,
          formToken: token(slug),
          requesterEmail: i === 3 ? "Victim@Example.com" : "victim@example.com",
        })
      );
    }
    expect(results.map((r) => r.acknowledgementSent)).toEqual([true, true, true, false]);
    expect(mocks.prisma.dSARRequest.create).toHaveBeenCalledTimes(4);
    expect(mocks.sendConfirmation).toHaveBeenCalledTimes(3);
    expect(counterKeys()).toContain("dsar-ack-suppressed");
  });

  it("never puts the request description in the acknowledgement", async () => {
    await anon().submitPublic({
      ...validSubmission(),
      description: "My medical history at the clinic",
      requestedData: "All of it",
    });
    const [args] = mocks.sendConfirmation.mock.calls[0]!;
    expect(Object.keys(args).sort()).toEqual(
      ["dueDate", "locale", "organizationName", "publicId", "requesterName", "to", "type"].sort()
    );
    expect(JSON.stringify(args)).not.toContain("medical");
  });

  it("keeps no address as typed in the counters, and logs refusals without personal data", async () => {
    await from("203.0.113.9").submitPublic({ ...validSubmission(), requesterEmail: "secret.person@example.com" });
    await expect(
      anon().submitPublic({ ...validSubmission(), website: "x", requesterEmail: "secret.person@example.com" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const keys = counterKeys().join(" ");
    expect(keys).not.toContain("203.0.113.9");
    expect(keys).not.toContain("secret.person");
    expect(keys).not.toContain("example.com");
    const logged = JSON.stringify(mocks.logger.warn.mock.calls);
    expect(logged).toContain("honeypot");
    expect(logged).not.toContain("secret.person");
    expect(logged).not.toContain("Jane");
  });

  it("lets the request through when the counters cannot be written (fails open)", async () => {
    const counting = mocks.prisma.$queryRaw.getMockImplementation()!;
    mocks.prisma.$queryRaw.mockRejectedValue(new Error("connection reset"));
    await expect(from("203.0.113.10").submitPublic(validSubmission())).resolves.toEqual({
      publicId: expect.any(String),
      acknowledgementSent: true,
    });
    expect(mocks.logger.error).toHaveBeenCalled();
    mocks.prisma.$queryRaw.mockImplementation(counting);
  });
});

/** The current UTC day's window start, as the counter keys carry it. */
function dayStart(): string {
  const now = Date.now();
  return new Date(Math.floor(now / 86_400_000) * 86_400_000).toISOString();
}

it("stays open to every address: the e-mail policy never applies to the rights-request form", async () => {
  mocks.prisma.organization.findUnique.mockResolvedValue({
    id: "org-acme",
    name: "Acme",
    slug: "acme",
    dsarIntakeForms: [{ id: "form-1", isActive: true }],
    jurisdictions: [{ isPrimary: true, jurisdiction: { dsarDeadlineDays: 30 } }],
  });
  mocks.prisma.dSARRequest.create.mockResolvedValue({ id: "req-1", publicId: "DSAR-PUBLIC-1" });

  for (const requesterEmail of [
    "b.ake.r.miche.ll.eba.hpc.y.jx@gmail.com",
    "SOMEONE@HOTMAIL.COM",
    "x@aol.co.uk",
  ]) {
    mocks.counters.clear();
    await expect(anon().submitPublic({ ...validSubmission(), requesterEmail })).resolves.toMatchObject({
      publicId: "DSAR-PUBLIC-1",
    });
  }
});

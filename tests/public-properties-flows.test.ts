// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Client-side tools (web analytics, session replay, tag managers, consent
 * banners, ad pixels, experience platforms) collect on the organisation's
 * public website and apps, so the quick start draws their flow from the
 * "Public website and apps" record, and nothing onwards. Server-side tools
 * keep the flow from the internal systems. The record and its flows read in
 * the reader's language; the backfill moves only unedited quick-start flows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isClientSideCollection } from "@/config/client-side-collection";
import { VENDOR_QUICKSTART_TEXT } from "@/config/vendor-data-mappings-es";
import { createSystemContentLocalizer } from "@/lib/system-content/localize";
import { SYSTEM_CONTENT_PACKS } from "@/lib/system-content/runtime";
import { backfillPublicPropertiesFlows, findOrCreatePublicProperties } from "@/server/services/data-flows/public-properties";
import { buildNodesAndEdges, type AssetData, type FlowData } from "@/components/privacy/data-flow/useDataFlowGraph";

let seq = 0;
const made = (prefix: string) => async ({ data }: { data: Record<string, unknown> }) => ({ id: `${prefix}-${++seq}`, ...data });

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendor: { findMany: vi.fn(), create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendorCatalog: { findMany: vi.fn() },
    dataAsset: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    dataElement: { createMany: vi.fn() },
    processingActivity: { findMany: vi.fn(), create: vi.fn() },
    processingActivityAsset: { create: vi.fn() },
    dataFlow: { create: vi.fn(), findMany: vi.fn() },
    dataTransfer: { createMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    businessUnitMember: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { quickstartRouter } from "@/server/routers/privacy/quickstart";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };

const catalogRow = (slug: string, name: string, category: string, subcategory: string) => ({
  slug,
  name,
  legalName: name,
  category,
  subcategory,
  description: `${name} description`,
  website: `https://${slug}.example`,
  dataLocations: ["EU"],
  certifications: [],
  transferSafeguards: null,
  frameworks: [],
  gdprCompliant: true,
  privacyTechnologies: [],
  aiCapabilities: [],
  aiTechniques: [],
  euAiActRole: null,
  euAiActCompliant: null,
  iso42001Certified: null,
  aiModels: null,
  euAiActAnnexIIIDomains: [],
  tags: [],
});

describe("which tools collect on the public website and apps", () => {
  it.each([
    ["Analytics & BI", "Web Analytics"],
    ["Analytics & BI", "Session Replay & Heatmaps"],
    ["Analytics & BI", "Product Analytics"],
    ["Content Management", "CMS"],
    ["Developer Tools", "Tag Management"],
    ["Privacy & Consent", "Consent Management"],
    ["Advertising", "Social Ads"],
    ["Advertising", null],
    ["Personalization & Engagement", "A/B Testing"],
    ["Customer Support", "Live Chat"],
  ])("%s > %s is client-side", (category, sub) => {
    expect(isClientSideCollection(category, sub)).toBe(true);
  });

  it.each([
    ["CRM & Sales", "CRM Platform"],
    ["Analytics & BI", "Business Intelligence"],
    ["HR & People", "Payroll"],
    ["Cloud Infrastructure", "Cloud Platforms (IaaS)"],
    ["Customer Support", "Helpdesk"],
  ])("%s > %s keeps the flow from the internal systems", (category, sub) => {
    expect(isClientSideCollection(category, sub)).toBe(false);
  });
});

describe("quickstart.execute with a client-side and a server-side tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    seq = 0;
    const p = mocks.prisma;
    p.organizationMember.findUnique.mockResolvedValue({ id: "m-1", userId: "user-1", organizationId: ORG.id, role: "OWNER", organization: ORG });
    p.vendor.findMany.mockResolvedValue([]);
    p.vendor.create.mockImplementation(made("vendor"));
    p.vendorCatalog.findMany.mockResolvedValue([
      catalogRow("google-analytics", "Analytics Tool", "Analytics & BI", "Web Analytics"),
      catalogRow("crm-tool", "CRM Tool", "CRM & Sales", "CRM Platform"),
    ]);
    p.dataAsset.findMany.mockResolvedValue([]);
    p.dataAsset.findFirst.mockResolvedValue(null);
    p.dataAsset.create.mockImplementation(made("asset"));
    p.processingActivity.findMany.mockResolvedValue([]);
    p.processingActivity.create.mockImplementation(made("activity"));
    p.dataFlow.create.mockImplementation(made("flow"));
    p.dataFlow.findMany.mockResolvedValue([]);
    p.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(p));
  });

  async function run(locale: "en" | "es" = "en") {
    return callerFor(quickstartRouter, sessionFor("user-1")).execute({
      organizationId: ORG.id,
      vendorSlugs: ["google-analytics", "crm-tool"],
      locale,
    });
  }

  it("draws the analytics flow from the public website and apps, and nothing back", async () => {
    await run();
    const assets = mocks.prisma.dataAsset.create.mock.calls.map((c) => c[0].data);
    const flows = mocks.prisma.dataFlow.create.mock.calls.map((c) => c[0].data);
    const publicAsset = assets.find((a) => a.name === VENDOR_QUICKSTART_TEXT.en.publicPropertiesName);
    const internal = assets.find((a) => a.name === VENDOR_QUICKSTART_TEXT.en.internalSystemsName(ORG.name));
    expect(publicAsset).toBeTruthy();
    expect(publicAsset.type).toBe("APPLICATION");
    expect(internal).toBeTruthy();
    // Exactly one public-properties record.
    expect(assets.filter((a) => a.name === VENDOR_QUICKSTART_TEXT.en.publicPropertiesName)).toHaveLength(1);

    const analyticsFlows = flows.filter((f) => f.name.includes("Analytics Tool"));
    expect(analyticsFlows).toHaveLength(1);
    expect(analyticsFlows[0].name).toBe(VENDOR_QUICKSTART_TEXT.en.flowFromProperties("Analytics Tool"));
    // The public record's id: the asset created with that name.
    const created = await Promise.all(mocks.prisma.dataAsset.create.mock.results.map((r) => r.value));
    const publicId = created.find((a: { name: string }) => a.name === publicAsset.name).id;
    const internalId = created.find((a: { name: string }) => a.name === internal.name).id;
    expect(analyticsFlows[0].sourceAssetId).toBe(publicId);

    // The server-side tool keeps the flow from the internal systems.
    const crmFlows = flows.filter((f) => f.name.includes("CRM Tool"));
    expect(crmFlows.some((f) => f.sourceAssetId === internalId)).toBe(true);

    // No flow into the internal systems from the analytics tool.
    const analyticsAssetId = created.find((a: { name: string }) => a.name.startsWith("Analytics Tool")).id;
    expect(flows.some((f) => f.sourceAssetId === analyticsAssetId)).toBe(false);
  });

  it("links the analytics activity to the public record, not the internal systems", async () => {
    await run();
    const created = await Promise.all(mocks.prisma.dataAsset.create.mock.results.map((r) => r.value));
    const publicId = created.find((a: { name: string }) => a.name === VENDOR_QUICKSTART_TEXT.en.publicPropertiesName).id;
    const internalId = created.find((a: { name: string }) => a.name === VENDOR_QUICKSTART_TEXT.en.internalSystemsName(ORG.name)).id;
    const activities = await Promise.all(mocks.prisma.processingActivity.create.mock.results.map((r) => r.value));
    const links = mocks.prisma.processingActivityAsset.create.mock.calls.map((c) => c[0].data);
    const analyticsActivity = activities.find((a: { name: string }) => a.name.includes("Analytics Tool"));
    const crmActivity = activities.find((a: { name: string }) => a.name.includes("CRM Tool"));
    const linked = (activityId: string) => links.filter((l) => l.processingActivityId === activityId).map((l) => l.dataAssetId);
    expect(linked(analyticsActivity.id)).toContain(publicId);
    expect(linked(analyticsActivity.id)).not.toContain(internalId);
    expect(linked(crmActivity.id)).toContain(internalId);
  });

  it("writes the Spanish names on a Spanish screen", async () => {
    await run("es");
    const assets = mocks.prisma.dataAsset.create.mock.calls.map((c) => c[0].data);
    const flows = mocks.prisma.dataFlow.create.mock.calls.map((c) => c[0].data);
    expect(assets.some((a) => a.name === "Sitio web y aplicaciones públicas")).toBe(true);
    expect(flows.some((f) => f.name === VENDOR_QUICKSTART_TEXT.es.flowFromProperties("Analytics Tool"))).toBe(true);
  });

  it("reuses the public record an earlier run made, in either language", async () => {
    mocks.prisma.dataAsset.findFirst.mockImplementation(async ({ where }: { where: { OR?: unknown } }) =>
      where.OR ? { id: "public-existing", name: "Sitio web y aplicaciones públicas" } : null,
    );
    await run();
    const assets = mocks.prisma.dataAsset.create.mock.calls.map((c) => c[0].data);
    expect(assets.some((a) => a.name === VENDOR_QUICKSTART_TEXT.en.publicPropertiesName)).toBe(false);
    const flows = mocks.prisma.dataFlow.create.mock.calls.map((c) => c[0].data);
    expect(flows.find((f) => f.name.includes("Analytics Tool"))?.sourceAssetId).toBe("public-existing");
  });
});

describe("the public record reads in the reader's language", () => {
  const loc = createSystemContentLocalizer(SYSTEM_CONTENT_PACKS);
  it("translates the record and its flows both ways", () => {
    expect(loc.text("Public website and apps", "es")).toBe("Sitio web y aplicaciones públicas");
    expect(loc.text("Sitio web y aplicaciones públicas", "en")).toBe("Public website and apps");
    expect(loc.text(VENDOR_QUICKSTART_TEXT.es.flowFromProperties("Analytics Tool"), "en")).toBe(
      VENDOR_QUICKSTART_TEXT.en.flowFromProperties("Analytics Tool"),
    );
    expect(loc.text(VENDOR_QUICKSTART_TEXT.en.publicPropertiesDescription, "es")).toBe(
      VENDOR_QUICKSTART_TEXT.es.publicPropertiesDescription,
    );
  });
  it("leaves an edited name as typed", () => {
    expect(loc.text("Our public site www.example.com", "es")).toBe("Our public site www.example.com");
  });
  it("uses no long dashes", () => {
    for (const lang of ["en", "es"] as const) {
      const t = VENDOR_QUICKSTART_TEXT[lang];
      for (const s of [t.publicPropertiesName, t.publicPropertiesDescription, t.flowFromProperties("X"), t.flowFromPropertiesDescription("X")])
        expect(s).not.toMatch(/[–—]/);
    }
  });
});

describe("the map draws the public record as the start of the flow", () => {
  it("shows the public record and an edge to the tool", () => {
    const pub: AssetData = { id: "pub", name: "Public website and apps", type: "APPLICATION", isProduction: true };
    const tool: AssetData = { id: "ga", name: "Analytics Tool (Analytics & BI)", type: "THIRD_PARTY", isProduction: true };
    const f: FlowData = {
      id: "f1", name: "x", sourceAssetId: "pub", destinationAssetId: "ga", dataCategories: ["ONLINE_IDENTIFIERS"], isAutomated: true, sourceAsset: pub, destinationAsset: tool,
    };
    const { nodes, edges } = buildNodesAndEdges("all", undefined, [pub, tool], [f]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["ga", "pub"]);
    expect(edges.map((e) => [e.source, e.target])).toEqual([["pub", "ga"]]);
  });
});

describe("backfill of existing organisations", () => {
  const en = VENDOR_QUICKSTART_TEXT.en;
  function db(flows: Array<{ id: string; name: string; description: string | null; vendor: string }>) {
    const state = { flows: flows.map((f) => ({ ...f, sourceAssetId: "internal" })), links: [{ a: "act-ga", asset: "internal" }], publicCreated: 0 };
    const catalog: Record<string, [string, string]> = {
      "Analytics Tool": ["Analytics & BI", "Web Analytics"],
      "Replay Tool": ["Analytics & BI", "Session Replay & Heatmaps"],
      "CRM Tool": ["CRM & Sales", "CRM Platform"],
    };
    const d: Record<string, unknown> = {
      organization: { findMany: vi.fn(async () => [{ id: ORG.id, name: ORG.name }]) },
      vendorCatalog: {
        findFirst: vi.fn(async ({ where }: { where: { name: string } }) =>
          catalog[where.name] ? { category: catalog[where.name][0], subcategory: catalog[where.name][1] } : null,
        ),
      },
      dataAsset: {
        findMany: vi.fn(async () => [{ id: "internal" }]),
        findFirst: vi.fn(async () => (state.publicCreated ? { id: "pub", name: en.publicPropertiesName } : null)),
        create: vi.fn(async ({ data }: { data: { name: string } }) => {
          state.publicCreated++;
          return { id: "pub", name: data.name };
        }),
      },
      dataFlow: {
        findMany: vi.fn(async ({ where }: { where: { sourceAssetId?: { in: string[] }; metadata?: unknown } }) => {
          if (where.metadata) return [];
          return state.flows
            .filter((f) => where.sourceAssetId?.in.includes(f.sourceAssetId))
            .map((f) => ({ id: f.id, name: f.name, description: f.description, metadata: null, destinationAsset: { id: `asset-${f.vendor}`, vendor: f.vendor } }));
        }),
        count: vi.fn(async () => 0),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: { sourceAssetId: string; name: string } }) => {
          const f = state.flows.find((x) => x.id === where.id)!;
          f.sourceAssetId = data.sourceAssetId;
          f.name = data.name;
        }),
        deleteMany: vi.fn(async () => ({ count: 0 })),
        create: vi.fn(),
      },
      processingActivity: {
        findMany: vi.fn(async () => (state.links.some((l) => l.asset === "internal") ? [{ id: "act-ga" }] : [])),
        findFirst: vi.fn(async () => null),
      },
      processingActivityAsset: {
        deleteMany: vi.fn(async () => {
          state.links = state.links.filter((l) => l.asset !== "internal");
        }),
        upsert: vi.fn(async () => {
          state.links.push({ a: "act-ga", asset: "pub" });
        }),
      },
    };
    d.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(d));
    return { d, state };
  }

  const flows = [
    { id: "f-ga", name: en.flowTo("Analytics Tool"), description: en.flowToDescription("Analytics Tool"), vendor: "Analytics Tool" },
    { id: "f-replay-edited", name: "Our replay feed", description: null, vendor: "Replay Tool" },
    { id: "f-crm", name: en.flowTo("CRM Tool"), description: en.flowToDescription("CRM Tool"), vendor: "CRM Tool" },
  ];

  it("in a dry run, counts only the unedited client-side flow, and writes nothing", async () => {
    const { d, state } = db(flows);
    const rows = await backfillPublicPropertiesFlows(d, { execute: false });
    expect(rows).toEqual([{ organizationId: ORG.id, flows: 1, links: 1, returnFlowsKept: 0 }]);
    expect(state.publicCreated).toBe(0);
    expect(state.flows.every((f) => f.sourceAssetId === "internal")).toBe(true);
  });

  it("moves that flow and the activity link, then has nothing left to do", async () => {
    const { d, state } = db(flows);
    await backfillPublicPropertiesFlows(d, { execute: true });
    expect(state.flows.find((f) => f.id === "f-ga")).toMatchObject({ sourceAssetId: "pub", name: en.flowFromProperties("Analytics Tool") });
    expect(state.flows.find((f) => f.id === "f-replay-edited")?.sourceAssetId).toBe("internal");
    expect(state.flows.find((f) => f.id === "f-crm")?.sourceAssetId).toBe("internal");
    expect(state.links).toEqual([{ a: "act-ga", asset: "pub" }]);
    const again = await backfillPublicPropertiesFlows(d, { execute: true });
    expect(again).toEqual([]);
    expect(state.publicCreated).toBe(1);
  });
});

describe("findOrCreatePublicProperties", () => {
  it("creates the record once, in the given language", async () => {
    let made = 0;
    const tx = {
      dataAsset: {
        findFirst: vi.fn(async () => (made ? { id: "pub", name: "Sitio web y aplicaciones públicas" } : null)),
        create: vi.fn(async ({ data }: { data: { name: string } }) => {
          made++;
          return { id: "pub", name: data.name };
        }),
      },
    };
    const first = await findOrCreatePublicProperties(tx, ORG.id, "es");
    const second = await findOrCreatePublicProperties(tx, ORG.id, "en");
    expect(first).toEqual({ id: "pub", name: "Sitio web y aplicaciones públicas", created: true });
    expect(second.created).toBe(false);
    expect(made).toBe(1);
  });
});

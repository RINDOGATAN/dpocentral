// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Honest progress (the owner's decisions of 9 October 2026, step 2 of the
 * clarity work):
 *
 * - d2 Drafts count once confirmed: a record the quick start, a template or
 *   another client's copy made is "to confirm" until a person confirms it, and
 *   a step met only by drafts is never "done".
 * - d3 One programme figure ("2 of 10 steps confirmed"), computed in one place
 *   and shown identically on the dashboard, the menu, All clients and Reports;
 *   no "Strong / Moderate" label on partial data.
 * - d8 The quick start's first step asks where the organisation operates.
 * - Small items from the step-1 browser check: quick actions wrap, the
 *   incidents list shows the short INC- reference, the incident tabs wrap.
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS, type PathCounts } from "@/components/guided/path-config";
import { evaluatePath, overallProgress, programFigure, stageProgress } from "@/components/guided/path";
import { confirmDrafts, DRAFT_WHERE, DraftNotFoundError } from "@/server/services/template-items/drafts";
import { canConfirmDrafts, isDraftRecord } from "@/lib/drafts";
import { buildNeedsAction, NEEDS_ACTION_KINDS } from "@/lib/needs-action";
import { isPlaceCode, PLACE_CODES, placeOptions } from "@/config/jurisdiction-places";
import { JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { formatIncidentRef } from "@/lib/incident-ref";

const read = (path: string) => readFileSync(path, "utf8");
const statuses = (over: Partial<PathCounts>) => evaluatePath(DPO_CENTRAL_PATH, { ...EMPTY_PATH_COUNTS, ...over });

/** What a quick start with a template, two vendors and two places leaves behind. */
const AFTER_QUICKSTART: Partial<PathCounts> = {
  quickstartCompleted: true,
  jurisdictions: 2,
  dataAssets: 9,
  dataAssetsDrafts: 9,
  processingActivities: 7,
  processingActivitiesDrafts: 7,
  vendors: 3,
  vendorsDrafts: 3,
  transfers: 2,
  transfersDrafts: 2,
  assessments: 1,
  vendorAssessments: 1,
};

describe("d2: drafts count once confirmed", () => {
  it("a step met only by drafts reads 'to confirm', never 'done'", () => {
    const s = statuses(AFTER_QUICKSTART);
    expect(s.dataInventory).toBe("toConfirm");
    expect(s.ropa).toBe("toConfirm");
    expect(s.vendors).toBe("toConfirm");
    expect(s.transfers).toBe("toConfirm");
  });

  it("one confirmed record makes the step done", () => {
    const s = statuses({ ...AFTER_QUICKSTART, dataAssetsDrafts: 8, processingActivitiesDrafts: 6, vendorsDrafts: 2 });
    expect(s.dataInventory).toBe("done");
    expect(s.ropa).toBe("done");
    expect(s.vendors).toBe("done");
  });

  it("records a person entered count at once (no drafts)", () => {
    const s = statuses({ dataAssets: 1, vendors: 1, processingActivities: 1, transfers: 1 });
    expect(s.dataInventory).toBe("done");
    expect(s.vendors).toBe("done");
    expect(s.ropa).toBe("done");
    expect(s.transfers).toBe("done");
    // ... and the quick start counts as done when its work already exists.
    expect(s.quickstart).toBe("done");
  });

  it("drafted assets and vendors alone do not stand in for the quick start", () => {
    const s = statuses({ dataAssets: 2, dataAssetsDrafts: 2, vendors: 1, vendorsDrafts: 1 });
    expect(s.quickstart).toBe("started");
  });

  it("a stage holding drafts reads 'to confirm'", () => {
    const inventory = DPO_CENTRAL_PATH.stages.find((st) => st.id === "inventory")!;
    const p = stageProgress(inventory, statuses(AFTER_QUICKSTART));
    expect(p.state).toBe("toConfirm");
    expect(p.done).toBe(0);
  });

  it("a draft is AUTO_TEMPLATE with no confirmation date", () => {
    expect(DRAFT_WHERE).toEqual({ provenance: "AUTO_TEMPLATE", confirmedAt: null });
    expect(isDraftRecord({ provenance: "AUTO_TEMPLATE", confirmedAt: null })).toBe(true);
    expect(isDraftRecord({ provenance: "AUTO_TEMPLATE", confirmedAt: new Date() })).toBe(false);
    expect(isDraftRecord({ provenance: "USER_ENTERED", confirmedAt: null })).toBe(false);
  });

  it("only the owner, admins and privacy officers may confirm, as AI Sentinel's approvers", () => {
    expect(["OWNER", "ADMIN", "PRIVACY_OFFICER"].every(canConfirmDrafts)).toBe(true);
    expect(["MEMBER", "VIEWER", null, undefined].some(canConfirmDrafts)).toBe(false);
    const router = read("src/server/routers/privacy/drafts.ts");
    expect(router).toMatch(/confirm: officerProcedure/);
  });

  it("the quick start, templates and copies from another client write drafts", () => {
    const qs = read("src/server/routers/privacy/quickstart.ts");
    // Every record type the quick start creates is stamped AUTO_TEMPLATE,
    // the internal-systems asset included.
    const internal = qs.slice(qs.indexOf("Find or create the internal systems asset"));
    expect(internal.slice(0, 1500)).toMatch(/provenance: "AUTO_TEMPLATE"/);
    const copy = read("src/server/services/client-template/copy.ts");
    expect(copy.match(/\.\.\.CLIENT_TEMPLATE_DRAFT/g)?.length).toBe(3);
    expect(copy).toMatch(/provenance: "AUTO_TEMPLATE" as const,\s+sourceRef: "client-template"/);
  });

  it("the migration only rewrites provenance columns, and returns never-changed template rows to draft", () => {
    const sql = read("prisma/migrations/20261009120000_drafts_count_once_confirmed/migration.sql");
    const code = sql.replace(/--.*$/gm, "");
    expect(code).not.toMatch(/\b(DROP|DELETE|ALTER|TRUNCATE|CREATE)\b/i);
    expect(code).toMatch(/SET "confirmedAt" = NULL/);
    expect(code).toMatch(/"confirmedBy" IS NULL/);
    expect(code).toMatch(/"updatedAt" <= "createdAt" \+ INTERVAL '60 seconds'/);
    expect(code).toMatch(/'templateCopy'->>'pending' = 'true'/);
  });

  it("Needs action lists the drafts to confirm, linked to the review page", () => {
    expect(NEEDS_ACTION_KINDS).toContain("drafts-to-confirm");
    const items = buildNeedsAction({
      reviewDue: 0,
      dsarDue: 0,
      breachWindow: 0,
      assessmentApproval: 0,
      draftsToConfirm: 19,
    });
    expect(items).toEqual([{ kind: "drafts-to-confirm", count: 19, href: "/privacy/review" }]);
    for (const bundle of [en, es]) {
      expect(bundle.views.needsAction.kind["drafts-to-confirm"]).toBeTruthy();
      expect(bundle.views.needsAction.hint["drafts-to-confirm"]).toBeTruthy();
    }
  });

  it("every draft screen carries the Confirm action and the badge", () => {
    for (const page of [
      "src/app/(dashboard)/privacy/vendors/[id]/page.tsx",
      "src/app/(dashboard)/privacy/data-inventory/[id]/page.tsx",
      "src/app/(dashboard)/privacy/data-inventory/activities/[id]/page.tsx",
    ]) {
      const src = read(page);
      expect(src, page).toMatch(/<ConfirmDraftButton kind="/);
      expect(src, page).toMatch(/<DraftBadge record=/);
    }
    for (const page of ["src/app/(dashboard)/privacy/vendors/page.tsx", "src/app/(dashboard)/privacy/data-inventory/page.tsx"]) {
      const src = read(page);
      expect(src, page).toMatch(/<DraftsNotice \/>/);
      expect(src, page).toMatch(/<DraftBadge record=/);
    }
    const review = read("src/app/(dashboard)/privacy/review/page.tsx");
    expect(review).toMatch(/trpc\.drafts\.confirm\.useMutation/);
    expect(review).toMatch(/confirmSelected/);
    expect(review).toMatch(/selectAll/);
  });
});

/** An in-memory stand-in for the three tables and the audit log. */
function fakePrisma(rows: { kind: "dataAsset" | "processingActivity" | "vendor"; id: string; org: string; confirmedAt: Date | null; provenance?: string }[]) {
  const audit: unknown[] = [];
  const table = (kind: string) => ({
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const ids = (where.id as { in: string[] }).in;
      const hit = rows.filter(
        (r) =>
          r.kind === kind &&
          ids.includes(r.id) &&
          r.org === where.organizationId &&
          (r.provenance ?? "AUTO_TEMPLATE") === where.provenance &&
          r.confirmedAt === null,
      );
      return { count: hit.length, apply: () => hit.forEach((r) => (r.confirmedAt = data.confirmedAt as Date)) };
    }),
  });
  const tx = {
    dataAsset: table("dataAsset"),
    processingActivity: table("processingActivity"),
    vendor: table("vendor"),
    auditLog: { createMany: vi.fn(async ({ data }: { data: unknown[] }) => audit.push(...data)) },
  };
  return { prisma: { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) }, audit, tx };
}

describe("confirming drafts", () => {
  it("confirms several records at once and writes one CONFIRM audit entry each", async () => {
    const { prisma, audit } = fakePrisma([
      { kind: "dataAsset", id: "a1", org: "o1", confirmedAt: null },
      { kind: "processingActivity", id: "p1", org: "o1", confirmedAt: null },
      { kind: "vendor", id: "v1", org: "o1", confirmedAt: null },
    ]);
    const result = await confirmDrafts(prisma as never, {
      organizationId: "o1",
      userId: "u1",
      items: [
        { kind: "dataAsset", id: "a1" },
        { kind: "processingActivity", id: "p1" },
        { kind: "vendor", id: "v1" },
      ],
    });
    expect(result.confirmed).toBe(3);
    expect(audit).toHaveLength(3);
    expect(audit.every((e) => (e as { action: string }).action === "CONFIRM")).toBe(true);
  });

  it("is all or nothing: a record of another organisation, or one already confirmed, fails the whole request", async () => {
    const { prisma, audit } = fakePrisma([
      { kind: "dataAsset", id: "a1", org: "o1", confirmedAt: null },
      { kind: "dataAsset", id: "a2", org: "o2", confirmedAt: null },
    ]);
    await expect(
      confirmDrafts(prisma as never, {
        organizationId: "o1",
        userId: "u1",
        items: [
          { kind: "dataAsset", id: "a1" },
          { kind: "dataAsset", id: "a2" },
        ],
      }),
    ).rejects.toBeInstanceOf(DraftNotFoundError);
    expect(audit).toHaveLength(0);
  });

  it("filters on the organisation and on the draft condition", async () => {
    const { prisma, tx } = fakePrisma([{ kind: "vendor", id: "v1", org: "o1", confirmedAt: null }]);
    await confirmDrafts(prisma as never, { organizationId: "o1", userId: "u1", items: [{ kind: "vendor", id: "v1" }] });
    const where = tx.vendor.updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: "o1", provenance: "AUTO_TEMPLATE", confirmedAt: null });
    expect(tx.dataAsset.updateMany).not.toHaveBeenCalled();
  });
});

describe("d3: one programme figure", () => {
  it("after a quick start the figure stays low, with the drafts shown separately", () => {
    const figure = programFigure(DPO_CENTRAL_PATH, statuses(AFTER_QUICKSTART));
    expect(figure.total).toBe(10);
    // Set up is done (the quick start ran and asked where the organisation operates).
    expect(figure.confirmed).toBe(2);
    expect(figure.toConfirm).toBe(4);
    expect(figure.confirmed + figure.toConfirm + figure.started + figure.notStarted).toBe(figure.total);
  });

  it("confirming the drafts raises it", () => {
    const confirmed = { ...AFTER_QUICKSTART, dataAssetsDrafts: 0, processingActivitiesDrafts: 0, vendorsDrafts: 0, transfersDrafts: 0 };
    const figure = programFigure(DPO_CENTRAL_PATH, statuses(confirmed));
    expect(figure.confirmed).toBe(6);
    expect(figure.toConfirm).toBe(0);
  });

  it("is the same number the menu bar and the stage rings add up to", () => {
    const s = statuses(AFTER_QUICKSTART);
    const figure = programFigure(DPO_CENTRAL_PATH, s);
    expect(overallProgress(DPO_CENTRAL_PATH, s)).toEqual({ done: figure.confirmed, total: figure.total });
    const sum = DPO_CENTRAL_PATH.stages.reduce((n, st) => n + stageProgress(st, s).done, 0);
    expect(sum).toBe(figure.confirmed);
  });

  it("is shown with the same words in the four places", () => {
    for (const bundle of [en, es]) {
      expect(bundle.guided.figure.line).toMatch(/\{done\}.*\{total\}/);
    }
    expect(en.guided.figure.line).toBe("{done} of {total} steps confirmed");
    expect(es.guided.figure.line).toBe("{done} de {total} pasos confirmados");
    const menu = read("src/components/guided/path-menu.tsx");
    expect(menu).toMatch(/programFigure\(config, statuses\)/);
    expect(menu).toMatch(/t\("figure\.line"/);
    expect(menu).not.toMatch(/overallPercent/);
    const dashboard = read("src/components/guided/guided-dashboard.tsx");
    expect(dashboard).toMatch(/<ProgramFigureCard \/>/);
    const clients = read("src/app/(dashboard)/privacy/clients/page.tsx");
    expect(clients).toMatch(/<ProgramFigureLine figure=\{figure\}/);
    const reports = read("src/app/(dashboard)/privacy/reports/page.tsx");
    expect(reports).toMatch(/<ProgramFigureLine figure=\{figure\}/);
    const component = read("src/components/guided/program-figure.tsx");
    expect(component).toMatch(/programFigure\(DPO_CENTRAL_PATH, statuses\)/);
    expect(component).toMatch(/t\("figure\.line"/);
  });

  it("Reports gives the Strong / Moderate label only when every area has data", () => {
    const reports = read("src/app/(dashboard)/privacy/reports/page.tsx");
    expect(reports).toMatch(/coverage\.ratedModules === coverage\.totalModules/);
    const label = reports.indexOf('data-testid="reports-score-label"');
    const gate = reports.lastIndexOf("{fullCoverage ? (", label);
    expect(gate).toBeGreaterThan(0);
    expect(reports).toMatch(/score\.areasWithData/);
    expect(reports).not.toMatch(/function ScoreRing/);
  });

  it("the next step offers the review when its step is met only by drafts", () => {
    const card = read("src/components/guided/next-step-card.tsx");
    expect(card).toMatch(/=== "toConfirm"/);
    expect(card).toMatch(/href="\/privacy\/review"/);
  });
});

describe("d8: the quick start asks where the organisation operates", () => {
  it("offers every data-protection law of the catalog as a place, and no AI-governance entry", () => {
    expect(PLACE_CODES).not.toContain("EU_AI_ACT");
    const laws = JURISDICTION_CATALOG.filter((j) => j.category !== "ai_governance").map((j) => j.code);
    expect([...PLACE_CODES].sort()).toEqual([...laws].sort());
    expect(isPlaceCode("GDPR")).toBe(true);
    expect(isPlaceCode("NOPE")).toBe(false);
  });

  it("names each place in the reader's language", () => {
    const enOptions = placeOptions("en");
    const esOptions = placeOptions("es");
    expect(enOptions.find((o) => o.code === "CCPA")?.place).toBe("California");
    expect(enOptions.find((o) => o.code === "LGPD")?.place).toBe("Brazil");
    expect(esOptions.find((o) => o.code === "LGPD")?.place).toBe("Brasil");
    expect(esOptions.find((o) => o.code === "GDPR")?.place).toBe("Unión Europea");
    for (const o of [...enOptions, ...esOptions]) {
      expect(o.place, o.code).not.toMatch(/^[A-Z]{2}(-[A-Z]{2})?$/);
    }
    expect(new Set(enOptions.map((o) => o.group))).toEqual(new Set(["europe", "us", "other"]));
  });

  it("the first step carries the picker and saves the places it was given", () => {
    const qs = read("src/app/(dashboard)/privacy/quickstart/page.tsx");
    const applies = qs.slice(qs.indexOf('{step === "applies" && ('), qs.indexOf('{step === "welcome" && ('));
    expect(applies).toMatch(/<JurisdictionPicker/);
    expect(applies).toMatch(/applies\.placesUnsure/);
    expect(qs).toMatch(/setJurisdictionsMutation\.mutate\(/);
    const router = read("src/server/routers/privacy/regulations.ts");
    expect(router).toMatch(/setJurisdictions: writerProcedure/);
    // Only places are ever removed: an AI-governance entry stays.
    expect(router).toMatch(/PLACE_CODES\.includes\(oj\.jurisdiction\.code\) && !codes\.includes/);
    for (const bundle of [en, es]) {
      expect(bundle.pages.quickstart.applies.placesQuestion).toBeTruthy();
      expect(bundle.jurisdictionPicker.group.us).toBeTruthy();
    }
    expect(es.pages.quickstart.applies.placesQuestion).toBe("¿Dónde opera tu organización?");
  });

  it("'What applies' is done once a place is declared", () => {
    expect(statuses({ jurisdictions: 1 }).applies).toBe("done");
  });
});

describe("small items from the step-1 browser check", () => {
  it("the incidents list shows the short INC- reference, the full id only in the tooltip", () => {
    const list = read("src/app/(dashboard)/privacy/incidents/page.tsx");
    expect(list).not.toMatch(/>\{incident\.publicId\}</);
    expect(list.match(/formatIncidentRef\(incident\.publicId\)/g)?.length).toBe(2);
    expect(formatIncidentRef("clabcdefghijk123456")).toBe("INC-123456");
  });

  it("the incident page's tab strip wraps on a phone", () => {
    const page = read("src/app/(dashboard)/privacy/incidents/[id]/page.tsx");
    expect(page).toMatch(/<TabsList className="h-auto flex-wrap sm:h-9 sm:flex-nowrap"/);
  });
});

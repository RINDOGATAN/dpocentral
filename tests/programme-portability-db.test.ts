// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The round trip against a real PostgreSQL, so the queries, the JSON columns,
 * the enums and the foreign keys are the database's own and not a stand-in.
 *
 * Skipped unless PORTABILITY_TEST_DATABASE_URL names a THROWAWAY local
 * database with every migration applied (it writes rows and never cleans a
 * shared one). For example:
 *
 *   docker run -d --name dpc-portability-db -e POSTGRES_USER=dpc \
 *     -e POSTGRES_PASSWORD=dpc_local -e POSTGRES_DB=dpc -p 127.0.0.1:55471:5432 \
 *     public.ecr.aws/docker/library/postgres:16-alpine
 *   DATABASE_URL=postgresql://dpc:dpc_local@127.0.0.1:55471/dpc npx prisma migrate deploy
 *   PORTABILITY_TEST_DATABASE_URL=postgresql://dpc:dpc_local@127.0.0.1:55471/dpc \
 *     npx vitest run tests/programme-portability-db.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import AdmZip from "adm-zip";
import { Prisma, PrismaClient } from "@prisma/client";
import { memoryDb } from "./helpers/memory-db";
import { seedGlobals, seedProgramme, SOURCE_ORG, TARGET_ORG, OTHER_ORG } from "./helpers/programme-fixture";
import { byId, canonical, idMapFrom, ROUND_TRIP_REGISTERS, strip } from "./helpers/programme-compare";
import { programmeArchive } from "@/server/services/portability/export";
import { applyImport, planImport } from "@/server/services/portability/import";
import { validateProgramme, type ProgrammeDoc } from "@/server/services/portability/format";
import { csvImporter, suggestMapping, tableToProgramme } from "@/server/services/portability/csv-import";
import type { Db } from "@/lib/prisma";

const URL_ = process.env.PORTABILITY_TEST_DATABASE_URL;
const run = URL_ && /@(127\.0\.0\.1|localhost)[:/]/.test(URL_) ? describe : describe.skip;

/** Tables in the order their foreign keys allow. */
const ORDER = [
  "user",
  "jurisdiction",
  "vendorQuestionnaire",
  "organization",
  "organizationMember",
  "organizationJurisdiction",
  "businessUnit",
  "dataAsset",
  "dataElement",
  "processingActivity",
  "processingActivityAsset",
  "processingActivityAssetElement",
  "dataFlow",
  "dataTransfer",
  "vendor",
  "vendorContract",
  "vendorReview",
  "vendorQuestionnaireResponse",
  "assessmentTemplate",
  "assessment",
  "assessmentResponse",
  "assessmentMitigation",
  "assessmentApproval",
  "assessmentVersion",
  "incident",
  "incidentTimelineEntry",
  "incidentTask",
  "incidentNotification",
  "incidentAffectedAsset",
  "incidentDocument",
  "aISystem",
  "dSARIntakeForm",
  "dSARRequest",
  "dSARTask",
  "dSARCommunication",
  "auditLog",
];

run("programme portability on PostgreSQL", () => {
  // Made in beforeAll: a skipped suite still runs this body to collect its tests.
  let prisma: PrismaClient;
  let db: Db;
  const tag = `t${Date.now().toString(36)}`;
  const src = `${SOURCE_ORG}-${tag}`;
  const tgt = `${TARGET_ORG}-${tag}`;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: URL_ } } });
    db = prisma as unknown as Db;
    // Build the programme in memory, then write it to the database with ids unique to this run.
    const mem = memoryDb();
    seedGlobals(mem);
    seedProgramme(mem, src, { prefix: `src${tag}` });
    seedProgramme(mem, `${OTHER_ORG}-${tag}`, { prefix: `oth${tag}`, ownerUserId: "user-other" });
    mem.insert("organization", { id: tgt, name: "Target", slug: `target-${tag}` });
    mem.insert("organizationMember", { id: `tgt-${tag}`, organizationId: tgt, userId: "user-target", role: "OWNER" });
    const rename = (v: unknown): unknown => {
      if (typeof v === "string") {
        if (/^(user-|jur-|tpl-system|q-system)/.test(v)) return `${v}-${tag}`;
        if (v === "GDPR" || v === "CCPA") return `${v}-${tag}`;
        if (/@example\.test$/i.test(v)) return v.replace("@", `+${tag}@`);
        return v;
      }
      if (Array.isArray(v)) return v.map(rename);
      if (v instanceof Date) return v;
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rename(x)]));
      return v;
    };
    const columns = new Map(
      Prisma.dmmf.datamodel.models.map((m) => [
        m.name[0]!.toLowerCase() + m.name.slice(1),
        new Set(m.fields.filter((f) => f.kind !== "object").map((f) => f.name)),
      ]),
    );
    for (const model of ORDER) {
      const known = columns.get(model)!;
      const rows = (mem.table(model) ?? []).map((r) => {
        const out = Object.fromEntries(
          Object.entries(rename(r) as Record<string, unknown>).filter(([k]) => known.has(k)),
        );
        if (model === "organization" && typeof out.slug === "string") out.slug = `${out.slug}-${tag}`;
        if (model === "dSARIntakeForm") out.slug = `requests-${tag}`;
        return out;
      });
      if (rows.length) await (prisma as unknown as Record<string, { createMany: (a: object) => Promise<unknown> }>)[model]!.createMany({ data: rows });
    }
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("exports, validates, imports into the empty organisation as drafts and exports the same records", async () => {
    const opts = { includeRightsRequests: true, dsarModuleOn: true, locale: "en" as const, pageSize: 2 };
    const read = async (organizationId: string) => {
      const parts: Uint8Array[] = [];
      for await (const c of programmeArchive(db, { organizationId, ...opts })) parts.push(c);
      const zip = new AdmZip(Buffer.concat(parts));
      return JSON.parse(zip.getEntry("programme.json")!.getData().toString("utf8")) as ProgrammeDoc;
    };
    const source = await read(src);
    expect(validateProgramme(source).ok).toBe(true);
    expect(source.dataAssets).toHaveLength(3);
    expect(JSON.stringify(source)).not.toContain(`oth${tag}`);

    const importOpts = {
      organizationId: tgt,
      userId: `user-target-${tag}`,
      includeRightsRequests: true,
      dsarModuleOn: true,
      requireEmpty: true,
    };
    const plan = await planImport(db, source, importOpts);
    expect(plan.canImport, JSON.stringify(plan.problems)).toBe(true);
    const result = await applyImport(db, source, importOpts);
    expect(result.created).toBeGreaterThan(10);

    const again = await read(tgt);
    const records = await prisma.programmeImportRecord.findMany({ where: { organizationId: tgt } });
    const idMap = idMapFrom(records);
    idMap.set(`user-target-${tag}`, `user-owner-${tag}`);
    const unmatched = new Set([`user-gone-${tag}`]);
    for (const key of ROUND_TRIP_REGISTERS) {
      expect(byId(strip(canonical(again[key], idMap, unmatched)) as never), key).toEqual(byId(strip(canonical(source[key], new Map(), unmatched)) as never));
    }
    expect(again.assessments.map((a) => a.status)).toEqual(["DRAFT", "DRAFT"]);
    const drafts = await prisma.vendor.findMany({ where: { organizationId: tgt } });
    expect(drafts.every((v) => v.provenance === "IMPORTED" && v.confirmedAt === null)).toBe(true);

    // Again: nothing new.
    const second = await applyImport(db, source, importOpts);
    expect(second.created).toBe(0);
    expect(await prisma.dataAsset.count({ where: { organizationId: tgt } })).toBe(3);
    expect(await prisma.auditLog.count({ where: { organizationId: tgt, action: "IMPORT_PROGRAMME" } })).toBe(2);
  }, 60_000);

  it("imports a register from CSV next to existing records", async () => {
    const table = csvImporter.read(new TextEncoder().encode("Supplier;Criticality;Países\nAcme;Alto;ES|FR\n"));
    const conv = tableToProgramme("vendors", table, suggestMapping("vendors", table.headers));
    const res = await applyImport(db, conv.programme, {
      organizationId: tgt,
      userId: `user-target-${tag}`,
      includeRightsRequests: false,
      dsarModuleOn: true,
      requireEmpty: false,
      mode: "register",
    });
    expect(res.created).toBe(1);
    const acme = await prisma.vendor.findFirst({ where: { organizationId: tgt, name: "Acme" } });
    expect(acme).toMatchObject({ riskTier: "HIGH", countries: ["ES", "FR"], provenance: "IMPORTED" });
  }, 60_000);
});

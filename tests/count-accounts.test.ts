// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * scripts/count-accounts.mjs, with the database client mocked. No database,
 * no network: the script takes its client as an argument.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ACTIVITY_LABELS,
  CONNECTION_VARIABLE,
  DEMO_ORGANIZATION,
  DEMO_USER,
  collectCounts,
  outDirFromArgs,
  safeErrorLine,
} from "../scripts/count-accounts.mjs";

// The script carries `// @ts-check` and types its client from the generated
// Prisma client, so `tsc --noEmit` holds every filter it sends against the
// real schema. The mock below is therefore cast on the way in.
type CountClient = Parameters<typeof collectCounts>[0];

const NOW = new Date("2026-09-20T12:00:00.000Z");
const SINCE = new Date("2026-08-21T12:00:00.000Z");

const POISON = "POISON-row-string@example.test";
/** Stands in for a password inside a connection string (no "@", so the URL stays well formed). */
const SECRET = "POISON-credential";

type Where = Record<string, unknown> | undefined;
type Answer = (where: Where) => unknown;

const isDemoQuery = (where: Where) => JSON.stringify(where ?? {}).includes('"organization"');

/** A client on which everything except `count` throws. */
function mockDb(answers: Partial<Record<string, Answer>> = {}) {
  const calls: { model: string; where: Where }[] = [];
  const forbidden = (name: string) => () => {
    throw new Error(`${name} must never be called: ${POISON}`);
  };
  const delegate = (model: string) => ({
    count: vi.fn(async (args?: { where?: Where }) => {
      calls.push({ model, where: args?.where });
      const answer = answers[model];
      return answer ? answer(args?.where) : 0;
    }),
    findMany: forbidden("findMany"),
    findFirst: forbidden("findFirst"),
    findUnique: forbidden("findUnique"),
    groupBy: forbidden("groupBy"),
    aggregate: forbidden("aggregate"),
    create: forbidden("create"),
    update: forbidden("update"),
    updateMany: forbidden("updateMany"),
    upsert: forbidden("upsert"),
    delete: forbidden("delete"),
    deleteMany: forbidden("deleteMany"),
  });
  const db = {
    user: delegate("user"),
    organization: delegate("organization"),
    customer: delegate("customer"),
    assessment: delegate("assessment"),
    dSARRequest: delegate("dSARRequest"),
    processingActivity: delegate("processingActivity"),
    $queryRaw: forbidden("$queryRaw"),
    $queryRawUnsafe: forbidden("$queryRawUnsafe"),
    $executeRaw: forbidden("$executeRaw"),
    $executeRawUnsafe: forbidden("$executeRawUnsafe"),
    $transaction: forbidden("$transaction"),
  };
  return { db: db as unknown as CountClient, calls };
}

describe("count-accounts: shape", () => {
  it("prints exactly the agreed fields", async () => {
    const { db } = mockDb();
    const result = await collectCounts(db, NOW);

    expect(Object.keys(result)).toEqual([
      "product",
      "users",
      "organizations",
      "paying",
      "installs",
      "as_of",
      "source",
      "activity",
      "activity_labels",
    ]);
    expect(result.product).toBe("DPO CENTRAL");
    expect(result.as_of).toBe("2026-09-20T12:00:00.000Z");
    expect(typeof result.source).toBe("string");
  });

  it("has 4 to 10 activity keys, snake_case, ending in _total or _30d", async () => {
    const { db } = mockDb();
    const { activity } = await collectCounts(db, NOW);
    const keys = Object.keys(activity);

    expect(keys.length).toBeGreaterThanOrEqual(4);
    expect(keys.length).toBeLessThanOrEqual(10);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*_(total|30d)$/);
    }
  });

  it("labels every activity key, in at most five words, and nothing else", async () => {
    const { db } = mockDb();
    const { activity, activity_labels } = await collectCounts(db, NOW);

    expect(Object.keys(activity_labels)).toEqual(Object.keys(activity));
    for (const label of Object.values(activity_labels)) {
      expect(label.trim().split(/\s+/).length).toBeLessThanOrEqual(5);
      expect(label).toMatch(/^[A-Za-z0-9 ,]+$/);
    }
    expect(activity_labels).toEqual(ACTIVITY_LABELS);
  });

  it("says in source what was excluded and what could not be", async () => {
    const { db } = mockDb();
    const { source } = await collectCounts(db, NOW);

    expect(source).toMatch(/read-only/i);
    expect(source).toMatch(/excludes demo organizations/);
    expect(source).toMatch(/cannot tell them apart/);
    expect(source).toMatch(/owner's own test accounts/);
  });
});

describe("count-accounts: null versus zero", () => {
  it("an empty database is a measured zero everywhere; installs is null", async () => {
    const { db } = mockDb();
    const result = await collectCounts(db, NOW);

    expect(result.users).toBe(0);
    expect(result.organizations).toBe(0);
    expect(result.paying).toBe(0);
    expect(result.installs).toBeNull();
    for (const value of Object.values(result.activity)) {
      expect(value).toBe(0);
    }
  });

  it("every activity value is an integer or null", async () => {
    const { db } = mockDb({
      assessment: (where) => (isDemoQuery(where) ? 2 : 9),
      dSARRequest: (where) => (isDemoQuery(where) ? 1 : 4),
      processingActivity: () => BigInt(7),
      user: () => 3,
    });
    const { activity } = await collectCounts(db, NOW);

    for (const value of Object.values(activity)) {
      expect(value === null || Number.isInteger(value)).toBe(true);
    }
    expect(activity.assessments_started_total).toBe(7);
    expect(activity.dsar_requests_received_total).toBe(3);
    expect(activity.processing_activities_recorded_total).toBe(0);
    expect(activity.active_users_30d).toBe(3);
  });
});

describe("count-accounts: demo exclusion", () => {
  it("subtracts the rows of demo organizations from every record figure", async () => {
    const { db, calls } = mockDb({
      assessment: (where) => (isDemoQuery(where) ? 5 : 12),
    });
    const { activity } = await collectCounts(db, NOW);

    expect(activity.assessments_started_total).toBe(7);
    expect(activity.assessments_approved_total).toBe(7);

    for (const model of ["assessment", "dSARRequest", "processingActivity"]) {
      const forModel = calls.filter((c) => c.model === model);
      const demo = forModel.filter((c) => isDemoQuery(c.where));
      expect(demo.length).toBe(forModel.length / 2);
      for (const call of demo) {
        expect(JSON.stringify(call.where)).toContain(JSON.stringify(DEMO_ORGANIZATION));
      }
    }
  });

  it("knows a demo organization by seeded id, seeded slug and the isDemo flag", () => {
    const text = JSON.stringify(DEMO_ORGANIZATION);
    for (const marker of ["demo-organization", "proserv-organization", '"demo"', "demo-saas", "isDemo"]) {
      expect(text).toContain(marker);
    }
  });

  it("never goes below zero if the two counts race", async () => {
    const { db } = mockDb({ assessment: (where) => (isDemoQuery(where) ? 3 : 2) });
    const { activity } = await collectCounts(db, NOW);
    expect(activity.assessments_started_total).toBe(0);
  });

  it("counts active users from audit entries of the last 30 days, seeded users excluded", async () => {
    const { db, calls } = mockDb();
    await collectCounts(db, NOW);

    const active = calls.find((c) => c.model === "user" && c.where);
    expect(active?.where).toEqual({
      auditLogs: { some: { createdAt: { gte: SINCE } } },
      NOT: DEMO_USER,
    });
  });

  it("counts outcomes by their own date: approvals and completions by completedAt", async () => {
    const { db, calls } = mockDb();
    await collectCounts(db, NOW);
    const wheres = calls.map((c) => JSON.stringify(c.where ?? {}));

    expect(wheres).toContain(JSON.stringify({ status: "APPROVED", completedAt: { gte: SINCE } }));
    expect(wheres).toContain(JSON.stringify({ status: "COMPLETED", completedAt: { gte: SINCE } }));
    expect(wheres).toContain(JSON.stringify({ receivedAt: { gte: SINCE } }));
  });

  it("paying counts customers, never trials, never expired", async () => {
    const { db, calls } = mockDb({ customer: () => 2 });
    const result = await collectCounts(db, NOW);

    expect(result.paying).toBe(2);
    expect(calls.find((c) => c.model === "customer")?.where).toEqual({
      entitlements: {
        some: {
          status: "ACTIVE",
          licenseType: { not: "TRIAL" },
          OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
        },
      },
    });
  });
});

describe("count-accounts: nothing from a row reaches the output", () => {
  it("only count is ever called", async () => {
    const { db, calls } = mockDb();
    await expect(collectCounts(db, NOW)).resolves.toBeDefined();
    expect(calls.length).toBeGreaterThan(0);
  });

  it("a string or a row returned by the client becomes null, not output", async () => {
    const hostile = () => POISON;
    const { db } = mockDb({
      user: hostile,
      organization: () => ({ name: POISON }),
      customer: () => [{ email: POISON }],
      assessment: hostile,
      dSARRequest: hostile,
      processingActivity: () => 1.5,
    });
    const result = await collectCounts(db, NOW);

    expect(JSON.stringify(result)).not.toContain("POISON");
    expect(result.users).toBeNull();
    expect(result.organizations).toBeNull();
    expect(result.paying).toBeNull();
    for (const value of Object.values(result.activity)) {
      expect(value).toBeNull();
    }
  });

  it("an error prints its class only", () => {
    class PrismaClientInitializationError extends Error {}
    const error = new PrismaClientInitializationError(`cannot reach host.example.test for ${POISON}`);

    expect(safeErrorLine(error)).toBe("count-accounts failed: PrismaClientInitializationError");
    expect(safeErrorLine(POISON)).toBe("count-accounts failed: Error");
    expect(safeErrorLine(null)).toBe("count-accounts failed: Error");
    expect(safeErrorLine(Object.create(null))).toBe("count-accounts failed: Error");
  });
});

describe("count-accounts: command line", () => {
  it("reads --out=DIR and nothing else", () => {
    expect(outDirFromArgs(["--out=/tmp/counts"])).toBe("/tmp/counts");
    expect(outDirFromArgs([])).toBeNull();
    expect(outDirFromArgs(["--verbose"])).toBeNull();
  });

  it("takes its connection string from its own variable, not DATABASE_URL", () => {
    expect(CONNECTION_VARIABLE).toBe("DATABASE_URL_PROD");
    expect(CONNECTION_VARIABLE).not.toBe("DATABASE_URL");
  });
});

// The script itself, as a child process with an environment of our choosing.
// None of these runs can reach a database: the first two stop before the
// client is loaded, the third points at a closed port on this machine.
describe("count-accounts: the process fails closed and says nothing", () => {
  const script = path.resolve(__dirname, "../scripts/count-accounts.mjs");

  function run(env: Record<string, string>) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      execFile(
        process.execPath,
        [script],
        {
          env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
          cwd: path.dirname(script),
          timeout: 30_000,
        },
        (error, stdout, stderr) => {
          const code = error && typeof error.code === "number" ? error.code : error ? null : 0;
          resolve({ code, stdout, stderr });
        },
      );
    });
  }

  it("refuses to run without DATABASE_URL_PROD, even when DATABASE_URL is set", async () => {
    const result = await run({ DATABASE_URL: `postgresql://u:${SECRET}@127.0.0.1:1/none` });

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("count-accounts failed: MissingConnectionVariable\n");
  });

  it("refuses the database once shared with a sister product", async () => {
    const result = await run({
      DATABASE_URL_PROD: `postgresql://u:${SECRET}@ep-broad-band-agodluqf.invalid:1/none`,
    });

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("count-accounts failed: ForbiddenDatabaseHost\n");
  });

  it("a connection failure prints a class name only: no host, no credential", async () => {
    const result = await run({ DATABASE_URL_PROD: `postgresql://u:${SECRET}@127.0.0.1:1/none` });

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^count-accounts failed: [A-Za-z]+\n$/);
    expect(result.stderr).not.toContain("POISON");
    expect(result.stderr).not.toContain("127.0.0.1");
  }, 40_000);
});

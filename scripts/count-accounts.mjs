// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
// @ts-check

/**
 * Print one JSON object of account and activity counts for this instance.
 *
 * Usage: node --env-file=.env.prod.local scripts/count-accounts.mjs [--out=DIR]
 *    or: DATABASE_URL_PROD=<connection string> node scripts/count-accounts.mjs [--out=DIR]
 *
 * Reads a production database: do not run without the owner's go-ahead.
 *
 * Read-only by construction: the only database calls are Prisma `count` calls.
 * No row is ever selected and nothing is written. No name, address, domain, title, key or free text leaves this
 * script, in its output or in an error: a failure prints the error class only.
 *
 * The connection string is read from DATABASE_URL_PROD (kept in the
 * git-ignored .env.prod.local), never from DATABASE_URL, so a stale
 * DATABASE_URL in a local env file can never be counted by accident. With --out=DIR the same object is also
 * written to DIR/dpocentral.json.
 *
 * null means "not applicable"; 0 means "measured, and the answer is zero".
 *
 * Definitions:
 *   users          every row in User (demo users included: the cycle 11
 *                  definition, kept so the series does not break).
 *   organizations  every row in Organization (demo organizations included,
 *                  same reason).
 *   paying         distinct Customers holding at least one entitlement that is
 *                  ACTIVE, not past its expiry, and NOT a TRIAL. Both Stripe
 *                  subscriptions and offline licences count. No seeder creates
 *                  a Customer, so there is no seed row to exclude.
 *   installs       null, always. Self-hosted installs are not tracked by
 *                  design: the published images report to nobody.
 *   activity       what people do with the product, demo organizations
 *                  excluded. `_total` is all time; `_30d` is the last 30 days
 *                  by the date named below.
 *     assessments_started_*      Assessment rows, by createdAt.
 *     assessments_approved_*     Assessment rows with status APPROVED, by
 *                                completedAt (set at the approval).
 *     dsar_requests_received_*   DSARRequest rows, by receivedAt.
 *     dsar_requests_completed_*  DSARRequest rows with status COMPLETED, by
 *                                completedAt.
 *     processing_activities_recorded_total
 *                                ProcessingActivity rows (the ROPA).
 *     active_users_30d           Users with at least one AuditLog entry in the
 *                                last 30 days (a create, change, delete or
 *                                export; reading alone leaves no entry),
 *                                seeded demo users excluded by id.
 *   activity_labels  the same keys, each with a plain English label.
 *
 * Demo exclusion: an organization is demo when it carries a seeded id, a
 * seeded slug (slugs cannot be changed after creation) or the settings flag
 * isDemo=true. Each figure is "all rows" minus "rows of a demo organization",
 * so an organization with no settings at all is never dropped by a NULL
 * comparison. Sample records a person adds to a real organization, and the
 * owner's own test accounts, cannot be told apart from real use.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCT = "DPO CENTRAL";
export const OUT_FILE = "dpocentral.json";
export const CONNECTION_VARIABLE = "DATABASE_URL_PROD";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vertical keys of scripts/demo/verticals (ids are `<key>-organization`, `<key>-user-*`). */
const DEMO_VERTICAL_KEYS = ["saas", "healthcare", "fintech", "media", "proserv"];

/**
 * The part of the Prisma client this script may touch. `// @ts-check` above
 * makes the typecheck hold every filter below against the real schema.
 * @typedef {Pick<import("@prisma/client").PrismaClient,
 *   "user" | "organization" | "customer" | "assessment" | "dSARRequest" | "processingActivity">} CountClient
 * @typedef {import("@prisma/client").Prisma.AssessmentWhereInput} AssessmentWhere
 * @typedef {import("@prisma/client").Prisma.DSARRequestWhereInput} DsarWhere
 * @typedef {import("@prisma/client").Prisma.ProcessingActivityWhereInput} ActivityWhere
 */

/**
 * Organizations planted by prisma/seed.ts, scripts/seed-demo-scenario.ts and scripts/demo.
 * @type {import("@prisma/client").Prisma.OrganizationWhereInput}
 */
export const DEMO_ORGANIZATION = {
  OR: [
    { id: { in: ["demo-organization", ...DEMO_VERTICAL_KEYS.map((k) => `${k}-organization`)] } },
    { slug: { in: ["demo", ...DEMO_VERTICAL_KEYS.map((k) => `demo-${k}`)] } },
    { settings: { path: ["isDemo"], equals: true } },
  ],
};

/**
 * Users planted by the same seeders. Real ids are cuids and carry no hyphen.
 * @type {import("@prisma/client").Prisma.UserWhereInput}
 */
export const DEMO_USER = {
  OR: [
    { id: "demo-user" },
    { id: { startsWith: "demo-user-" } },
    ...DEMO_VERTICAL_KEYS.map((k) => ({ id: { startsWith: `${k}-user-` } })),
  ],
};

export const ACTIVITY_LABELS = {
  assessments_started_total: "Assessments started",
  assessments_started_30d: "Assessments started, 30 days",
  assessments_approved_total: "Assessments approved",
  assessments_approved_30d: "Assessments approved, 30 days",
  dsar_requests_received_total: "Privacy requests received",
  dsar_requests_received_30d: "Privacy requests received, 30 days",
  dsar_requests_completed_total: "Privacy requests completed",
  dsar_requests_completed_30d: "Privacy requests completed, 30 days",
  processing_activities_recorded_total: "Processing activities recorded",
  active_users_30d: "Active users, 30 days",
};

export const SOURCE =
  "Hosted database, read-only, COUNT queries only. users and organizations are every row, demo rows " +
  "included (cycle 11 definition); paying is distinct customers with an active, unexpired, non-trial " +
  "entitlement (no seeder creates a customer, so nothing to exclude); installs is null because " +
  "self-hosted installs report to nobody. activity excludes demo organizations (seeded id, seeded slug " +
  "or the isDemo flag) and seeded demo users; active_users_30d is users with an audit entry in 30 days " +
  "(a change or an export, not a read). Not excluded, because the schema cannot tell them apart: sample " +
  "records added inside a real organization, and the owner's own test accounts.";

/**
 * A count must be a whole number; anything else becomes null, never a string.
 * @param {unknown} value
 * @returns {number | null}
 */
function asInteger(value) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isInteger(value)) return value;
  return null;
}

/**
 * All rows minus the rows of demo organizations.
 * @param {Promise<unknown>} all
 * @param {Promise<unknown>} demo
 */
async function minusDemo(all, demo) {
  const [a, d] = (await Promise.all([all, demo])).map(asInteger);
  return a === null || d === null ? null : Math.max(0, a - d);
}

const IN_DEMO = { organization: DEMO_ORGANIZATION };

/**
 * Every figure, from an injected Prisma client (the unit test passes a mock).
 * Only `count` is ever called on it.
 * @param {CountClient} db
 * @param {Date} [now]
 */
export async function collectCounts(db, now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY_MS);

  /** @param {AssessmentWhere} where */
  const assessments = (where) =>
    minusDemo(db.assessment.count({ where }), db.assessment.count({ where: { AND: [where, IN_DEMO] } }));
  /** @param {DsarWhere} where */
  const dsarRequests = (where) =>
    minusDemo(db.dSARRequest.count({ where }), db.dSARRequest.count({ where: { AND: [where, IN_DEMO] } }));
  /** @param {ActivityWhere} where */
  const processingActivities = (where) =>
    minusDemo(
      db.processingActivity.count({ where }),
      db.processingActivity.count({ where: { AND: [where, IN_DEMO] } }),
    );

  const [
    users,
    organizations,
    paying,
    assessmentsStartedTotal,
    assessmentsStarted30d,
    assessmentsApprovedTotal,
    assessmentsApproved30d,
    dsarReceivedTotal,
    dsarReceived30d,
    dsarCompletedTotal,
    dsarCompleted30d,
    processingActivitiesTotal,
    activeUsers30d,
  ] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    // Customers are counted, not entitlements, so a customer holding three
    // licences is one paying customer.
    db.customer.count({
      where: {
        entitlements: {
          some: {
            status: "ACTIVE",
            licenseType: { not: "TRIAL" },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
    }),
    assessments({}),
    assessments({ createdAt: { gte: since } }),
    assessments({ status: "APPROVED" }),
    assessments({ status: "APPROVED", completedAt: { gte: since } }),
    dsarRequests({}),
    dsarRequests({ receivedAt: { gte: since } }),
    dsarRequests({ status: "COMPLETED" }),
    dsarRequests({ status: "COMPLETED", completedAt: { gte: since } }),
    processingActivities({}),
    db.user.count({
      where: {
        auditLogs: { some: { createdAt: { gte: since } } },
        NOT: DEMO_USER,
      },
    }),
  ]);

  return {
    product: PRODUCT,
    users: asInteger(users),
    organizations: asInteger(organizations),
    paying: asInteger(paying),
    installs: null,
    as_of: now.toISOString(),
    source: SOURCE,
    activity: {
      assessments_started_total: assessmentsStartedTotal,
      assessments_started_30d: assessmentsStarted30d,
      assessments_approved_total: assessmentsApprovedTotal,
      assessments_approved_30d: assessmentsApproved30d,
      dsar_requests_received_total: dsarReceivedTotal,
      dsar_requests_received_30d: dsarReceived30d,
      dsar_requests_completed_total: dsarCompletedTotal,
      dsar_requests_completed_30d: dsarCompleted30d,
      processing_activities_recorded_total: processingActivitiesTotal,
      active_users_30d: asInteger(activeUsers30d),
    },
    activity_labels: ACTIVITY_LABELS,
  };
}

/**
 * The error class only: a driver message can carry a host name or a row value.
 * @param {unknown} error
 */
export function safeErrorLine(error) {
  const name = error && typeof error === "object" && error.constructor ? error.constructor.name : "";
  return `count-accounts failed: ${/^[A-Za-z]{1,60}$/.test(name) ? name : "Error"}`;
}

/** @param {string[]} argv */
export function outDirFromArgs(argv) {
  const arg = argv.find((a) => a.startsWith("--out="));
  return arg ? arg.slice("--out=".length) : null;
}

/** The database once shared with a sister product: its figures are not ours. */
const FORBIDDEN_HOST_FRAGMENTS = ["ep-broad-band-agodluqf"];

class MissingConnectionVariable extends Error {}
class ForbiddenDatabaseHost extends Error {}

async function main() {
  const url = process.env[CONNECTION_VARIABLE];
  if (!url) throw new MissingConnectionVariable();
  if (FORBIDDEN_HOST_FRAGMENTS.some((f) => url.includes(f))) throw new ForbiddenDatabaseHost();

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    const result = await collectCounts(prisma);
    const json = JSON.stringify(result, null, 2) + "\n";
    const outDir = outDirFromArgs(process.argv.slice(2));
    if (outDir) {
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, OUT_FILE), json);
    }
    process.stdout.write(json);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(safeErrorLine(error) + "\n");
    process.exitCode = 1;
  });
}

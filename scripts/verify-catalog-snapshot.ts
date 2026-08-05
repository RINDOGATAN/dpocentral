// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Sanity-checks `vendors/catalog-snapshot.json` before committing a refresh
 * from vendor.watch. No database, no network — pure file analysis.
 *
 *   npm run catalog:verify                       # validate + diff vs git HEAD
 *   npm run catalog:verify -- --against <path>   # diff vs an explicit file
 *   npm run catalog:verify -- --no-diff          # validate the snapshot only
 *
 * Validates the contract the seed relies on (count matches, >= MIN_EXPECTED,
 * required fields, sane types per VendorWatchVendor) and reports what changed
 * against the previous version: slug churn, per-field coverage, dpaUrl
 * populated→null flips, subprocessor payload shapes. Exits 1 on any contract
 * violation; diff output is informational.
 */

import * as fs from "fs";
import { execFileSync } from "child_process";
import { MIN_EXPECTED } from "../src/lib/seed-catalog-from-snapshot";
import type { VendorWatchVendor } from "../src/lib/vendor-watch-types";

const SNAPSHOT_PATH = "vendors/catalog-snapshot.json";

interface Snapshot {
  version?: string | number;
  generatedAt?: string;
  sourceCommit?: string;
  count: number;
  vendors: VendorWatchVendor[];
}

function fail(msg: string): never {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

// ── Load current snapshot ──────────────────────────────────────────────────
if (!fs.existsSync(SNAPSHOT_PATH)) fail(`${SNAPSHOT_PATH} not found`);
const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8")) as Snapshot;

// ── Contract validation (mirrors what the seed enforces, plus field types) ──
const problems: string[] = [];
if (!Array.isArray(snap.vendors) || typeof snap.count !== "number")
  fail("malformed snapshot: expected { count, vendors[] }");
if (snap.count !== snap.vendors.length)
  problems.push(`count=${snap.count} but vendors.length=${snap.vendors.length}`);
if (snap.count < MIN_EXPECTED)
  problems.push(`count=${snap.count} below MIN_EXPECTED=${MIN_EXPECTED} — seed would refuse this`);

const STRING_ARRAYS: (keyof VendorWatchVendor)[] = [
  "tags", "certifications", "frameworks", "dataLocations",
  "aiCapabilities", "aiTechniques", "euAiActAnnexIIIDomains",
];
const URL_FIELDS: (keyof VendorWatchVendor)[] = [
  "website", "privacyPolicyUrl", "trustCenterUrl", "dpaUrl", "securityPageUrl", "logoUrl",
];

const slugs = new Set<string>();
for (const v of snap.vendors) {
  const id = v.slug || v.name || "(unknown)";
  if (!v.slug || typeof v.slug !== "string") problems.push(`${id}: missing slug`);
  else if (slugs.has(v.slug)) problems.push(`${v.slug}: duplicate slug`);
  else slugs.add(v.slug);
  if (!v.name || typeof v.name !== "string") problems.push(`${id}: missing name`);
  if (!v.category || typeof v.category !== "string") problems.push(`${id}: missing category`);
  if (typeof v.isVerified !== "boolean") problems.push(`${id}: isVerified not boolean`);
  if (v.verifiedAt != null && isNaN(Date.parse(v.verifiedAt))) problems.push(`${id}: bad verifiedAt`);
  if (v.aiModels != null && !Array.isArray(v.aiModels)) problems.push(`${id}: aiModels not array/null`);
  for (const f of STRING_ARRAYS) {
    const val = v[f];
    if (val != null && (!Array.isArray(val) || (val as unknown[]).some((x) => typeof x !== "string")))
      problems.push(`${id}: ${f} not string[]`);
  }
  for (const f of URL_FIELDS) {
    const val = v[f];
    if (val != null && typeof val !== "string") problems.push(`${id}: ${f} not string/null`);
    else if (typeof val === "string" && val && !/^https?:\/\//.test(val))
      problems.push(`${id}: ${f} not http(s): ${val}`);
  }
}

// Subprocessor shape report (string containers are an upstream bug the mapper
// recovers from — report, don't fail).
let subsArrays = 0, subsStrings = 0, subsBadEntries = 0;
for (const v of snap.vendors) {
  const s = v.subprocessors;
  if (s == null) continue;
  if (typeof s === "string") { subsStrings++; continue; }
  if (!Array.isArray(s)) { problems.push(`${v.slug}: subprocessors neither array nor string`); continue; }
  subsArrays++;
  for (const e of s as unknown[]) {
    const entry = e as Record<string, unknown> | null;
    if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || !entry.name)
      subsBadEntries++;
  }
}
if (subsBadEntries > 0) problems.push(`${subsBadEntries} subprocessor entries missing a name`);

console.log(
  `Snapshot: ${snap.count} vendors, generatedAt=${snap.generatedAt}, sourceCommit=${snap.sourceCommit}`
);
console.log(
  `Subprocessors: ${subsArrays} structured arrays, ${subsStrings} string payloads (mapper recovers JSON strings)`
);

if (problems.length) {
  console.error(`\n✖ ${problems.length} contract violation(s):`);
  for (const p of problems.slice(0, 25)) console.error(`  - ${p}`);
  if (problems.length > 25) console.error(`  … and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("Contract: OK");

// ── Diff vs previous version ───────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.includes("--no-diff")) process.exit(0);

let prev: Snapshot | null = null;
let prevLabel = "";
const againstIdx = argv.indexOf("--against");
if (againstIdx !== -1 && argv[againstIdx + 1]) {
  prevLabel = argv[againstIdx + 1];
  prev = JSON.parse(fs.readFileSync(prevLabel, "utf-8")) as Snapshot;
} else {
  try {
    const raw = execFileSync("git", ["show", `HEAD:${SNAPSHOT_PATH}`], {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    prevLabel = "git HEAD";
    prev = JSON.parse(raw) as Snapshot;
  } catch {
    console.log("No previous version to diff against (not in git yet?) — done.");
    process.exit(0);
  }
}

if (prev.generatedAt === snap.generatedAt && prev.sourceCommit === snap.sourceCommit) {
  console.log(`Identical to ${prevLabel} (same generatedAt/sourceCommit) — no diff.`);
  process.exit(0);
}

console.log(`\nDiff vs ${prevLabel} (${prev.count} vendors, ${prev.generatedAt}):`);
const prevBySlug = new Map(prev.vendors.map((v) => [v.slug, v]));
const added = snap.vendors.filter((v) => !prevBySlug.has(v.slug)).map((v) => v.slug);
const currSlugs = new Set(snap.vendors.map((v) => v.slug));
const removed = prev.vendors.filter((v) => !currSlugs.has(v.slug)).map((v) => v.slug);
console.log(`  slugs: +${added.length} / -${removed.length}`);
if (removed.length) console.log(`  removed: ${removed.slice(0, 20).join(", ")}${removed.length > 20 ? " …" : ""}`);
if (added.length) console.log(`  added: ${added.slice(0, 20).join(", ")}${added.length > 20 ? " …" : ""}`);

const pct = (n: number, total: number) => `${Math.round((n / total) * 100)}%`;
for (const f of ["privacyPolicyUrl", "securityPageUrl", "dpaUrl", "trustCenterUrl", "subprocessors"] as const) {
  const o = prev.vendors.filter((v) => v[f] != null && v[f] !== "").length;
  const n = snap.vendors.filter((v) => v[f] != null && v[f] !== "").length;
  if (o !== n)
    console.log(`  ${f}: ${o} (${pct(o, prev.count)}) -> ${n} (${pct(n, snap.count)})`);
}

const nulledDpa = snap.vendors.filter((v) => {
  const p = prevBySlug.get(v.slug);
  return p?.dpaUrl && !v.dpaUrl;
});
if (nulledDpa.length)
  console.log(
    `  dpaUrl populated->null on ${nulledDpa.length} vendors (expected for data-quality fixes): ` +
      nulledDpa.slice(0, 8).map((v) => v.slug).join(", ") + (nulledDpa.length > 8 ? " …" : "")
  );

const changedFields = new Map<string, number>();
for (const v of snap.vendors) {
  const p = prevBySlug.get(v.slug);
  if (!p) continue;
  const keys = new Set([...Object.keys(p), ...Object.keys(v)]);
  for (const k of keys) {
    if (JSON.stringify((p as unknown as Record<string, unknown>)[k]) !== JSON.stringify((v as unknown as Record<string, unknown>)[k]))
      changedFields.set(k, (changedFields.get(k) ?? 0) + 1);
  }
}
const top = [...changedFields.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log(`  changed fields: ${top.map(([k, n]) => `${k}(${n})`).join(", ") || "none"}`);
console.log("\nDone.");

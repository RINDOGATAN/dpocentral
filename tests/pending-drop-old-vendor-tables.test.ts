// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The drop of the seven old vendor tables (owner's decision of 29 September
 * 2026) is written but waits in prisma/pending-migrations/ until the dump is
 * taken: nothing may apply it on its own. These checks keep it that way, and
 * keep the code free of the tables it drops.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const NAME = "20260929120000_drop_old_vendor_tables";
const PENDING_DIR = path.join(ROOT, "prisma/pending-migrations", NAME);
const RELEASED_DIR = path.join(ROOT, "prisma/migrations", NAME);
// Once the owner releases it (moves it into prisma/migrations after the dump),
// the same checks read it there.
const PENDING = existsSync(PENDING_DIR) ? PENDING_DIR : RELEASED_DIR;
const TABLES = [
  "vendor_claims",
  "vendor_suggestions",
  "vw_cert_evidence",
  "vw_dpa_documents",
  "vw_enrichment_requests",
  "vw_expert_reviews",
  "vw_vendor_questionnaires",
];

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(ts|tsx|mjs|js|prisma|sh)$/.test(name)) out.push(full);
  }
  return out;
}

describe("the pending drop of the seven old vendor tables", () => {
  const sql = readFileSync(path.join(PENDING, "migration.sql"), "utf8");

  it("is in one place only: pending (not applied by migrate deploy) or released", () => {
    expect(existsSync(PENDING_DIR) !== existsSync(RELEASED_DIR)).toBe(true);
  });

  it("drops exactly the seven tables, IF EXISTS, and nothing else", () => {
    const statements = sql
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("--"));
    expect(statements).toEqual(TABLES.map((t) => `DROP TABLE IF EXISTS "${t}";`));
  });

  it("names the July separation and says dump first", () => {
    expect(sql).toMatch(/July 2026 separation/);
    expect(sql).toMatch(/DUMP FIRST/);
  });

  it("ships a pre-check that lists the row count of each table", () => {
    const precheck = readFileSync(path.join(PENDING, "precheck.sql"), "utf8");
    // precheck.sql travels with the migration; migrate deploy reads only migration.sql.
    for (const t of TABLES) expect(precheck).toContain(`('${t}')`);
    expect(precheck).toMatch(/count\(\*\)/);
    expect(precheck).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE)\b/);
  });

  it("no model and no code refers to the tables", () => {
    const scanned = [
      ...files(path.join(ROOT, "src")),
      ...files(path.join(ROOT, "scripts")),
      ...files(path.join(ROOT, "deploy")),
      path.join(ROOT, "prisma/schema.prisma"),
      path.join(ROOT, "prisma/seed.ts"),
    ];
    expect(scanned.length).toBeGreaterThan(100);
    for (const file of scanned) {
      const source = readFileSync(file, "utf8");
      for (const t of TABLES) expect(source, `${file} mentions ${t}`).not.toContain(t);
    }
  });
});

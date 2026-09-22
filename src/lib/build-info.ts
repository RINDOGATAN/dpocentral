// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Facts about the build, read ONCE at build time by next.config.ts and
 * inlined as BUILD_LAST_MIGRATION and BUILD_COMMIT (the running server may
 * not have prisma/migrations or .git: the hosted functions and the app image
 * carry neither). /api/health compares BUILD_LAST_MIGRATION with the last
 * migration recorded in the database. Node-only; never import from app code.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** Name of the last migration folder in prisma/migrations ("" if none). */
export function lastMigrationInTree(root: string = process.cwd()): string {
  const dir = path.join(root, "prisma", "migrations");
  if (!existsSync(dir)) return "";
  const names = readdirSync(dir)
    .filter((name) => statSync(path.join(dir, name)).isDirectory())
    .sort();
  return names[names.length - 1] ?? "";
}

/**
 * The commit being built: the hosting provider's variable, the image build
 * argument, else git, else "unknown".
 */
export function buildCommit(env: Record<string, string | undefined> = process.env): string {
  const fromEnv = env.VERCEL_GIT_COMMIT_SHA || env.SOURCE_COMMIT || env.NEXT_PUBLIC_COMMIT_SHA;
  if (fromEnv) return fromEnv.trim();
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

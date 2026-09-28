// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Writes the v2 assessment-template Spanish and English strings into the message
 * bundles (src/messages/{en,es}.json) under the templates.<type> namespace,
 * from the one bilingual source in src/config/assessment-templates-v2.ts.
 *
 * Deep-merges, so the v1 entries the running assessments still resolve against
 * are kept. Pure JSON: it touches no database. Run it after editing the v2
 * templates:  tsx scripts/sync-template-v2-messages.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { templateV2Messages, type ContentLocale } from "../src/config/assessment-templates-v2";

type Dict = Record<string, unknown>;

/** Merge b into a, recursing into plain objects; scalars/arrays overwrite. */
function deepMerge(a: Dict, b: Dict): Dict {
  for (const [k, v] of Object.entries(b)) {
    const cur = a[k];
    if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) {
      deepMerge(cur as Dict, v as Dict);
    } else {
      a[k] = v;
    }
  }
  return a;
}

function syncLocale(locale: ContentLocale) {
  const path = join(__dirname, "..", "src", "messages", `${locale}.json`);
  const data = JSON.parse(readFileSync(path, "utf8")) as Dict;
  const templates = (data.templates ?? (data.templates = {})) as Dict;
  deepMerge(templates, templateV2Messages(locale) as unknown as Dict);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`  ${locale}.json: v2 template strings written.`);
}

console.log("Syncing v2 assessment-template messages...");
syncLocale("en");
syncLocale("es");
console.log("Done.");

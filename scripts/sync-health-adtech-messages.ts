// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Writes the "Health data in advertising" template text into the message
// bundles (templates.dpia.{template,section,question}), from its single
// bilingual source src/config/health-adtech-template.ts. Run after editing
// that file:
//   npx tsx scripts/sync-health-adtech-messages.ts
// tests/health-adtech-template.test.ts fails if the bundles are out of date.
//
// The bundles are edited as text (only these entries are removed and
// re-inserted) so the rest of each file keeps its hand-made layout.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { healthAdtechMessages } from "../src/config/health-adtech-template";

/** Index just past the brace that closes the object opening at `open`. */
function matchBrace(text: string, open: number): number {
  let depth = 0;
  let inString = false;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("Unbalanced braces");
}

/** [start, end) of the object value of `"key": {` searched from `from`, within `limit`. */
function objectRange(text: string, key: string, indent: string, from: number, limit: number) {
  const marker = `\n${indent}"${key}": {`;
  const at = text.indexOf(marker, from);
  if (at < 0 || at >= limit) return null;
  const open = at + marker.length - 1;
  return { start: at, open, end: matchBrace(text, open) };
}

function removeEntry(text: string, key: string, indent: string, from: number, limit: number) {
  const range = objectRange(text, key, indent, from, limit);
  if (!range) return text;
  let end = range.end;
  if (text[end] === ",") end++;
  let start = range.start;
  // A last entry leaves a dangling comma on the previous entry.
  if (text[end] !== "," && text.slice(range.end).trimStart().startsWith("}")) {
    const before = text.lastIndexOf(",", start);
    if (before >= 0 && text.slice(before + 1, start).trim() === "") start = before;
  }
  return text.slice(0, start) + text.slice(end);
}

function serialise(entries: Record<string, unknown>, indent: string): string {
  return Object.entries(entries)
    .map(([k, v]) => {
      const body = JSON.stringify(v, null, 2).replace(/\n/g, `\n${indent}`);
      return `\n${indent}${JSON.stringify(k)}: ${body},`;
    })
    .join("");
}

function sync(text: string, locale: "en" | "es"): string {
  const entries = healthAdtechMessages(locale);
  const locate = () => {
    const templates = objectRange(text, "templates", "  ", 0, text.length);
    if (!templates) throw new Error("templates namespace not found");
    const dpia = objectRange(text, "dpia", "    ", templates.open, templates.end);
    if (!dpia) throw new Error("templates.dpia not found");
    return dpia;
  };

  // 1. Remove this template's existing entries.
  for (const group of ["template", "section", "question"] as const) {
    for (const key of Object.keys(entries[group])) {
      const dpia = locate();
      const g = objectRange(text, group, "      ", dpia.open, dpia.end);
      if (g) text = removeEntry(text, key, "        ", g.open, g.end);
    }
  }

  // 2. Insert them at the start of each group (creating `template` if absent).
  for (const group of ["template", "section", "question"] as const) {
    const dpia = locate();
    const g = objectRange(text, group, "      ", dpia.open, dpia.end);
    const block = serialise(entries[group], "        ");
    if (g) {
      const inner = text.slice(g.open + 1, g.end - 1).trim();
      const insert = inner === "" ? block.replace(/,$/, "") : block;
      text = text.slice(0, g.open + 1) + insert + text.slice(g.open + 1);
    } else {
      const obj = `\n      "${group}": {${block.replace(/,$/, "")}\n      },`;
      text = text.slice(0, dpia.open + 1) + obj + text.slice(dpia.open + 1);
    }
  }
  return text;
}

for (const locale of ["en", "es"] as const) {
  const file = path.join(__dirname, "..", "src", "messages", `${locale}.json`);
  const text = sync(readFileSync(file, "utf-8"), locale);
  JSON.parse(text); // must stay valid
  writeFileSync(file, text);
  console.log(`${locale}.json: ${Object.keys(healthAdtechMessages(locale).question).length} questions written`);
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Writes assessment-template text into the message bundles
// (templates.<type>.{template,section,question}) from a bilingual source.
//
// The bundles are edited as text (only the entries named are removed and
// re-inserted) so the rest of each file keeps its hand-made layout.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type MessageGroups = {
  template?: Record<string, unknown>;
  section?: Record<string, unknown>;
  question?: Record<string, unknown>;
};

const GROUPS = ["template", "section", "question"] as const;

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

function sync(text: string, namespace: string, entries: MessageGroups): string {
  const locate = () => {
    const templates = objectRange(text, "templates", "  ", 0, text.length);
    if (!templates) throw new Error("templates namespace not found");
    const ns = objectRange(text, namespace, "    ", templates.open, templates.end);
    if (!ns) throw new Error(`templates.${namespace} not found`);
    return ns;
  };

  // 1. Remove the existing entries of every key we are about to write.
  for (const group of GROUPS) {
    for (const key of Object.keys(entries[group] ?? {})) {
      const ns = locate();
      const g = objectRange(text, group, "      ", ns.open, ns.end);
      if (g) text = removeEntry(text, key, "        ", g.open, g.end);
    }
  }

  // 2. Insert them at the start of each group (creating the group if absent).
  for (const group of GROUPS) {
    const group_entries = entries[group];
    if (!group_entries || Object.keys(group_entries).length === 0) continue;
    const ns = locate();
    const g = objectRange(text, group, "      ", ns.open, ns.end);
    const block = serialise(group_entries, "        ");
    if (g) {
      const inner = text.slice(g.open + 1, g.end - 1).trim();
      const insert = inner === "" ? block.replace(/,$/, "") : block;
      text = text.slice(0, g.open + 1) + insert + text.slice(g.open + 1);
    } else {
      const obj = `\n      "${group}": {${block.replace(/,$/, "")}\n      },`;
      text = text.slice(0, ns.open + 1) + obj + text.slice(ns.open + 1);
    }
  }
  return text;
}

/**
 * Writes `entries(locale)` into src/messages/{en,es}.json under
 * `templates.<namespace>`. Returns one log line per bundle.
 */
export function syncTemplateMessages(
  namespace: string,
  entries: (locale: "en" | "es") => MessageGroups
): string[] {
  const lines: string[] = [];
  for (const locale of ["en", "es"] as const) {
    const file = path.join(__dirname, "..", "..", "src", "messages", `${locale}.json`);
    const group = entries(locale);
    const text = sync(readFileSync(file, "utf-8"), namespace, group);
    JSON.parse(text); // must stay valid
    writeFileSync(file, text);
    lines.push(
      `${locale}.json: ${Object.keys(group.question ?? {}).length} questions, ` +
        `${Object.keys(group.section ?? {}).length} sections written`
    );
  }
  return lines;
}

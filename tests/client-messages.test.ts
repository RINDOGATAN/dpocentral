// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * src/i18n/client-messages.ts: the namespaces kept out of the browser's
 * catalogue are read by no client component, and the user guide's namespace
 * and the assessment templates' namespace are read only under their own
 * route trees, whose layouts add them back.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import en from "../src/messages/en.json";
import es from "../src/messages/es.json";
import {
  DOCS_NAMESPACE,
  ROUTE_SCOPED_NAMESPACES,
  SERVER_ONLY_NAMESPACES,
  clientMessages,
  pickNamespaces,
} from "../src/i18n/client-messages";

const ROOT = path.resolve(__dirname, "..");
function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.(ts|tsx)$/.test(name)) yield full;
  }
}
/** Where each route-scoped namespace may be read, and the layouts that add it. */
const SCOPES: Record<string, { trees: string[]; layouts: string[] }> = {
  [DOCS_NAMESPACE]: {
    trees: ["src/app/(dashboard)/privacy/docs/", "src/components/docs/"],
    layouts: ["src/app/(dashboard)/privacy/docs/layout.tsx"],
  },
};

/** Namespaces read with useTranslations, per file. */
function clientNamespaces(): Array<{ file: string; ns: string }> {
  const out: Array<{ file: string; ns: string }> = [];
  for (const file of files(path.join(ROOT, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/useTranslations\(\s*["']([A-Za-z0-9_]+)/g)) {
      out.push({ file: path.relative(ROOT, file), ns: m[1] });
    }
  }
  return out;
}

describe("clientMessages", () => {
  it("drops the server-only and route-scoped namespaces, keeps the rest", () => {
    const client = clientMessages(en as Record<string, unknown>);
    for (const ns of [...SERVER_ONLY_NAMESPACES, ...ROUTE_SCOPED_NAMESPACES]) expect(client).not.toHaveProperty(ns);
    expect(client).toHaveProperty("common");
    expect(client).toHaveProperty("pages");
    expect(Object.keys(client).length).toBe(
      Object.keys(en).length - SERVER_ONLY_NAMESPACES.length - ROUTE_SCOPED_NAMESPACES.length
    );
  });

  it("every namespace it drops exists in both catalogues (the list is not stale)", () => {
    for (const ns of [...SERVER_ONLY_NAMESPACES, ...ROUTE_SCOPED_NAMESPACES]) {
      expect(en, ns).toHaveProperty(ns);
      expect(es, ns).toHaveProperty(ns);
    }
  });

  it("pickNamespaces returns only the namespaces asked for", () => {
    expect(Object.keys(pickNamespaces(en as Record<string, unknown>, [DOCS_NAMESPACE]))).toEqual([DOCS_NAMESPACE]);
  });

  it("each route-scoped namespace is added back by its tree's layouts", () => {
    for (const ns of ROUTE_SCOPED_NAMESPACES) {
      for (const layout of SCOPES[ns].layouts) {
        const source = readFileSync(path.join(ROOT, layout), "utf8");
        expect(source, layout).toContain("ExtraMessages");
        const constant = "DOCS_NAMESPACE";
        expect(source, layout).toMatch(new RegExp(`pickNamespaces\\(await getMessages\\(\\), \\[${constant}\\]\\)`));
      }
    }
  });
});

describe("the source tree against the lists", () => {
  const uses = clientNamespaces();

  it("finds client reads (the scan works)", () => {
    expect(uses.length).toBeGreaterThan(100);
  });

  it("no client component reads a server-only namespace", () => {
    const offenders = uses.filter((u) => SERVER_ONLY_NAMESPACES.includes(u.ns));
    expect(offenders).toEqual([]);
  });

  it("each route-scoped namespace is read only under its own tree", () => {
    const offenders = uses.filter(
      (u) => ROUTE_SCOPED_NAMESPACES.includes(u.ns) && !SCOPES[u.ns].trees.some((tree) => u.file.startsWith(tree))
    );
    expect(offenders).toEqual([]);
  });

  it("every namespace a client component reads is in the browser's catalogue", () => {
    const client = clientMessages(en as Record<string, unknown>);
    const missing = uses.filter((u) => !ROUTE_SCOPED_NAMESPACES.includes(u.ns) && !(u.ns in client));
    expect(missing).toEqual([]);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Locale parity is a product feature, not an afterthought: every user-visible
 * string ships in English and in Castilian Spanish. This test compares the two
 * message bundles key by key, and fails on a key present in one and missing
 * from the other, or holding a different shape.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

type Tree = Record<string, unknown>;

/** Every leaf path of a bundle, with the kind of value it holds. */
function paths(node: unknown, prefix = "", out = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(node)) {
    out.set(prefix, `array(${node.length})`);
    return out;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Tree)) {
      paths(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, typeof node);
  return out;
}

const enPaths = paths(en);
const esPaths = paths(es);

describe("locale parity", () => {
  it("has the same keys in both bundles", () => {
    const missingInEs = [...enPaths.keys()].filter((k) => !esPaths.has(k));
    const missingInEn = [...esPaths.keys()].filter((k) => !enPaths.has(k));
    expect({ missingInEs, missingInEn }).toEqual({ missingInEs: [], missingInEn: [] });
  });

  it("holds the same kind of value at every key", () => {
    const mismatched = [...enPaths.entries()]
      .filter(([key, kind]) => esPaths.has(key) && esPaths.get(key) !== kind)
      .map(([key, kind]) => `${key}: en ${kind}, es ${esPaths.get(key)}`);
    expect(mismatched).toEqual([]);
  });

  it("carries the same placeholders at every key", () => {
    /**
     * The top-level arguments of an ICU message. Only depth 1 counts, so the
     * branches of a plural ("one {element} other {elements}") are not
     * mistaken for arguments: those words differ by language on purpose.
     */
    const placeholders = (text: unknown): string[] => {
      if (typeof text !== "string") return [];
      const names: string[] = [];
      let depth = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "}") depth--;
        else if (text[i] === "{") {
          depth++;
          if (depth !== 1) continue;
          const name = /^\s*(\w+)\s*[},]/.exec(text.slice(i + 1));
          if (name) names.push(name[1]);
        }
      }
      return names.sort();
    };
    const read = (bundle: unknown, key: string) =>
      key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], bundle);

    const mismatched: string[] = [];
    for (const [key, kind] of enPaths) {
      if (kind !== "string" || !esPaths.has(key)) continue;
      const a = placeholders(read(en, key));
      const b = placeholders(read(es, key));
      if (a.join(",") !== b.join(",")) mismatched.push(`${key}: en {${a}}, es {${b}}`);
    }
    expect(mismatched).toEqual([]);
  });

  it("does not leave a Spanish string identical to the English one by accident", () => {
    // A handful of strings are the same in both languages on purpose.
    const sameOnPurpose = /(^|\.)(DPIA|PIA|TIA|LIA|VENDOR|CUSTOM|LOW|MEDIUM|HIGH|CRITICAL)(\.|$)/;
    const identical = [...enPaths.entries()]
      .filter(([key, kind]) => kind === "string" && !sameOnPurpose.test(key))
      .map(([key]) => key)
      .filter((key) => {
        const read = (bundle: unknown) =>
          key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], bundle);
        const a = read(en);
        const b = read(es);
        return typeof a === "string" && a === b && a.length > 40;
      });
    expect(identical).toEqual([]);
  });
});

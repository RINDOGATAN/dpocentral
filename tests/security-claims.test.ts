// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public security page, its metadata, the landing page and llms-full.txt
 * describe what the code actually does. A review found claims that were not
 * accurate (zero-knowledge sign-in, a badge read as a verification by the
 * payment provider, per-request CSP nonces described as enforced, "all"
 * operations audit-logged, "GDPR ready"); this test keeps them from coming
 * back, in both languages.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const SOURCES = [
  "src/messages/en.json",
  "src/messages/es.json",
  "src/landing/i18n/en/dpo-startups.json",
  "src/landing/i18n/es/dpo-startups.json",
  "public/llms-full.txt",
  "src/app/(public)/security/page.tsx",
];

const FORBIDDEN: RegExp[] = [
  /zero[- ]knowledge/i,
  /conocimiento cero/i,
  /verified by stripe/i,
  /stripe verified/i,
  /verificado por stripe/i,
  /structurally prevented/i,
  /se previene estructuralmente/i,
  /GDPR[- ]ready/i,
  /preparado para el RGPD/i,
  /audit-ready/i,
  /Full audit logging/i,
  /Comprehensive logging for all/i,
  /Registro exhaustivo de todas/i,
  /protected against payment fraud/i,
  /protegidas contra fraude/i,
];

describe("security and landing copy makes no inaccurate claims", () => {
  for (const rel of SOURCES) {
    it(rel, () => {
      const text = read(rel);
      for (const re of FORBIDDEN) {
        expect(text, `${rel} matches ${re}`).not.toMatch(re);
      }
    });
  }

  it("security badges carry the accurate labels", () => {
    const en = JSON.parse(read("src/messages/en.json")).security.badges;
    const es = JSON.parse(read("src/messages/es.json")).security.badges;
    expect(en.noPasswords).toBe("Passwordless");
    expect(es.noPasswords).toBe("Sin contraseñas");
    expect(en.signedPaymentEvents).toBe("Stripe signatures checked");
    expect(es.signedPaymentEvents).toBe("Firmas de Stripe comprobadas");
  });
});

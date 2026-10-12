// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The vendor-catalogue quick start writes Spanish records for a Spanish
 * screen: every catalogue category mapping has a Spanish version of each
 * visible string, English stays as it is, and stored frequencies stay in the
 * English values the map labels at display.
 */

import { describe, it, expect } from "vitest";
import {
  VENDOR_DATA_MAPPINGS,
  GENERIC_VENDOR_MAPPING,
  localizeVendorMapping,
  vendorMappingFor,
  type VendorDataMapping,
} from "@/config/vendor-data-mappings";
import { VENDOR_DATA_MAPPINGS_ES, VENDOR_QUICKSTART_TEXT } from "@/config/vendor-data-mappings-es";
import { FREQUENCY_LABEL_KEYS } from "@/components/privacy/data-flow/flow-labels";

const ALL: [string, VendorDataMapping][] = [
  ...Object.entries(VENDOR_DATA_MAPPINGS),
  ["generic", GENERIC_VENDOR_MAPPING],
];

function visibleStrings(m: VendorDataMapping): string[] {
  const a = m.activity;
  const out = [
    m.label,
    m.asset.hostingType,
    m.asset.description,
    ...m.elements.map((e) => e.name),
    a.name,
    a.purpose,
    ...a.dataSubjects,
    ...a.recipients,
    a.retentionPeriod,
  ];
  if (m.returnFlow) {
    out.push(m.returnFlow.description);
    if (m.returnFlow.frequency && !(m.returnFlow.frequency in FREQUENCY_LABEL_KEYS)) {
      out.push(m.returnFlow.frequency);
    }
  }
  return out;
}

describe("vendor-catalogue quick start in Spanish", () => {
  it("every catalogue category mapping has a Spanish version of each visible string", () => {
    for (const [key, m] of ALL) {
      const missing = visibleStrings(m).filter((s) => !(s in VENDOR_DATA_MAPPINGS_ES));
      expect({ key, missing: [...new Set(missing)] }).toEqual({ key, missing: [] });
    }
  });

  it("English stays unchanged", () => {
    for (const [, m] of ALL) expect(localizeVendorMapping(m, "en")).toBe(m);
  });

  it("Spanish mappings keep enums and stored frequencies, and labels stay distinct", () => {
    const labels = new Set<string>();
    for (const [, m] of ALL) {
      const es = localizeVendorMapping(m, "es");
      expect(es.asset.type).toBe(m.asset.type);
      expect(es.activity.legalBasis).toBe(m.activity.legalBasis);
      expect(es.activity.categories).toEqual(m.activity.categories);
      expect(es.elements.map((e) => e.category)).toEqual(m.elements.map((e) => e.category));
      if (m.returnFlow?.frequency && m.returnFlow.frequency in FREQUENCY_LABEL_KEYS) {
        expect(es.returnFlow?.frequency).toBe(m.returnFlow.frequency);
      }
      labels.add(es.label);
    }
    expect(labels.size).toBe(ALL.length);
  });

  it("an unknown category falls back to the generic mapping in Spanish", () => {
    const m = vendorMappingFor("Something new", null, "es");
    expect(m.label).toBe("Servicio de terceros");
    expect(m.elements.map((e) => e.name)).toEqual(["Identificadores de usuario", "Datos de uso"]);
  });

  it("the records around each mapping are named in the screen's language", () => {
    expect(VENDOR_QUICKSTART_TEXT.es.internalSystemsName("Ejemplo, S.L.")).toBe("Sistemas internos de Ejemplo, S.L.");
    expect(VENDOR_QUICKSTART_TEXT.es.flowTo("Acme")).toBe("Flujo de datos hacia Acme");
    expect(VENDOR_QUICKSTART_TEXT.en.flowTo("Acme")).toBe("Data flow to Acme");
    expect(VENDOR_QUICKSTART_TEXT.en.internalSystemsName("Acme")).toBe("Acme Internal Systems");
  });

  it("the Spanish text has no long dash and no formal address", () => {
    const es = [
      ...Object.values(VENDOR_DATA_MAPPINGS_ES),
      VENDOR_QUICKSTART_TEXT.es.internalSystemsDescription,
      VENDOR_QUICKSTART_TEXT.es.transferSafeguards,
    ].join("\n");
    expect(es).not.toMatch(/[–—]/);
    expect(es).not.toMatch(/\busted(es)?\b|\bvosotros\b|\bprestadores?\b|\bindustria\b/i);
  });
});

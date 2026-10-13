// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import en from "../src/messages/en.json";
import es from "../src/messages/es.json";
import {
  displayAssessmentDescription,
  displayAssessmentName,
  tiaRecordDescription,
  tiaRecordName,
} from "@/lib/record-name";
import { parseReportedDescription, parseSystemTimelineTitle } from "@/lib/incident-timeline";
import { dpiaAutoFillText } from "@/server/services/privacy/dpia-auto-fill-text";

const DSAR_TYPES = [
  "ACCESS", "RECTIFICATION", "ERASURE", "PORTABILITY", "OBJECTION", "RESTRICTION",
  "AUTOMATED_DECISION", "WITHDRAW_CONSENT", "OPT_OUT_SALE_SHARING", "LIMIT_SENSITIVE_PI", "OTHER",
];

describe("rights-request list labels", () => {
  it("cover every request type in both languages", () => {
    for (const bundle of [en, es]) {
      const labels = bundle.pages.dsar.type as Record<string, string>;
      for (const type of DSAR_TYPES) expect(labels[type], type).toBeTruthy();
    }
  });
});

describe("the transfer impact assessment the app opens for a transfer", () => {
  it("is named and described in the language of the screen", () => {
    expect(tiaRecordName("Hosting in the US", "en")).toBe("TIA: Hosting in the US");
    expect(tiaRecordName("Alojamiento en EE. UU.", "es")).toBe("EIT: Alojamiento en EE. UU.");
    expect(tiaRecordDescription("US", "es")).toBe("Evaluación de impacto de la transferencia a US.");
  });

  it("shows a stored name and description in the viewer's language", () => {
    expect(displayAssessmentName("TIA: Plataforma de selección", "es")).toBe("EIT: Plataforma de selección");
    expect(displayAssessmentName("EIT: Plataforma de selección", "en")).toBe("TIA: Plataforma de selección");
    expect(displayAssessmentDescription("Transfer Impact Assessment for transfer to US.", "es")).toBe(
      "Evaluación de impacto de la transferencia a US.",
    );
    expect(displayAssessmentName("TIAs review", "es")).toBe("TIAs review");
    expect(displayAssessmentDescription("Typed by a person.", "es")).toBe("Typed by a person.");
  });
});

describe("timeline entries written by the incident router", () => {
  it("are recognised", () => {
    expect(parseSystemTimelineTitle("Incident Reported")).toEqual({ kind: "reported" });
    expect(parseSystemTimelineTitle("Status changed to CLOSED")).toEqual({ kind: "statusChanged", status: "CLOSED" });
    expect(parseSystemTimelineTitle("DPA notification created (General Data Protection Regulation)")).toEqual({
      kind: "notificationCreated", recipient: "DPA", jurisdiction: "General Data Protection Regulation",
    });
    expect(parseSystemTimelineTitle("DPA notification sent")).toEqual({ kind: "notificationStatus", recipient: "DPA", status: "SENT" });
    expect(parseSystemTimelineTitle("Marked as recorded in error")).toEqual({ kind: "markedInError" });
    expect(parseReportedDescription('Incident "Lost laptop" was reported')).toBe("Lost laptop");
  });

  it("leave entries typed by a person alone", () => {
    expect(parseSystemTimelineTitle("Envío detenido")).toBeNull();
    expect(parseSystemTimelineTitle("Status meeting with the DPO")).toBeNull();
    expect(parseReportedDescription("Se ha parado la campaña.")).toBeNull();
  });

  it("have labels in both languages", () => {
    for (const bundle of [en, es]) {
      const d = bundle.pages.incidentDetail;
      for (const key of ["reported", "reportedBody", "statusChanged", "notificationCreated", "notificationStatus", "markedInError", "unmarkedInError"]) {
        expect((d.timeline.system as Record<string, string>)[key], key).toBeTruthy();
      }
      for (const key of ["DPA", "DATA_SUBJECT", "LAW_ENFORCEMENT", "INTERNAL"]) {
        expect((d.notifications.recipient as Record<string, string>)[key], key).toBeTruthy();
      }
    }
  });
});

describe("the rule-based DPIA auto-fill", () => {
  const es = dpiaAutoFillText("es");
  const enText = dpiaAutoFillText("en");

  it("writes Spanish drafts for a Spanish screen", () => {
    expect(es.dataCategories(["IDENTIFIERS", "FINANCIAL"], ["IBAN", "IBAN", "Nombre"], [])).toBe(
      "Categorías de datos tratadas: Identificadores, Datos financieros. Elementos de datos concretos: IBAN, Nombre.",
    );
    expect(es.retention("5 años", 1825)).toBe(
      "Plazo de conservación: 5 años (1825 días). Al terminar el plazo, los datos se suprimen o se anonimizan.",
    );
    expect(
      es.transfers([{ destinationCountry: "US", mechanism: "STANDARD_CONTRACTUAL_CLAUSES", safeguards: "Cláusulas tipo y cifrado." }]),
    ).toBe("Transferencias internacionales de datos: US (cláusulas contractuales tipo). Garantías: Cláusulas tipo y cifrado.");
    expect(es.risks({ specialCategory: false, transferDestinations: 1, largeScale: true })).toMatch(
      /^Factores de riesgo detectados: transferencias internacionales a 1 destino, tratamiento a gran escala\./,
    );
    expect(es.minimisation(15, 3, "Proteger a los clientes.")).toMatch(/finalidad declarada: Proteger a los clientes\. Se ha/);
  });

  it("keeps the English wording, without a doubled full stop", () => {
    expect(enText.retention("5 years", null)).toBe(
      "Data retention period: 5 years. Data is deleted or anonymized after the retention period expires.",
    );
    expect(enText.minimisation(2, 1, "Billing.")).toBe(
      "The processing of 2 data elements across 1 system(s) is necessary to achieve the stated purpose: Billing. Data minimization has been considered. Only data elements essential to the processing purpose are collected.",
    );
  });

  it("has no long dash in either language", () => {
    const all = [es, enText].flatMap((t) => [
      t.purposeFallback,
      t.risks({ specialCategory: true, transferDestinations: 2, largeScale: true }),
      ...Object.values(t.source),
    ]);
    for (const s of all) expect(s).not.toMatch(/—/);
  });
});

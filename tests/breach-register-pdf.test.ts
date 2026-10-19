// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The breach register PDF (GDPR Art. 33(5)):
 *   - prints each incident's full reference (not cut to "INC-2026");
 *   - prints type, severity, status, data categories and notification
 *     status in the report's language, with the same `enums` labels the CSV
 *     uses;
 *   - says who each notification is addressed to (authority or data
 *     subjects), with its deadline and reference;
 *   - counts as pending every flagged incident whose authority has not been
 *     notified, including one with no notification row yet;
 *   - flags a notifiable incident whose deadline has passed unnotified;
 *   - prints the resolution notes; the CSV guards against formula cells.
 */

import { describe, it, expect } from "vitest";
import {
  BreachRegisterReport,
  authorityNotificationOverdue,
  authorityNotificationOwed,
  incidentsToCSV,
  type IncidentExportData,
} from "@/server/services/export/breach-register";
import { withPdfLocale } from "@/server/services/export/pdf-locale";
import es from "@/messages/es.json";
import { collectText } from "./pdf-text";

const NOW = new Date();
const HOURS = 60 * 60 * 1000;

function incident(over: Partial<IncidentExportData> = {}): IncidentExportData {
  return {
    id: "i1",
    publicId: "INC-2026-0001",
    title: "Lost laptop",
    description: "A laptop was lost",
    type: "UNAUTHORIZED_ACCESS",
    severity: "HIGH",
    status: "INVESTIGATING",
    discoveredAt: new Date(NOW.getTime() - 10 * 24 * HOURS),
    discoveredBy: null,
    discoveryMethod: null,
    affectedRecords: 15000,
    affectedSubjects: [],
    dataCategories: ["IDENTIFIERS", "BEHAVIORAL"],
    containedAt: null,
    containmentActions: null,
    rootCause: null,
    resolvedAt: null,
    resolutionNotes: "Device wiped remotely",
    lessonsLearned: null,
    notificationRequired: true,
    notificationDeadline: null,
    createdAt: NOW,
    notifications: [],
    timeline: [],
    ...over,
  };
}

type Tr = (key: string) => string;
/** The Spanish pdf.breachRegister messages, as next-intl would serve them. */
const esT: Tr = (key) => {
  let cur: unknown = es.pdf.breachRegister;
  for (const part of key.split(".")) cur = (cur as Record<string, unknown> | undefined)?.[part];
  return typeof cur === "string" ? cur : key;
};

function textOf(incidents: IncidentExportData[], locale: "en" | "es"): string {
  return withPdfLocale(locale, () =>
    collectText(
      BreachRegisterReport({ incidents, orgName: "Org", locale, t: locale === "es" ? (esT as never) : undefined }),
    ).join(" | "),
  );
}

describe("breach register PDF", () => {
  const second = incident({
    id: "i2",
    publicId: "INC-2026-0002",
    title: "Phishing",
    notifications: [
      {
        status: "SENT",
        recipientType: "DATA_SUBJECT",
        notificationDate: NOW,
        deadline: NOW,
        referenceNumber: null,
        jurisdiction: { name: "Reglamento General de Protección de Datos (RGPD)", code: "GDPR" },
      },
      {
        status: "DRAFTED",
        recipientType: "DPA",
        notificationDate: null,
        deadline: NOW,
        referenceNumber: "AEPD-123",
        jurisdiction: { name: "Reglamento General de Protección de Datos (RGPD)", code: "GDPR" },
      },
    ],
  });

  it("prints full incident references", () => {
    const text = textOf([incident(), second], "en");
    expect(text).toContain("INC-2026-0001");
    expect(text).toContain("INC-2026-0002");
  });

  it("prints no raw codes in Spanish, and uses the CSV's labels", () => {
    const text = textOf([incident(), second], "es");
    for (const code of ["INVESTIGATING", "UNAUTHORIZED ACCESS", "IDENTIFIERS", "BEHAVIORAL", "DRAFTED", "DATA_SUBJECT"]) {
      expect(text).not.toContain(code);
    }
    expect(text).toContain(es.enums.incidentStatus.INVESTIGATING);
    expect(text).toContain(es.enums.incidentType.UNAUTHORIZED_ACCESS);
    expect(text).toContain(es.enums.dataCategory.IDENTIFIERS);
    expect(text).toContain(es.enums.notificationStatus.DRAFTED);
    expect(text).toContain(es.pdf.breachRegister.notificationColumns.recipientType.DATA_SUBJECT);
    expect(text).toContain("AEPD-123");
    expect(text).toContain("15.000");
  });

  it("prints the resolution notes", () => {
    expect(textOf([incident()], "en")).toContain("Device wiped remotely");
  });

  it("flags a notifiable incident past its deadline with the authority not notified", () => {
    expect(textOf([incident()], "es")).toContain(es.pdf.breachRegister.overdue);
    // Notified: no flag.
    const notified = incident({
      notifications: [
        {
          status: "SENT",
          recipientType: "DPA",
          notificationDate: NOW,
          jurisdiction: { name: "GDPR", code: "GDPR" },
        },
      ],
    });
    expect(textOf([notified], "es")).not.toContain(es.pdf.breachRegister.overdue);
  });

  it("counts as pending a flagged incident with no notification row, or only a data-subject one", () => {
    expect(authorityNotificationOwed(incident())).toBe(true);
    expect(authorityNotificationOwed(second)).toBe(true);
    expect(
      authorityNotificationOwed(
        incident({
          notifications: [{ status: "ACKNOWLEDGED", recipientType: "DPA", notificationDate: NOW, jurisdiction: { name: "x", code: "x" } }],
        }),
      ),
    ).toBe(false);
    expect(authorityNotificationOwed(incident({ notificationRequired: false }))).toBe(false);
  });

  it("is not overdue inside the window or once closed", () => {
    expect(authorityNotificationOverdue(incident({ discoveredAt: new Date(NOW.getTime() - HOURS) }), NOW)).toBe(false);
    expect(authorityNotificationOverdue(incident({ status: "CLOSED" }), NOW)).toBe(false);
    expect(authorityNotificationOverdue(incident(), NOW)).toBe(true);
  });

  it("the CSV neutralises a cell a spreadsheet would read as a formula", () => {
    const csv = incidentsToCSV([incident({ title: "=HYPERLINK(\"http://x\")" })]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});

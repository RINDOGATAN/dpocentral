// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Notify the authority?" has three answers: yes (flagged), no (not flagged,
 * a notification record exists) and not yet assessed (not flagged, nothing
 * recorded). A new incident the rule does not flag reads "not yet assessed",
 * on the incident page, in the breach register PDF and in its CSV, in EN and ES.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { authorityNotificationAssessment } from "@/lib/breach-window";
import { assessmentWord, incidentsToCSV, type IncidentExportData } from "@/server/services/export/breach-register";
import { CSV_WORDS_EN } from "@/server/services/export/csv-labels";

function incident(over: Partial<IncidentExportData> = {}): IncidentExportData {
  return {
    id: "inc-1",
    publicId: "INC-1",
    title: "Lost laptop",
    description: "",
    type: "DATA_LOSS",
    severity: "LOW",
    status: "REPORTED",
    discoveredAt: new Date("2026-10-01T10:00:00Z"),
    discoveredBy: null,
    discoveryMethod: null,
    affectedRecords: null,
    affectedSubjects: [],
    dataCategories: [],
    containedAt: null,
    containmentActions: null,
    rootCause: null,
    resolvedAt: null,
    resolutionNotes: null,
    lessonsLearned: null,
    notificationRequired: false,
    notificationDeadline: null,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    notifications: [],
    timeline: [],
    ...over,
  };
}

const notification = { status: "NOT_REQUIRED", recipientType: "DPA", notificationDate: null, jurisdiction: { name: "Spain", code: "ES" } };

describe("authorityNotificationAssessment", () => {
  it("a new, unflagged incident with nothing recorded is not yet assessed", () => {
    expect(authorityNotificationAssessment({ notificationRequired: false, notifications: [] })).toBe("NOT_ASSESSED");
    expect(authorityNotificationAssessment({ notificationRequired: false })).toBe("NOT_ASSESSED");
    expect(authorityNotificationAssessment({ notificationRequired: false, notifications: null })).toBe("NOT_ASSESSED");
  });

  it("flagged reads yes; unflagged with a notification record reads no", () => {
    expect(authorityNotificationAssessment({ notificationRequired: true, notifications: [] })).toBe("REQUIRED");
    expect(authorityNotificationAssessment({ notificationRequired: false, notifications: [notification] })).toBe("NOT_REQUIRED");
  });

  it("assessmentWord picks the word for each answer", () => {
    const w = { yes: "Y", no: "N", notAssessed: "?" };
    expect(assessmentWord("REQUIRED", w)).toBe("Y");
    expect(assessmentWord("NOT_REQUIRED", w)).toBe("N");
    expect(assessmentWord("NOT_ASSESSED", w)).toBe("?");
  });
});

describe("the breach register CSV", () => {
  const cell = (csv: string) => {
    const row = csv.split("\n")[1]!;
    const cells = row.slice(1, -1).split('","');
    return cells[14];
  };

  it("writes 'Not yet assessed' for a new incident, Yes and No otherwise", () => {
    expect(cell(incidentsToCSV([incident()]))).toBe("Not yet assessed");
    expect(cell(incidentsToCSV([incident({ notificationRequired: true })]))).toBe("Yes");
    expect(cell(incidentsToCSV([incident({ notifications: [notification] })]))).toBe("No");
    expect(CSV_WORDS_EN.notAssessed).toBe("Not yet assessed");
  });
});

describe("the words, in English and Spanish", () => {
  it("are in both bundles", () => {
    expect(en.pdf.csv.words.notAssessed).toBe("Not yet assessed");
    expect(es.pdf.csv.words.notAssessed).toBe("Aún sin evaluar");
    expect(en.pdf.breachRegister.meta.notAssessed).toBe("Not yet assessed");
    expect(es.pdf.breachRegister.meta.notAssessed).toBe("Aún sin evaluar");
    expect(en.pages.incidentDetail.stats.notifyAuthorityState).toEqual({
      REQUIRED: "Yes",
      NOT_REQUIRED: "No",
      NOT_ASSESSED: "Not yet assessed",
    });
    expect(es.pages.incidentDetail.stats.notifyAuthorityState).toEqual({
      REQUIRED: "Sí",
      NOT_REQUIRED: "No",
      NOT_ASSESSED: "Aún sin evaluar",
    });
    expect(en.pages.incidentDetail.stats.notifyAuthority).toBe("Notify the authority: {state}");
    expect(es.pages.incidentDetail.stats.notifyAuthority).toBe("Notificar a la autoridad: {state}");
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Recurring obligations derived from the produced DPA (INSTRUCTIONS.md §10):
 * the same facts that rendered the document imply a compliance calendar —
 * TIA re-evaluation, the transparency-report cadence bought by the
 * government-access clause, the confirmed TOMs' own cadences, and the two
 * notice windows. Stored with the contract and used to pull the vendor's
 * next review forward.
 */

import { getDpaPack } from "./pack";
import { evalShowIf } from "./interpolate";
import { applyFactDefaults, buildVariables } from "./variables";
import { splitMulti } from "./multi";
import type { AssembleInput, DpaLang } from "./types";

export type ObligationCadence =
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUAL"
  | "ON_EVENT";

export interface DerivedObligation {
  code: string;
  cadence: ObligationCadence;
  /** First due date for scheduled cadences; undefined for ON_EVENT windows. */
  firstDue?: string; // ISO date
  label: Record<DpaLang, string>;
}

function addMonths(date: Date, months: number): string {
  // Clamp to the target month's last day: a naive setUTCMonth on Jan 31
  // + 1 month would overflow to Mar 3 and skip February entirely.
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const d = new Date(
    Date.UTC(year, monthIndex, Math.min(date.getUTCDate(), lastDay))
  );
  return d.toISOString().slice(0, 10);
}

const BREACH_WINDOW_LABEL: Record<string, Record<DpaLang, string>> = {
  "breach-24h": { en: "24 hours", es: "24 horas" },
  "breach-48h": { en: "48 hours", es: "48 horas" },
  "breach-72h": { en: "72 hours", es: "72 horas" },
  "breach-undue-delay": { en: "without undue delay", es: "sin dilación indebida" },
};

const SUBPROC_NOTICE_LABEL: Record<string, Record<DpaLang, string>> = {
  "subproc-general-30d": { en: "30 days' notice", es: "30 días de preaviso" },
  "subproc-general-14d": { en: "14 days' notice", es: "14 días de preaviso" },
  "subproc-specific": {
    en: "prior specific authorisation",
    es: "autorización específica previa",
  },
  "subproc-no-objection": {
    en: "notice without objection right",
    es: "notificación sin derecho de oposición",
  },
};

export function deriveObligations(input: AssembleInput): DerivedObligation[] {
  const pack = getDpaPack();
  const facts = applyFactDefaults(input.facts, pack.parameters);
  const variables = buildVariables(facts, input.selections, input.context, pack);
  const effective = input.context.effectiveDate;
  const obligations: DerivedObligation[] = [];

  // TIA re-evaluation every 12 months — only when Annex IV actually renders.
  const tiaAnnex = pack.boilerplate.annexes.find((a) => {
    const conditions = Array.isArray(a.showIf) ? a.showIf : a.showIf ? [a.showIf] : [];
    return conditions.some((c) => c.variable === "includeTia");
  });
  if (tiaAnnex && evalShowIf(tiaAnnex.showIf, variables)) {
    obligations.push({
      code: "tia-reevaluation",
      cadence: "ANNUAL",
      firstDue: addMonths(effective, 12),
      label: {
        en: "Re-evaluate the Transfer Impact Assessment (Annex IV) and refresh the importer's declarations",
        es: "Reevaluar la Evaluación de Impacto de la Transferencia (Anexo IV) y renovar las declaraciones del importador",
      },
    });
  }

  // Annual aggregate transparency report — bought by the government-access
  // clause's commitments option.
  const govClause = pack.clauses.find((c) => c.id === "government-access-requests");
  const govOption = govClause?.options.find(
    (o) => o.id === input.selections["government-access-requests"]
  );
  if (govOption?.code === "commitments") {
    obligations.push({
      code: "gov-access-transparency-report",
      cadence: "ANNUAL",
      firstDue: addMonths(effective, 12),
      label: {
        en: "Obtain the Processor's annual aggregate transparency report on government access requests",
        es: "Obtener el informe anual agregado de transparencia del Encargado sobre solicitudes gubernamentales de acceso",
      },
    });
  }

  // Confirmed TOMs cadences (only measures the document actually asserts).
  const confirmed = splitMulti(facts["toms-confirmed"]);
  if (confirmed.includes("toms-access-reviews")) {
    obligations.push({
      code: "toms-access-reviews",
      cadence: "QUARTERLY",
      firstDue: addMonths(effective, 3),
      label: {
        en: "Verify the Processor's quarterly access-rights reviews",
        es: "Verificar las revisiones trimestrales de derechos de acceso del Encargado",
      },
    });
  }
  if (confirmed.includes("toms-testing")) {
    obligations.push({
      code: "toms-vulnerability-scans",
      cadence: "MONTHLY",
      firstDue: addMonths(effective, 1),
      label: {
        en: "Verify the Processor's monthly vulnerability scans",
        es: "Verificar los escaneos mensuales de vulnerabilidades del Encargado",
      },
    });
    obligations.push({
      code: "toms-penetration-test",
      cadence: "ANNUAL",
      firstDue: addMonths(effective, 12),
      label: {
        en: "Obtain the Processor's annual penetration-test attestation",
        es: "Obtener la certificación anual de la prueba de penetración del Encargado",
      },
    });
  }
  if (confirmed.includes("toms-backup-dr")) {
    obligations.push({
      code: "toms-restore-test",
      cadence: "ANNUAL",
      firstDue: addMonths(effective, 12),
      label: {
        en: "Verify the Processor's annual backup-restore test",
        es: "Verificar la prueba anual de restauración de copias de seguridad del Encargado",
      },
    });
  }

  // Notice windows — event-driven, recorded so the register reflects them.
  const breach = BREACH_WINDOW_LABEL[input.selections["breach-notification"] ?? ""];
  if (breach) {
    obligations.push({
      code: "breach-notification-window",
      cadence: "ON_EVENT",
      label: {
        en: `Personal-data-breach notification window: ${breach.en}`,
        es: `Plazo de notificación de violaciones de datos: ${breach.es}`,
      },
    });
  }
  const subproc = SUBPROC_NOTICE_LABEL[input.selections["subprocessor-approval"] ?? ""];
  if (subproc) {
    obligations.push({
      code: "subprocessor-notice",
      cadence: "ON_EVENT",
      label: {
        en: `Sub-processor changes: ${subproc.en}`,
        es: `Cambios de subencargados: ${subproc.es}`,
      },
    });
  }

  return obligations;
}

/** Earliest scheduled due date across the derived obligations, if any. */
export function earliestObligationDue(
  obligations: DerivedObligation[]
): Date | null {
  const dues = obligations
    .map((o) => o.firstDue)
    .filter((d): d is string => !!d)
    .sort();
  return dues.length ? new Date(dues[0]!) : null;
}

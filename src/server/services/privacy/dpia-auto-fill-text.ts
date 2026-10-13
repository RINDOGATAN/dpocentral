// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The wording of the rule-based DPIA auto-fill (assessment.generateDpiaFromActivity),
 * in the language of the screen that asks for it. The drafts are saved as the
 * assessment's answers, so they are written once, in that language. Record
 * names and free text typed by a person (activity purpose, recipients, data
 * subjects, element names, safeguards) are quoted as stored.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

export type AutoFillLocale = "en" | "es";

export function autoFillLocale(locale: string | null | undefined): AutoFillLocale {
  return locale === "es" ? "es" : "en";
}

const ENUMS = { en: enMessages.enums, es: esMessages.enums } as const;

/** A sentence's text without its closing full stop, so a template can add one. */
function clause(text: string): string {
  return text.trim().replace(/[.。]+$/, "");
}

function label(map: Record<string, string>, code: string): string {
  return map[code] ?? code.replace(/_/g, " ");
}

export interface AutoFillTransfer {
  destinationCountry: string;
  mechanism: string;
  safeguards: string | null;
}

export interface AutoFillText {
  purposeFallback: string;
  dataCategories(categories: string[], elementNames: string[], specialNames: string[]): string;
  recipients(recipients: string[]): string;
  processedBy(vendorName: string, certifications: string[]): string;
  dataSubjects(subjects: string[]): string;
  retention(period: string, days: number | null): string;
  transfers(transfers: AutoFillTransfer[]): string;
  minimisation(elementCount: number, assetCount: number, purpose: string): string;
  risks(factors: { specialCategory: boolean; transferDestinations: number; largeScale: boolean }): string;
  source: {
    purpose: string;
    legalBasis: string;
    elements: string;
    specialElements: string;
    recipients: string;
    retention: string;
    transfers: string;
    minimisation: string;
    risks: string;
  };
}

const unique = (xs: string[]) => [...new Set(xs)];

const EN: AutoFillText = {
  purposeFallback: "Processing activity as part of organizational operations.",
  dataCategories: (categories, elementNames, specialNames) =>
    `Data categories processed: ${categories.join(", ")}. Specific data elements include: ${unique(elementNames).join(", ")}.${
      specialNames.length > 0
        ? ` Special category data is processed: ${unique(specialNames).join(", ")}. Additional safeguards are required under Art. 9 GDPR.`
        : ""
    }`,
  recipients: (recipients) => `Data recipients: ${recipients.join(", ")}.`,
  processedBy: (vendorName, certifications) =>
    `Data is processed by ${vendorName}.${certifications.length > 0 ? ` ${vendorName} holds: ${certifications.join(", ")}.` : ""}`,
  dataSubjects: (subjects) => `Data subjects affected: ${subjects.join(", ")}.`,
  retention: (period, days) =>
    `Data retention period: ${clause(period)}${days ? ` (${days} days)` : ""}. Data is deleted or anonymized after the retention period expires.`,
  transfers: (transfers) => {
    const summary = transfers.map((t) => `${t.destinationCountry} (${t.mechanism.replace(/_/g, " ")})`).join("; ");
    const safeguards = transfers.filter((t) => t.safeguards).map((t) => clause(t.safeguards!));
    return `International data transfers: ${summary}. ${
      safeguards.length > 0 ? `Safeguards include: ${safeguards.join("; ")}.` : "Appropriate safeguards must be verified."
    }`;
  },
  minimisation: (elementCount, assetCount, purpose) =>
    `The processing of ${elementCount} data elements across ${assetCount} system(s) is necessary to achieve the stated purpose: ${clause(purpose)}. Data minimization has been considered. Only data elements essential to the processing purpose are collected.`,
  risks: ({ specialCategory, transferDestinations, largeScale }) => {
    const factors = [
      ...(specialCategory ? ["special category data processed"] : []),
      ...(transferDestinations > 0 ? [`international transfers to ${transferDestinations} destination(s)`] : []),
      ...(largeScale ? ["large-scale data processing"] : []),
    ];
    return factors.length > 0
      ? `Risk factors identified: ${factors.join(", ")}. Mitigation measures should address each factor. Overall risk level requires assessment against the likelihood and severity of harm to data subjects.`
      : "No elevated risk factors identified based on available data. Standard data protection measures apply.";
  },
  source: {
    purpose: "Processing activity purpose",
    legalBasis: "Processing activity legal basis",
    elements: "Linked data elements",
    specialElements: "Special category data elements",
    recipients: "Processing activity recipients",
    retention: "Processing activity retention policy",
    transfers: "Data transfer records",
    minimisation: "Activity and data element analysis",
    risks: "Automated risk factor analysis",
  },
};

const ES: AutoFillText = {
  purposeFallback: "Actividad de tratamiento propia de la actividad de la organización.",
  dataCategories: (categories, elementNames, specialNames) =>
    `Categorías de datos tratadas: ${categories.map((c) => label(ENUMS.es.dataCategory, c)).join(", ")}. Elementos de datos concretos: ${unique(elementNames).join(", ")}.${
      specialNames.length > 0
        ? ` Se tratan categorías especiales de datos: ${unique(specialNames).join(", ")}. El art. 9 del RGPD exige garantías adicionales.`
        : ""
    }`,
  recipients: (recipients) => `Destinatarios de los datos: ${recipients.join(", ")}.`,
  processedBy: (vendorName, certifications) =>
    `Encargado del tratamiento: ${vendorName}.${certifications.length > 0 ? ` Certificaciones de ${vendorName}: ${certifications.join(", ")}.` : ""}`,
  dataSubjects: (subjects) => `Interesados afectados: ${subjects.join(", ")}.`,
  retention: (period, days) =>
    `Plazo de conservación: ${clause(period)}${days ? ` (${days} días)` : ""}. Al terminar el plazo, los datos se suprimen o se anonimizan.`,
  transfers: (transfers) => {
    const summary = transfers
      .map((t) => `${t.destinationCountry} (${label(ENUMS.es.transferMechanism, t.mechanism).toLowerCase()})`)
      .join("; ");
    const safeguards = transfers.filter((t) => t.safeguards).map((t) => clause(t.safeguards!));
    return `Transferencias internacionales de datos: ${summary}. ${
      safeguards.length > 0 ? `Garantías: ${safeguards.join("; ")}.` : "Hay que verificar que existen garantías adecuadas."
    }`;
  },
  minimisation: (elementCount, assetCount, purpose) =>
    `El tratamiento de ${elementCount} elementos de datos en ${assetCount} ${assetCount === 1 ? "sistema" : "sistemas"} es necesario para la finalidad declarada: ${clause(purpose)}. Se ha tenido en cuenta la minimización de datos: solo se recogen los elementos imprescindibles para esa finalidad.`,
  risks: ({ specialCategory, transferDestinations, largeScale }) => {
    const factors = [
      ...(specialCategory ? ["se tratan categorías especiales de datos"] : []),
      ...(transferDestinations > 0
        ? [`transferencias internacionales a ${transferDestinations} ${transferDestinations === 1 ? "destino" : "destinos"}`]
        : []),
      ...(largeScale ? ["tratamiento a gran escala"] : []),
    ];
    return factors.length > 0
      ? `Factores de riesgo detectados: ${factors.join(", ")}. Las medidas de mitigación deben responder a cada uno. El nivel de riesgo general debe valorarse según la probabilidad y la gravedad del daño para los interesados.`
      : "Con los datos disponibles no se detectan factores de riesgo elevados. Se aplican las medidas habituales de protección de datos.";
  },
  source: {
    purpose: "Finalidad de la actividad de tratamiento",
    legalBasis: "Base jurídica de la actividad de tratamiento",
    elements: "Elementos de datos vinculados",
    specialElements: "Elementos de datos de categorías especiales",
    recipients: "Destinatarios de la actividad de tratamiento",
    retention: "Plazo de conservación de la actividad de tratamiento",
    transfers: "Registros de transferencias",
    minimisation: "Análisis de la actividad y de sus elementos de datos",
    risks: "Análisis automático de factores de riesgo",
  },
};

export function dpiaAutoFillText(locale: string | null | undefined): AutoFillText {
  return autoFillLocale(locale) === "es" ? ES : EN;
}

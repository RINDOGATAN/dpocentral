// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * §7 consistency rules — these facts become representations in a signable
 * document, so contradictions require explicit human confirmation before
 * generation. Evaluated at fact-collection time (mapper output and UI),
 * not inside the assembly.
 */

import type { ConsistencyIssue, DpaFacts } from "./types";

/** Directly identifying categories incompatible with a pseudonymization claim. */
const IDENTIFYING_CATEGORIES = [
  "contact-details",
  "identification-data",
  "financial-data",
  "account-credentials",
];

function splitMulti(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the §7 contradictions present in the facts. An empty array means
 * no confirmation is needed. The caller must not generate documents while
 * issues remain unconfirmed.
 */
export function checkFactConsistency(facts: DpaFacts): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const safeguards = splitMulti(facts["tia-safeguards"]);
  const categories = splitMulti(facts["data-categories"]);

  if (
    safeguards.includes("tech-pseudonymization") &&
    categories.some((c) => IDENTIFYING_CATEGORIES.includes(c))
  ) {
    issues.push({
      code: "pseudonymization-identifying-data",
      message: {
        en: "Pseudonymization is claimed as a supplementary measure while directly identifying data categories (contact, identification, financial or credential data) are transferred. Confirm this claim is accurate before generating.",
        es: "Se declara la seudonimización como medida suplementaria mientras se transfieren categorías de datos directamente identificativas (contacto, identificación, financieros o credenciales). Confirme que la declaración es exacta antes de generar.",
      },
    });
  }

  const establishment = (facts["processor-establishment"] ?? "").trim();
  if (
    safeguards.includes("tech-eu-residency") &&
    (establishment === "US" || establishment === "OTHER")
  ) {
    issues.push({
      code: "eu-residency-noneea-processor",
      message: {
        en: "EEA data residency is claimed for a processor established outside the EEA/UK. Confirm the claim; note it will surface in Annex I's processing description automatically.",
        es: "Se declara residencia de datos en el EEE para un encargado establecido fuera del EEE/Reino Unido. Confirme la declaración; se reflejará automáticamente en la descripción del tratamiento del Anexo I.",
      },
    });
  }

  return issues;
}

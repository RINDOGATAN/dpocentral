// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The breach-readiness confirmation of step 5 ("Respond and improve"): what
 * the DPO confirms once, dated, so the step is done before any breach happens.
 *
 * Each law the organisation has declared is shown with its notification
 * deadline. Only deadlines checked against an official source are stated; any
 * other declared law is shown with a neutral line asking the DPO to check the
 * deadline in that law (never a guessed figure). Sources are cited next to
 * each entry, with the date they were read.
 *
 * Pure leaf module: read by the page, the server and the board report.
 */

import { JURISDICTION_CATALOG } from "./jurisdiction-catalog";
import { JURISDICTION_CATALOG_ES } from "./jurisdiction-catalog-es";

export type ReadinessLocale = "en" | "es";

interface DeadlineText {
  /** To the supervisory authority. */
  authority: string;
  /** To the people affected. */
  individuals: string;
}

interface VerifiedDeadline {
  en: DeadlineText;
  es: DeadlineText;
  /** Official source and the date it was read. */
  source: string;
}

/**
 * Verified deadlines, by catalog code. Every entry quotes the law's own
 * terms; nothing here is a rule of thumb.
 */
export const VERIFIED_BREACH_DEADLINES: Readonly<Record<string, VerifiedDeadline>> = {
  // Regulation (EU) 2016/679, Art. 33(1) and 34(1).
  // https://eur-lex.europa.eu/eli/reg/2016/679/oj (text identical to the
  // retained UK version read on legislation.gov.uk on 26 Oct 2026).
  GDPR: {
    en: {
      authority:
        "Without undue delay and, where feasible, not later than 72 hours after becoming aware of the breach, unless it is unlikely to result in a risk to people (Art. 33). A later notification must give the reasons for the delay.",
      individuals: "Without undue delay, when the breach is likely to result in a high risk to them (Art. 34).",
    },
    es: {
      authority:
        "Sin dilación indebida y, de ser posible, a más tardar 72 horas después de haber tenido constancia de la brecha, salvo que sea improbable que suponga un riesgo para las personas (art. 33). Si se notifica más tarde, hay que indicar los motivos del retraso.",
      individuals: "Sin dilación indebida, cuando sea probable que la brecha entrañe un alto riesgo para ellas (art. 34).",
    },
    source: "https://eur-lex.europa.eu/eli/reg/2016/679/oj (read 26 Oct 2026)",
  },
  // UK GDPR, Art. 33(1) and 34(1). https://www.legislation.gov.uk/eur/2016/679/article/33
  // (read 26 Oct 2026).
  "UK-GDPR": {
    en: {
      authority:
        "Without undue delay and, where feasible, not later than 72 hours after becoming aware of the breach, to the Information Commissioner, unless it is unlikely to result in a risk to people (Art. 33). A later notification must give the reasons for the delay.",
      individuals: "Without undue delay, when the breach is likely to result in a high risk to them (Art. 34).",
    },
    es: {
      authority:
        "Sin dilación indebida y, de ser posible, a más tardar 72 horas después de haber tenido constancia de la brecha, al Information Commissioner, salvo que sea improbable que suponga un riesgo para las personas (art. 33). Si se notifica más tarde, hay que indicar los motivos del retraso.",
      individuals: "Sin dilación indebida, cuando sea probable que la brecha entrañe un alto riesgo para ellas (art. 34).",
    },
    source: "https://www.legislation.gov.uk/eur/2016/679/article/33 (read 26 Oct 2026)",
  },
  // Spain applies the GDPR directly; the LOPDGDD adds no separate deadline.
  // Same source as GDPR (read 26 Oct 2026).
  LOPDGDD: {
    en: {
      authority:
        "The GDPR deadline applies directly in Spain: without undue delay and, where feasible, within 72 hours of becoming aware of the breach, to the AEPD (GDPR Art. 33).",
      individuals: "Without undue delay, when the breach is likely to result in a high risk to them (GDPR Art. 34).",
    },
    es: {
      authority:
        "En España se aplica directamente el plazo del RGPD: sin dilación indebida y, de ser posible, en 72 horas desde que se ha tenido constancia de la brecha, a la AEPD (art. 33 del RGPD).",
      individuals: "Sin dilación indebida, cuando sea probable que la brecha entrañe un alto riesgo para ellas (art. 34 del RGPD).",
    },
    source: "https://eur-lex.europa.eu/eli/reg/2016/679/oj (read 26 Oct 2026)",
  },
  // PIPEDA s. 10.1(1), (2), (3) and (6).
  // https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-3.html (read 26 Oct 2026).
  PIPEDA: {
    en: {
      authority:
        "As soon as feasible after determining that the breach has occurred, to the Privacy Commissioner, when it is reasonable to believe it creates a real risk of significant harm (s. 10.1).",
      individuals:
        "As soon as feasible after determining that the breach has occurred, when it creates a real risk of significant harm to them (s. 10.1).",
    },
    es: {
      authority:
        "Tan pronto como sea factible después de determinar que se ha producido la brecha, al Privacy Commissioner, cuando sea razonable pensar que crea un riesgo real de daño significativo (art. 10.1).",
      individuals:
        "Tan pronto como sea factible después de determinar que se ha producido la brecha, cuando cree para ellas un riesgo real de daño significativo (art. 10.1).",
    },
    source: "https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-3.html (read 26 Oct 2026)",
  },
  // PDPA (Singapore) s. 26C and 26D, as set out by the PDPC's guide on managing
  // and notifying data breaches (pp. 22 and 25: assess within 30 calendar days;
  // notify the PDPC no later than 3 calendar days from the determination that
  // the breach is notifiable; individuals at the same time or after).
  // https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/other-guides/guide-on-managing-and-notifying-data-breaches-under-the-pdpa-15-mar-2021.pdf
  // (read 26 Oct 2026).
  "PDPA-SG": {
    en: {
      authority:
        "Assess whether the breach is notifiable within 30 calendar days; if it is, notify the PDPC as soon as practicable and in any case within 3 calendar days of that assessment.",
      individuals: "As soon as practicable, at the same time as or after notifying the PDPC.",
    },
    es: {
      authority:
        "Hay que valorar en un plazo de 30 días naturales si la brecha se debe notificar y, si es así, notificarla a la PDPC lo antes posible y, en todo caso, en 3 días naturales desde esa valoración.",
      individuals: "Lo antes posible, a la vez que se notifica a la PDPC o después.",
    },
    source:
      "https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/other-guides/guide-on-managing-and-notifying-data-breaches-under-the-pdpa-15-mar-2021.pdf (read 26 Oct 2026)",
  },
  // POPIA s. 22, as applied by the Information Regulator.
  // https://inforegulator.org.za/wp-content/uploads/2020/07/ENFORCEMENT-NOTICE-DOJCD-MATTER-090523.pdf
  // (read 26 Oct 2026).
  POPIA: {
    en: {
      authority:
        "As soon as reasonably possible after discovering the compromise, to the Information Regulator (s. 22).",
      individuals: "As soon as reasonably possible after discovering the compromise, unless their identity cannot be established (s. 22).",
    },
    es: {
      authority:
        "Tan pronto como sea razonablemente posible después de descubrir el incidente, al Information Regulator (art. 22).",
      individuals:
        "Tan pronto como sea razonablemente posible después de descubrir el incidente, salvo que no se pueda saber quiénes son (art. 22).",
    },
    source:
      "https://inforegulator.org.za/wp-content/uploads/2020/07/ENFORCEMENT-NOTICE-DOJCD-MATTER-090523.pdf (read 26 Oct 2026)",
  },
  // APPI: the PPC's page on responding to leakage sets two reports: a
  // preliminary report (sokuhō) within 3 to 5 days of discovery, reported
  // promptly, and a final report (kakuhō) within 30 days, or 60 days where the
  // leakage may have been caused with a wrongful purpose. The page states no
  // timing for notifying individuals, so none is stated here.
  // https://www.ppc.go.jp/personalinfo/legal/leakAction/ (read 26 Oct 2026).
  APPI: {
    en: {
      authority:
        "A preliminary report to the Personal Information Protection Commission promptly, within 3 to 5 days of discovering the leakage, and a final report within 30 days (60 days where it may have been caused with a wrongful purpose).",
      individuals:
        "The people affected must also be notified; the Commission's guidance does not set a number of days, so check its guidelines for the timing.",
    },
    es: {
      authority:
        "Un primer informe a la Personal Information Protection Commission sin demora, en los 3 a 5 días siguientes a descubrir la filtración, y un informe final en 30 días (60 días si ha podido producirse con un fin ilícito).",
      individuals:
        "También hay que avisar a las personas afectadas; la guía de la Commission no fija un número de días, así que comprueba el plazo en sus directrices.",
    },
    source: "https://www.ppc.go.jp/personalinfo/legal/leakAction/ (read 26 Oct 2026)",
  },
};

/** Catalog codes that are not data-protection laws with a breach duty. */
const NOT_A_BREACH_LAW = new Set(["EU_AI_ACT"]);

export interface ReadinessLaw {
  code: string;
  /** The law's short name in the reader's language. */
  name: string;
  /** Whether the deadline below was checked against an official source. */
  verified: boolean;
  authority: string;
  individuals: string;
  /** The supervisory authority, in the reader's language (from the catalog). */
  authorityName: string;
}

function catalogEntry(code: string, locale: ReadinessLocale) {
  const en = JURISDICTION_CATALOG.find((j) => j.code === code);
  const es = locale === "es" ? JURISDICTION_CATALOG_ES[code] : undefined;
  return { en, es };
}

function isUsState(code: string): boolean {
  const en = JURISDICTION_CATALOG.find((j) => j.code === code);
  return !!en && en.region.startsWith("US-");
}

/**
 * The laws to show for the declared codes, in the order given, with the
 * deadline in the reader's language. Unknown or non-breach codes are left out.
 */
export function readinessLaws(codes: readonly string[], locale: ReadinessLocale): ReadinessLaw[] {
  const out: ReadinessLaw[] = [];
  const seen = new Set<string>();
  for (const code of codes) {
    if (seen.has(code) || NOT_A_BREACH_LAW.has(code)) continue;
    seen.add(code);
    const { en, es } = catalogEntry(code, locale);
    if (!en) continue;
    const name = (es?.shortName ?? en.shortName) || code;
    const authorityName = (es?.dpaName ?? en.dpaName) || "";
    const verified = VERIFIED_BREACH_DEADLINES[code];
    if (verified) {
      out.push({ code, name, verified: true, authorityName, ...verified[locale] });
      continue;
    }
    const us = isUsState(code);
    out.push({
      code,
      name,
      verified: false,
      authorityName,
      authority:
        locale === "es"
          ? us
            ? `Comprueba el plazo en la ley de notificación de brechas de este estado: en Estados Unidos los plazos no están en la ley de privacidad (${name}), sino en una ley de notificación de brechas aparte.`
            : `Comprueba el plazo en ${name}.`
          : us
            ? `Check the deadline in this state's breach notification statute: in the United States the deadlines sit in a separate breach notification law, not in the privacy law (${name}).`
            : `Check the deadline in ${name}.`,
      individuals:
        locale === "es"
          ? `Comprueba también cuándo hay que avisar a las personas afectadas según ${us ? "esa ley" : name}.`
          : `Also check when the people affected must be told under ${us ? "that statute" : name}.`,
    });
  }
  return out;
}

/** The default internal contact and register wording keys (rendered per reader). */
export const DEFAULT_REGISTER = "dpocentral";

/** Whether two sets of law codes are the same (order does not matter). */
export function sameLaws(a: readonly string[], b: readonly string[]): boolean {
  const norm = (x: readonly string[]) => [...new Set(x.filter((c) => !NOT_A_BREACH_LAW.has(c)))].sort().join("|");
  return norm(a) === norm(b);
}

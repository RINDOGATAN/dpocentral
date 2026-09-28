// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Links to the official legal text, named once and reused.
 *
 * A help panel that points a reader at "the GDPR" without a link makes them
 * search; naming the article and linking to the source does not. These are the
 * primary sources DPO Central is built on, so the panel for a page can hand the
 * reader straight to the words of the law it enforces.
 *
 * The GDPR is the consolidated Regulation (EU) 2016/679 on EUR-Lex. EUR-Lex
 * does not carry a stable per-article anchor for the 2016 text, so the article
 * links point at the consolidated document and name the article in the label:
 * the citation is never lost even where the deep anchor would be. The UK GDPR
 * points at legislation.gov.uk; the state statutes at the legislature's own
 * page. Standards point at the publisher's page of record.
 */

import type { Localized } from "@/config/help/localized";

export interface OfficialLink {
  href: string;
  label: Localized;
}

const L = (en: string, es: string): Localized => ({ en, es });

/** The consolidated GDPR on EUR-Lex. */
const EUR_LEX_GDPR =
  "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02016R0679-20160504";

function gdprArticle(en: string, es: string): OfficialLink {
  return { href: EUR_LEX_GDPR, label: L(en, es) };
}

export const OFFICIAL_LINKS = {
  gdpr: {
    href: EUR_LEX_GDPR,
    label: L(
      "GDPR:Regulation (EU) 2016/679 (EUR-Lex)",
      "RGPD:Reglamento (UE) 2016/679 (EUR-Lex)",
    ),
  } as OfficialLink,
  gdprArt5: gdprArticle(
    "GDPR Art. 5:principles and accountability",
    "RGPD art. 5:principios y responsabilidad proactiva",
  ),
  gdprArt6: gdprArticle(
    "GDPR Art. 6:lawfulness of processing",
    "RGPD art. 6:licitud del tratamiento",
  ),
  gdprArt6f: gdprArticle(
    "GDPR Art. 6(1)(f):legitimate interests",
    "RGPD art. 6.1.f:interés legítimo",
  ),
  gdprArt9: gdprArticle(
    "GDPR Art. 9:special categories of data",
    "RGPD art. 9:categorías especiales de datos",
  ),
  gdprArt12_14: gdprArticle(
    "GDPR Arts. 12 to 14:transparency and information",
    "RGPD arts. 12 a 14:transparencia e información",
  ),
  gdprArt15_22: gdprArticle(
    "GDPR Arts. 15 to 22:rights of the data subject",
    "RGPD arts. 15 a 22:derechos del interesado",
  ),
  gdprArt28: gdprArticle(
    "GDPR Art. 28:processors",
    "RGPD art. 28:encargados del tratamiento",
  ),
  gdprArt30: gdprArticle(
    "GDPR Art. 30:records of processing activities",
    "RGPD art. 30:registro de las actividades de tratamiento",
  ),
  gdprArt33_34: gdprArticle(
    "GDPR Arts. 33 and 34:breach notification",
    "RGPD arts. 33 y 34:notificación de violaciones de seguridad",
  ),
  gdprArt35: gdprArticle(
    "GDPR Art. 35:data protection impact assessment",
    "RGPD art. 35:evaluación de impacto relativa a la protección de datos",
  ),
  gdprArt36: gdprArticle(
    "GDPR Art. 36:prior consultation",
    "RGPD art. 36:consulta previa",
  ),
  gdprArt37_39: gdprArticle(
    "GDPR Arts. 37 to 39:the data protection officer",
    "RGPD arts. 37 a 39:el delegado de protección de datos",
  ),
  gdprArt44_49: gdprArticle(
    "GDPR Arts. 44 to 49:transfers to third countries",
    "RGPD arts. 44 a 49:transferencias a terceros países",
  ),
  ukGdpr: {
    href: "https://www.legislation.gov.uk/eur/2016/679/contents",
    label: L(
      "UK GDPR:the retained Regulation (legislation.gov.uk)",
      "RGPD del Reino Unido:el Reglamento conservado (legislation.gov.uk)",
    ),
  } as OfficialLink,
  ccpa: {
    href: "https://cppa.ca.gov/regulations/",
    label: L(
      "CCPA/CPRA:California Privacy Protection Agency",
      "CCPA/CPRA:Agencia de Protección de la Privacidad de California",
    ),
  } as OfficialLink,
  usStateLaws: {
    href: "https://iapp.org/resources/article/us-state-privacy-legislation-tracker/",
    label: L(
      "US state privacy laws:tracker of the comprehensive state acts",
      "Leyes estatales de privacidad de EE. UU.:seguimiento de las leyes estatales integrales",
    ),
  } as OfficialLink,
  iso27701: {
    href: "https://www.iso.org/standard/85819.html",
    label: L(
      "ISO/IEC 27701:privacy information management",
      "ISO/IEC 27701:gestión de la información de privacidad",
    ),
  } as OfficialLink,
  nistPf: {
    href: "https://www.nist.gov/privacy-framework",
    label: L("NIST Privacy Framework", "Marco de Privacidad del NIST"),
  } as OfficialLink,
} as const;

export type OfficialLinkKey = keyof typeof OFFICIAL_LINKS;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Results of the "Health data in advertising" assessment
 * (src/config/health-adtech-template.ts), computed from the saved answers:
 *
 *  - per selected jurisdiction: the consent model, the obligations (each with
 *    its source, and "[to verify]" where the app's regulation data does not
 *    support it) and the findings the answers raise;
 *  - the five-factor health-data band;
 *  - the mitigation choice, residual risk, determination and whether prior
 *    consultation under Article 36 is needed;
 *  - the signature block;
 *  - the risk level recorded on the assessment.
 *
 * The same answers give a different result when the jurisdictions change.
 * Answers saved in Spanish are matched to the stored English options.
 */

import {
  FIVE_FACTOR_QUESTION_IDS,
  HEALTH_ADTECH_SCORING_METHOD,
  HEALTH_ADTECH_SECTIONS,
  JURISDICTIONS,
  JURISDICTION_QUESTION_ID,
  DETERMINATION_QUESTION_ID,
  MITIGATION_QUESTION_ID,
  PRIOR_CONSULTATION_QUESTION_ID,
  RESIDUAL_RISK_QUESTION_ID,
  SIGNATURE_QUESTION_IDS,
  type BiQuestion,
  type BiText,
  type JurisdictionCode,
} from "@/config/health-adtech-template";
import { answerMapFrom, answerValues, type AnswerMap } from "@/lib/assessment-conditions";

export type Lang = "en" | "es";

export type RiskLevelKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Obligation {
  text: BiText;
  source: BiText;
  toVerify: boolean;
}

export interface Finding {
  severity: "blocking" | "gap" | "note";
  text: BiText;
}

export interface JurisdictionResult {
  code: JurisdictionCode;
  name: BiText;
  consentModel: BiText;
  obligations: Obligation[];
  findings: Finding[];
}

export type BandKey = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

export interface HealthAdtechResult {
  jurisdictions: JurisdictionResult[];
  fiveFactor: {
    score: number;
    answered: number;
    max: number;
    band: BandKey | null;
    bandLabel: BiText | null;
  };
  mitigation: BiText | null;
  residualRisk: BiText | null;
  determination: BiText | null;
  priorConsultation: { required: boolean; text: BiText } | null;
  signature: { signer: string | null; date: string | null; reviewDate: string | null };
  blocking: boolean;
  riskLevel: RiskLevelKey | null;
  riskScore: number | null;
}

export function isHealthAdtechTemplate(
  template: { scoringLogic?: unknown } | null | undefined
): boolean {
  const logic = template?.scoringLogic as { method?: unknown } | null | undefined;
  return logic?.method === HEALTH_ADTECH_SCORING_METHOD;
}

// ── Answer helpers ───────────────────────────────────────────────────────

const QUESTIONS = new Map<string, BiQuestion>(
  HEALTH_ADTECH_SECTIONS.flatMap((s) => s.questions.map((q) => [q.id, q] as const))
);

/** Positions (in the option list) of the saved values, in either language. */
function optionIndexes(answers: AnswerMap, questionId: string): number[] {
  const q = QUESTIONS.get(questionId);
  if (!q?.options) return [];
  const out: number[] = [];
  for (const v of answerValues(answers[questionId])) {
    let i = q.options.en.indexOf(v);
    if (i < 0) i = q.options.es.indexOf(v);
    if (i >= 0 && !out.includes(i)) out.push(i);
  }
  return out;
}

function optionIndex(answers: AnswerMap, questionId: string): number | null {
  return optionIndexes(answers, questionId)[0] ?? null;
}

function optionText(questionId: string, index: number | null): BiText | null {
  const q = QUESTIONS.get(questionId);
  if (index == null || !q?.options) return null;
  return { en: q.options.en[index], es: q.options.es[index] };
}

/** "Yes" / "No" / null for a boolean question. */
function yesNo(answers: AnswerMap, questionId: string): boolean | null {
  const v = answerValues(answers[questionId])[0];
  if (v === "Yes") return true;
  if (v === "No") return false;
  return null;
}

function textAnswer(answers: AnswerMap, questionId: string): string | null {
  const v = answerValues(answers[questionId])[0];
  return v && v.trim() ? v.trim() : null;
}

// ── Static obligations per jurisdiction ───────────────────────────────────

const bi =(en: string, es: string): BiText => ({ en, es });

/**
 * The day every primary source below was last read. It is stamped on each
 * source line, and the app and the export say how old it is rather than
 * leaving a fixed date to speak for itself: after
 * SOURCES_STALE_AFTER_MONTHS the reader is told to confirm each point
 * against the primary text. Move this date only when the sources have
 * actually been read again.
 */
export const SOURCES_CHECKED_ON = new Date("2026-09-16T00:00:00Z");
export const SOURCES_CHECKED_LABEL: BiText = bi("16 September 2026", "16 de septiembre de 2026");
export const SOURCES_STALE_AFTER_MONTHS = 12;

/** Whole months since the sources were last read. */
export function sourcesAgeMonths(now: Date = new Date()): number {
  const months =
    (now.getUTCFullYear() - SOURCES_CHECKED_ON.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - SOURCES_CHECKED_ON.getUTCMonth());
  const beforeTheDay = now.getUTCDate() < SOURCES_CHECKED_ON.getUTCDate();
  return Math.max(0, months - (beforeTheDay ? 1 : 0));
}

/** True once the stamp is older than the staleness window. */
export function sourcesAreStale(now: Date = new Date()): boolean {
  return sourcesAgeMonths(now) >= SOURCES_STALE_AFTER_MONTHS;
}

const CATALOGUE = (entry: string) =>
  bi(`DPO Central jurisdiction catalogue (${entry})`, `Catálogo de jurisdicciones de DPO Central (${entry})`);
const PRIMARY = (en: string, es: string) =>
  bi(
    `Primary source (checked ${SOURCES_CHECKED_LABEL.en}): ${en}`,
    `Fuente primaria (comprobada el ${SOURCES_CHECKED_LABEL.es}): ${es}`
  );
const DPIA_TEMPLATE = bi("DPO Central DPIA template", "Plantilla de DPIA de DPO Central");
const REPORT_ART35_7 = bi(
  "GDPR Art. 35(7), DPO Central assessment report",
  "Art. 35(7) del RGPD, informe de evaluación de DPO Central"
);
const AUTO_FILL_ART9 = bi(
  "DPO Central DPIA auto-fill rules (Art. 9(2))",
  "Reglas de autocompletado de DPIA de DPO Central (art. 9(2))"
);

const ob = (text: BiText, source: BiText, toVerify = false): Obligation => ({ text, source, toVerify });

const GDPR_OBLIGATIONS = (catalogueEntry: string): Obligation[] => [
  ob(
    bi(
      "Carry out a DPIA before processing likely to result in a high risk (Art. 35), with the Art. 35(7) content",
      "Realizar una EIPD antes de un tratamiento que probablemente entrañe un alto riesgo (art. 35), con el contenido del art. 35(7)"
    ),
    bi(
      `${CATALOGUE(catalogueEntry).en}; ${REPORT_ART35_7.en}`,
      `${CATALOGUE(catalogueEntry).es}; ${REPORT_ART35_7.es}`
    )
  ),
  ob(
    bi(
      "Identify an Art. 9(2) condition for health data (special category data)",
      "Identificar una condición del art. 9(2) para los datos de salud (categoría especial)"
    ),
    AUTO_FILL_ART9
  ),
  ob(
    bi(
      "Consult the supervisory authority before processing where the DPIA shows a high residual risk (Art. 36)",
      "Consultar a la autoridad de control antes del tratamiento cuando la EIPD muestre un riesgo residual alto (art. 36)"
    ),
    DPIA_TEMPLATE
  ),
];

const US_STATE_OBLIGATIONS = (entry: string, extra: Obligation[] = []): Obligation[] => [
  ob(
    bi("Obtain consent before processing sensitive data", "Obtener el consentimiento antes de tratar datos sensibles"),
    CATALOGUE(entry)
  ),
  ob(
    bi(
      "Offer the right to opt out (including targeted advertising and sale)",
      "Ofrecer el derecho de exclusión voluntaria (incluidas la publicidad segmentada y la venta)"
    ),
    CATALOGUE(entry),
    true
  ),
  ...extra,
];

const DPA_TARGETED = (entry: string) =>
  ob(
    bi(
      "Data protection assessment for targeted advertising, profiling and sensitive data",
      "Evaluación de protección de datos para publicidad segmentada, elaboración de perfiles y datos sensibles"
    ),
    CATALOGUE(entry)
  );
const DPA_REQUIRED = (entry: string) =>
  ob(bi("Data protection assessment required", "Evaluación de protección de datos obligatoria"), CATALOGUE(entry));
const UNIVERSAL_OPT_OUT = (entry: string) =>
  ob(
    bi("Recognise universal opt-out mechanisms", "Reconocer los mecanismos universales de exclusión voluntaria"),
    CATALOGUE(entry)
  );

const HEALTH_DATA_LAW = (code: "WA" | "NV"): Obligation[] => {
  const wa = code === "WA";
  return [
    ob(
      bi(
        "Consent before collecting consumer health data, and separate consent before sharing it",
        "Consentimiento antes de recoger datos de salud del consumidor y un consentimiento distinto antes de compartirlos"
      ),
      wa ? PRIMARY("RCW 19.373.030", "RCW 19.373.030") : PRIMARY("NRS 603A.500", "NRS 603A.500")
    ),
    ob(
      bi(
        wa
          ? "A valid authorisation signed by the consumer before any sale, naming the data, the seller and each purchaser, and expiring after one year"
          : "The consumer's written authorisation, with the prescribed contents, before any sale of consumer health data",
        wa
          ? "Una autorización válida firmada por el consumidor antes de cualquier venta, que identifique los datos, al vendedor y a cada comprador, y que caduque al cabo de un año"
          : "La autorización escrita del consumidor, con el contenido exigido, antes de cualquier venta de sus datos de salud"
      ),
      wa ? PRIMARY("RCW 19.373.070", "RCW 19.373.070") : PRIMARY("NRS 603A.535", "NRS 603A.535")
    ),
    ob(
      bi(
        wa
          ? "No geofence within 2,000 feet of an entity that provides in-person health care services"
          : "No geofence within 1,750 feet of a medical facility to identify or track consumers seeking in-person care",
        wa
          ? "Prohibidas las geovallas a menos de 2.000 pies de un centro que presta asistencia sanitaria presencial"
          : "Prohibidas las geovallas a menos de 1.750 pies de un centro médico para identificar o seguir a quienes buscan asistencia presencial"
      ),
      wa ? PRIMARY("RCW 19.373.080", "RCW 19.373.080") : PRIMARY("NRS 603A.540", "NRS 603A.540")
    ),
  ];
};

const STATIC: Record<JurisdictionCode, { consentModel: BiText; consentToVerify: boolean; obligations: Obligation[] }> = {
  EU: {
    consentModel: bi(
      "Opt-in: explicit consent (Art. 9(2)(a)) is usually the only condition for health data used in advertising",
      "Consentimiento previo: el consentimiento explícito (art. 9(2)(a)) suele ser la única condición para usar datos de salud en publicidad"
    ),
    consentToVerify: false,
    obligations: GDPR_OBLIGATIONS("GDPR"),
  },
  UK: {
    consentModel: bi(
      "Opt-in: explicit consent (UK GDPR Art. 9(2)(a)) is usually the only condition for health data used in advertising",
      "Consentimiento previo: el consentimiento explícito (art. 9(2)(a) del RGPD del Reino Unido) suele ser la única condición para usar datos de salud en publicidad"
    ),
    consentToVerify: false,
    obligations: GDPR_OBLIGATIONS("UK GDPR"),
  },
  CA: {
    consentModel: bi(
      "Opt-out: right to opt out of sale and sharing, and right to limit the use of sensitive personal information",
      "Exclusión voluntaria: derecho a oponerse a la venta y al intercambio, y derecho a limitar el uso de la información personal sensible"
    ),
    consentToVerify: false,
    obligations: [
      ob(
        bi(
          "Risk assessment for processing that presents significant risk",
          "Evaluación de riesgos para el tratamiento que presenta un riesgo significativo"
        ),
        CATALOGUE("CCPA/CPRA")
      ),
      ob(
        bi(
          "Offer the right to limit the use of sensitive personal information",
          "Ofrecer el derecho a limitar el uso de la información personal sensible"
        ),
        CATALOGUE("CCPA/CPRA")
      ),
      ob(
        bi(
          "Timetable: assess before the processing starts; processing begun before 2026 assessed by 31 December 2027; review every three years and within 45 days of a material change; keep every version five years; summary information submitted by 1 April 2028; the full report within 30 days of a request",
          "Calendario: evaluar antes de iniciar el tratamiento; el iniciado antes de 2026, evaluado a más tardar el 31 de diciembre de 2027; revisión cada tres años y en 45 días tras un cambio material; conservar cada versión cinco años; información resumida presentada a más tardar el 1 de abril de 2028; el informe completo en 30 días desde el requerimiento"
        ),
        PRIMARY("11 CCR 7155, 7157(a), 7157(e)", "11 CCR 7155, 7157(a), 7157(e)")
      ),
      ob(
        bi(
          "Attestation under penalty of perjury, submitted by a member of executive management responsible for risk-assessment compliance",
          "Declaración bajo pena de perjurio, presentada por un miembro de la alta dirección responsable del cumplimiento en evaluaciones de riesgos"
        ),
        PRIMARY("11 CCR 7157(b)(5), 7157(c)", "11 CCR 7157(b)(5), 7157(c)")
      ),
    ],
  },
  WA: {
    consentModel: bi(
      "Opt-in: consent to collect, separate consent to share (RCW 19.373.030); signed authorisation to sell (RCW 19.373.070)",
      "Consentimiento previo: para recoger y otro distinto para compartir (RCW 19.373.030); autorización firmada para vender (RCW 19.373.070)"
    ),
    consentToVerify: false,
    obligations: HEALTH_DATA_LAW("WA"),
  },
  NV: {
    consentModel: bi(
      "Opt-in: consent to collect, separate consent to share (NRS 603A.500); written authorisation to sell (NRS 603A.535)",
      "Consentimiento previo: para recoger y otro distinto para compartir (NRS 603A.500); autorización escrita para vender (NRS 603A.535)"
    ),
    consentToVerify: false,
    obligations: HEALTH_DATA_LAW("NV"),
  },
  MD: {
    consentModel: bi(
      "Prohibition: selling sensitive data is prohibited (Com. Law 14-4607(a)(2)); sensitive data only where strictly necessary for a product or service the consumer requested (14-4607(a)(1))",
      "Prohibición: está prohibido vender datos sensibles (Com. Law 14-4607(a)(2)); los datos sensibles solo cuando sean estrictamente necesarios para un producto o servicio solicitado por el consumidor (14-4607(a)(1))"
    ),
    consentToVerify: false,
    obligations: [
      ob(
        bi("Prohibition on the sale of sensitive data", "Prohibición de vender datos sensibles"),
        CATALOGUE("MODPA")
      ),
      ob(
        bi(
          "Collect only what is reasonably necessary",
          "Recoger solo lo razonablemente necesario"
        ),
        CATALOGUE("MODPA")
      ),
      ob(
        bi(
          "Data protection assessment for high-risk processing",
          "Evaluación de protección de datos para el tratamiento de alto riesgo"
        ),
        CATALOGUE("MODPA")
      ),
    ],
  },
  CT: {
    consentModel: bi("Opt-in for sensitive data; opt-out of targeted advertising and sale", "Consentimiento previo para datos sensibles; exclusión voluntaria de la publicidad segmentada y de la venta"),
    consentToVerify: false,
    obligations: US_STATE_OBLIGATIONS("CTDPA", [DPA_TARGETED("CTDPA"), UNIVERSAL_OPT_OUT("CTDPA")]),
  },
  CO: {
    consentModel: bi("Opt-in for sensitive data; opt-out of targeted advertising and sale", "Consentimiento previo para datos sensibles; exclusión voluntaria de la publicidad segmentada y de la venta"),
    consentToVerify: false,
    obligations: US_STATE_OBLIGATIONS("CPA", [DPA_REQUIRED("CPA"), UNIVERSAL_OPT_OUT("CPA")]),
  },
  VA: {
    consentModel: bi("Opt-in for sensitive data; opt-out of targeted advertising and sale", "Consentimiento previo para datos sensibles; exclusión voluntaria de la publicidad segmentada y de la venta"),
    consentToVerify: false,
    obligations: US_STATE_OBLIGATIONS("VCDPA", [DPA_TARGETED("VCDPA")]),
  },
  TX: {
    consentModel: bi("Opt-in for sensitive data; opt-out of targeted advertising and sale", "Consentimiento previo para datos sensibles; exclusión voluntaria de la publicidad segmentada y de la venta"),
    consentToVerify: false,
    obligations: US_STATE_OBLIGATIONS("TDPSA", [
      ob(
        bi("Data protection assessment for high-risk processing", "Evaluación de protección de datos para el tratamiento de alto riesgo"),
        CATALOGUE("TDPSA")
      ),
      UNIVERSAL_OPT_OUT("TDPSA"),
    ]),
  },
  OR: {
    consentModel: bi("Opt-in for sensitive data; opt-out of targeted advertising and sale", "Consentimiento previo para datos sensibles; exclusión voluntaria de la publicidad segmentada y de la venta"),
    consentToVerify: false,
    obligations: US_STATE_OBLIGATIONS("OCPA", [
      DPA_REQUIRED("OCPA"),
      ob(
        bi("Give consumers the list of specific third parties that received their data", "Facilitar a los consumidores la lista de terceros concretos que recibieron sus datos"),
        CATALOGUE("OCPA")
      ),
    ]),
  },
  US_OTHER: {
    consentModel: bi(
      "Usually opt-in for sensitive data; check the state's law",
      "Normalmente consentimiento previo para datos sensibles; revisa la ley del estado"
    ),
    consentToVerify: true,
    obligations: [
      ob(
        bi(
          "Check the state's consent, opt-out and assessment rules",
          "Revisar las reglas del estado sobre consentimiento, exclusión voluntaria y evaluaciones"
        ),
        CATALOGUE("comprehensive US state laws"),
        true
      ),
    ],
  },
};

// ── Five-factor band ──────────────────────────────────────────────────────

const BANDS: Array<{ key: BandKey; max: number; label: BiText; level: RiskLevelKey }> = [
  { key: "LOW", max: 3, label: bi("Low: unlikely to be health data", "Bajo: probablemente no son datos de salud"), level: "LOW" },
  { key: "MODERATE", max: 7, label: bi("Moderate: possibly health data", "Moderado: posiblemente datos de salud"), level: "MEDIUM" },
  { key: "HIGH", max: 11, label: bi("High: likely health data", "Alto: probablemente datos de salud"), level: "HIGH" },
  { key: "VERY_HIGH", max: 15, label: bi("Very high: treat as health data", "Muy alto: deben tratarse como datos de salud"), level: "CRITICAL" },
];

function bandFor(score: number) {
  return BANDS.find((b) => score <= b.max) ?? BANDS[BANDS.length - 1];
}

const LEVEL_BY_RISK_INDEX: RiskLevelKey[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const LEVEL_RANK: Record<RiskLevelKey, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
/** Middle of each level's range in the template's scoringLogic. */
const LEVEL_SCORE: Record<RiskLevelKey, number> = { LOW: 13, MEDIUM: 38, HIGH: 63, CRITICAL: 88 };

// ── Findings ─────────────────────────────────────────────────────────────

const f = (severity: Finding["severity"], en: string, es: string): Finding => ({
  severity,
  text: bi(en, es),
});

function findingsFor(
  code: JurisdictionCode,
  answers: AnswerMap,
  context: { residualHigh: boolean; band: BandKey | null }
): Finding[] {
  const out: Finding[] = [];
  const mitigation = optionIndex(answers, MITIGATION_QUESTION_ID);

  if (code === "WA" || code === "NV") {
    if (yesNo(answers, "hd8_1") === false)
      out.push(f("gap", "Consent to collect and to share consumer health data is not obtained.", "No se obtiene el consentimiento para recoger y compartir datos de salud del consumidor."));
    if (yesNo(answers, "hd8_2") === false)
      out.push(f("blocking", "Consumer health data is sold without a signed authorisation.", "Se venden datos de salud del consumidor sin autorización firmada."));
    if (yesNo(answers, "hd8_3") === true)
      out.push(f("blocking", "Geofencing around health care facilities is prohibited.", "Las geovallas alrededor de centros sanitarios están prohibidas."));
  }

  if (code === "MD") {
    if (yesNo(answers, "hd8_4") === true)
      out.push(f("blocking", "A sale of sensitive data is prohibited in Maryland.", "La venta de datos sensibles está prohibida en Maryland."));
    if (mitigation === 0)
      out.push(f("note", "Nationwide consent does not permit a sale of sensitive data in Maryland (Com. Law 14-4607(a)(2)).", "El consentimiento en todo el país no permite vender datos sensibles en Maryland (Com. Law 14-4607(a)(2))."));
  }

  if (["MD", "CT", "CO", "VA", "TX", "OR", "US_OTHER"].includes(code)) {
    if (yesNo(answers, "hd8_8") === false)
      out.push(f("gap", "Sensitive data is processed without opt-in consent.", "Se tratan datos sensibles sin consentimiento previo."));
    if (yesNo(answers, "hd8_9") === false)
      out.push(f("gap", "Consumers cannot opt out of targeted advertising or sale.", "Los consumidores no pueden excluirse de la publicidad segmentada ni de la venta."));
  }

  if (code === "CA") {
    if (yesNo(answers, "hd8_5") === false)
      out.push(f("gap", "The right to limit the use of sensitive personal information is not offered.", "No se ofrece el derecho a limitar el uso de la información personal sensible."));
    const triggers = optionIndexes(answers, "hd1_2");
    const noneIndex = (QUESTIONS.get("hd1_2")?.options?.en.length ?? 0) - 1;
    if (triggers.some((i) => i !== noneIndex))
      out.push(f("note", "A CCPA risk-assessment trigger is met: the assessment is required.", "Se cumple un supuesto de la CCPA: la evaluación de riesgos es obligatoria."));
    if (!textAnswer(answers, "hd8_7"))
      out.push(f("gap", "No executive is named for the attestation.", "No se ha designado al directivo que firmará la declaración."));
  }

  if (code === "EU" || code === "UK") {
    if (context.residualHigh)
      out.push(f("gap", "High residual risk: prior consultation with the supervisory authority is required before processing (Art. 36).", "Riesgo residual alto: es necesaria la consulta previa a la autoridad de control antes del tratamiento (art. 36)."));
    if (context.residualHigh && yesNo(answers, PRIOR_CONSULTATION_QUESTION_ID) === false)
      out.push(f("gap", "The answer on prior consultation conflicts with the residual risk.", "La respuesta sobre la consulta previa no concuerda con el riesgo residual."));
    if (optionIndex(answers, "hd2_4") === 1 && (context.band === "HIGH" || context.band === "VERY_HIGH"))
      out.push(f("gap", "Legitimate interest cannot support health data: an Art. 9(2) condition is needed.", "El interés legítimo no ampara datos de salud: se necesita una condición del art. 9(2)."));
    if (yesNo(answers, "hd8_10") === false)
      out.push(f("gap", "The data protection officer's advice is not recorded.", "No consta el asesoramiento del delegado de protección de datos."));
  }

  return out;
}

// ── Result ───────────────────────────────────────────────────────────────

export function computeHealthAdtechResult(
  responses: ReadonlyArray<{ questionId: string; response: unknown }>
): HealthAdtechResult {
  const answers = answerMapFrom(responses);

  // Five-factor band
  let score = 0;
  let answered = 0;
  for (const qid of FIVE_FACTOR_QUESTION_IDS) {
    const i = optionIndex(answers, qid);
    if (i != null) {
      score += i;
      answered++;
    }
  }
  const complete = answered === FIVE_FACTOR_QUESTION_IDS.length;
  const band = complete ? bandFor(score) : null;

  const residualIndex = optionIndex(answers, RESIDUAL_RISK_QUESTION_ID);
  const residualHigh = residualIndex != null && residualIndex >= 2;

  const selected = optionIndexes(answers, JURISDICTION_QUESTION_ID)
    .sort((a, b) => a - b)
    .map((i) => JURISDICTIONS[i]);

  const jurisdictions: JurisdictionResult[] = selected.map((j) => {
    const rules = STATIC[j.code];
    return {
      code: j.code,
      name: { en: j.en, es: j.es },
      consentModel: rules.consentToVerify
        ? { en: `${rules.consentModel.en} [to verify]`, es: `${rules.consentModel.es} [por verificar]` }
        : rules.consentModel,
      obligations: rules.obligations,
      findings: findingsFor(j.code, answers, { residualHigh, band: band?.key ?? null }),
    };
  });

  const gdprSelected = selected.some((j) => j.code === "EU" || j.code === "UK");
  const priorAnswer = yesNo(answers, PRIOR_CONSULTATION_QUESTION_ID);
  const priorConsultation = gdprSelected
    ? residualHigh || priorAnswer === true
      ? {
          required: true,
          text: bi(
            "Required: consult the supervisory authority before the processing starts (Art. 36).",
            "Necesaria: consulta a la autoridad de control antes de iniciar el tratamiento (art. 36)."
          ),
        }
      : {
          required: false,
          text: bi(
            residualIndex == null
              ? "Not yet determined: answer the residual-risk question."
              : "Not required on the residual risk recorded.",
            residualIndex == null
              ? "Aún sin determinar: responde a la pregunta sobre el riesgo residual."
              : "No es necesaria con el riesgo residual registrado."
          ),
        }
    : null;

  const blocking = jurisdictions.some((j) => j.findings.some((x) => x.severity === "blocking"));

  // Risk level: the residual risk when recorded, otherwise the band; a
  // blocking finding raises it to at least High.
  let riskLevel: RiskLevelKey | null =
    residualIndex != null ? LEVEL_BY_RISK_INDEX[residualIndex] : band?.level ?? null;
  if (blocking && (riskLevel == null || LEVEL_RANK[riskLevel] < LEVEL_RANK.HIGH)) riskLevel = "HIGH";

  return {
    jurisdictions,
    fiveFactor: {
      score,
      answered,
      max: FIVE_FACTOR_QUESTION_IDS.length * 3,
      band: band?.key ?? null,
      bandLabel: band?.label ?? null,
    },
    mitigation: optionText(MITIGATION_QUESTION_ID, optionIndex(answers, MITIGATION_QUESTION_ID)),
    residualRisk: optionText(RESIDUAL_RISK_QUESTION_ID, residualIndex),
    determination: optionText(DETERMINATION_QUESTION_ID, optionIndex(answers, DETERMINATION_QUESTION_ID)),
    priorConsultation,
    signature: {
      signer: textAnswer(answers, SIGNATURE_QUESTION_IDS.signer),
      date: textAnswer(answers, SIGNATURE_QUESTION_IDS.date),
      reviewDate: textAnswer(answers, SIGNATURE_QUESTION_IDS.review),
    },
    blocking,
    riskLevel,
    riskScore: riskLevel ? LEVEL_SCORE[riskLevel] : null,
  };
}

/** Text in the given language. */
export function tx(text: BiText | null | undefined, lang: Lang): string {
  return text ? text[lang] : "";
}

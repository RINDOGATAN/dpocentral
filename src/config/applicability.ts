// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The applicability check: a few plain questions about an organisation's
 * privacy posture, and the rule that turns the answers, together with the
 * jurisdictions it already declares, into "these apply to you" and "worth
 * checking".
 *
 * Pure module (no Prisma, no React), imported by the check component, the
 * settings card and the router. Display strings live in the `applicability`
 * i18n namespace and are referenced here only by id.
 *
 * Where the answers go: the posture answers are kept under
 * `Organization.settings.applicability`; "where you operate" is NOT re-asked
 * here, it is the jurisdictions the organisation already declares
 * (OrganizationJurisdiction), which this function reads as `jurisdictionCodes`.
 * Sector is the industry template the quick start already collects. Nothing is
 * asked twice.
 *
 * The doctrine, like the rest of the product: an unanswered question ("not sure
 * yet") never produces "applies". It produces "check", or nothing at all. The
 * legal mapping is draft until sign-off, so a result that turns on a threshold
 * or a fact these questions do not settle is always "check", never "applies".
 */

export const APPLICABILITY_VERSION = "2026.10.1";

export type ApplicabilityAnswer = "YES" | "NO" | "UNSURE";

/**
 * The questions asked since the first version (2026.09). A stored answer
 * object without one of these reads it as "not sure yet", as it always has.
 */
export const LEGACY_QUESTIONS = [
  "actAsController",
  "actAsProcessor",
  "largeVolume",
  "sensitiveData",
  "children",
  "largeScaleMonitoring",
  "publicAuthority",
] as const;

/**
 * The questions added in 2026.10, by jurisdiction. Until an organisation has
 * answered them (the key is absent from its stored answers) they are "not
 * asked yet" and change nothing in its result, so no organisation's result
 * moves because a question was added.
 *
 * Territorial scope (GDPR Art. 3; UK GDPR Art. 3):
 *   Art. 3(1)    an establishment in the Union (or the UK);
 *   Art. 3(2)(a) offering goods or services to data subjects in the Union;
 *   Art. 3(2)(b) monitoring their behaviour as far as it takes place there.
 *   Sources: Regulation (EU) 2016/679, https://eur-lex.europa.eu/eli/reg/2016/679/oj;
 *   EDPB Guidelines 3/2018 on the territorial scope of the GDPR (version 2.1,
 *   12 November 2019); UK GDPR, https://www.legislation.gov.uk/eur/2016/679/article/3.
 *   The number of people reached is NOT the test: Art. 3 turns on
 *   establishment, targeting and monitoring.
 *
 * DPIA indicators: the nine criteria of the Article 29 Working Party
 * Guidelines on DPIA (WP248 rev.01, 4 October 2017, endorsed by the EDPB on
 * 25 May 2018), read with GDPR Art. 35(1) and 35(3):
 *   1 evaluation or scoring (incl. profiling)          -> scoring
 *   2 automated decisions with legal or similar effect -> automatedDecisions
 *   3 systematic monitoring                            -> largeScaleMonitoring (legacy)
 *   4 sensitive data or data of a highly personal nature
 *     (Art. 9 special categories; Art. 10 criminal)     -> sensitiveData (legacy), criminalData
 *   5 data processed on a large scale                  -> largeScale
 *   6 matching or combining datasets                   -> combiningDatasets
 *   7 data concerning vulnerable data subjects
 *     (children, employees, patients, the elderly...)  -> children (legacy), vulnerableSubjects
 *   8 innovative use or new technological solutions    -> innovativeTech
 *   9 processing that prevents exercising a right or
 *     using a service or contract                       -> blocksRights
 * WP248: "in most cases" two criteria call for a DPIA.
 */
export const EU_TERRITORY_QUESTIONS = ["establishedEu", "targetsEu", "monitorsEu"] as const;
export const UK_TERRITORY_QUESTIONS = ["establishedUk", "targetsUk", "monitorsUk"] as const;
export const DPIA_NEW_QUESTIONS = [
  "largeScale",
  "criminalData",
  "vulnerableSubjects",
  "scoring",
  "automatedDecisions",
  "combiningDatasets",
  "innovativeTech",
  "blocksRights",
] as const;

/** Every question, in the order they are stored. Ids are also i18n keys. */
export const APPLICABILITY_QUESTIONS = [
  ...LEGACY_QUESTIONS,
  ...EU_TERRITORY_QUESTIONS,
  ...UK_TERRITORY_QUESTIONS,
  ...DPIA_NEW_QUESTIONS,
] as const;

export type ApplicabilityQuestion = (typeof APPLICABILITY_QUESTIONS)[number];

export type ApplicabilityAnswers = Record<ApplicabilityQuestion, ApplicabilityAnswer>;

/** The first two questions are one group on screen: the organisation's role. */
export const ROLE_QUESTIONS: readonly ApplicabilityQuestion[] = ["actAsController", "actAsProcessor"];

export const EMPTY_APPLICABILITY_ANSWERS: ApplicabilityAnswers = Object.fromEntries(
  APPLICABILITY_QUESTIONS.map((q) => [q, "UNSURE"]),
) as ApplicabilityAnswers;

/**
 * - `applies` the answers put the organisation in scope
 * - `check`   it may apply: an answer is "not sure yet", or the law turns on a
 *             threshold or fact these questions do not settle
 */
export type ApplicabilityState = "applies" | "check";

/** Ids are also i18n keys under `applicability.items.<id>`. */
export type ApplicabilityItemId =
  | "gdpr"
  | "ukGdpr"
  | "processorDuties"
  | "dpoRequired"
  | "dpiaLikely"
  | "ccpa"
  | "usStates";

/** Ids are also i18n keys under `applicability.reasons.<id>`. */
export type ApplicabilityReason =
  | "operatesEu"
  | "operatesUk"
  | "operatesCalifornia"
  | "operatesUsStates"
  | "controller"
  | "processor"
  | "roleUnsure"
  | "publicAuthority"
  | "largeScaleMonitoring"
  | "sensitiveData"
  | "children"
  | "largeVolume"
  | "thresholds"
  | "twoCriteria"
  | "answerUnsure"
  | "establishedEu"
  | "targetsEu"
  | "monitorsEu"
  | "territoryNotMetEu"
  | "establishedUk"
  | "targetsUk"
  | "monitorsUk"
  | "territoryNotMetUk"
  | "criminalData"
  | "vulnerableSubjects"
  | "largeScale"
  | "scoring"
  | "automatedDecisions"
  | "combiningDatasets"
  | "innovativeTech"
  | "blocksRights";

export interface ApplicabilityItem {
  id: ApplicabilityItemId;
  /** A law, or a duty that follows from the role. */
  kind: "law" | "duty";
  state: ApplicabilityState;
  /** Why, in the order the reasons are read. */
  reasons: ApplicabilityReason[];
}

function answerOf(value: unknown): ApplicabilityAnswer {
  return value === "YES" || value === "NO" ? value : "UNSURE";
}

/** Read stored answers defensively: anything unrecognised is "not sure yet". */
export function readApplicabilityAnswers(value: unknown): ApplicabilityAnswers {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out = { ...EMPTY_APPLICABILITY_ANSWERS };
  for (const q of APPLICABILITY_QUESTIONS) out[q] = answerOf(source[q]);
  return out;
}

/**
 * The questions an organisation has been asked: every legacy question, plus
 * each newer question whose key is present in its stored answers.
 */
export function readAskedQuestions(value: unknown): ApplicabilityQuestion[] {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return APPLICABILITY_QUESTIONS.filter(
    (q) =>
      (LEGACY_QUESTIONS as readonly string[]).includes(q) ||
      source[q] === "YES" ||
      source[q] === "NO" ||
      source[q] === "UNSURE",
  );
}

/** Whether any question has a yes or a no. */
export function hasAnyApplicabilityAnswer(answers: ApplicabilityAnswers): boolean {
  return APPLICABILITY_QUESTIONS.some((q) => answers[q] !== "UNSURE");
}

/** The jurisdiction catalogue codes that stand for each regime the check reads. */
const EU_GDPR_CODES = ["GDPR"];
const UK_GDPR_CODES = ["UK-GDPR"];
const CCPA_CODES = ["CCPA"];
const US_STATE_CODES = [
  "VCDPA", "CPA", "CTDPA", "UCPA", "ICDPA", "TDPSA", "FDBR", "MCDPA", "OCPA",
  "TIPA", "INDPA", "KCDPA", "NJDPA", "NHDPA", "DPDPA", "MNDPA", "MODPA", "NEDPA",
];

const hasAny = (jurisdictionCodes: readonly string[], codes: readonly string[]) =>
  codes.some((c) => jurisdictionCodes.includes(c));

/** Ids are also i18n keys under `applicability.sections.<id>`. */
export type ApplicabilitySectionId = "role" | "eu" | "uk" | "risk" | "us" | "general";

export interface ApplicabilitySection {
  id: ApplicabilitySectionId;
  questions: ApplicabilityQuestion[];
}

/**
 * The questions to ask, grouped, for the jurisdictions the organisation
 * declares. A question that does not apply to any declared law is not asked:
 * the EU block only with the GDPR, the UK block only with the UK GDPR, the DPO
 * and DPIA indicators only with either, the US size threshold only with
 * California or another US state law. With no jurisdiction declared yet, the
 * first version's questions are shown, as before.
 */
export function applicabilityQuestionsFor(jurisdictionCodes: readonly string[]): ApplicabilitySection[] {
  // Spain's LOPDGDD only applies with the GDPR (src/config/jurisdiction-places.ts, IMPLIED_LAWS).
  const eu = hasAny(jurisdictionCodes, EU_GDPR_CODES) || jurisdictionCodes.includes("LOPDGDD");
  const uk = hasAny(jurisdictionCodes, UK_GDPR_CODES);
  const us = hasAny(jurisdictionCodes, CCPA_CODES) || hasAny(jurisdictionCodes, US_STATE_CODES);
  const sections: ApplicabilitySection[] = [{ id: "role", questions: [...ROLE_QUESTIONS] }];
  if (!eu && !uk && !us) {
    sections.push({
      id: "general",
      questions: LEGACY_QUESTIONS.filter((q) => !ROLE_QUESTIONS.includes(q)),
    });
    return sections;
  }
  if (eu) sections.push({ id: "eu", questions: [...EU_TERRITORY_QUESTIONS] });
  if (uk) sections.push({ id: "uk", questions: [...UK_TERRITORY_QUESTIONS] });
  if (eu || uk) {
    sections.push({
      id: "risk",
      questions: [
        "publicAuthority",
        "largeScaleMonitoring",
        "sensitiveData",
        "criminalData",
        "children",
        "vulnerableSubjects",
        "largeScale",
        "scoring",
        "automatedDecisions",
        "combiningDatasets",
        "innovativeTech",
        "blocksRights",
      ],
    });
  }
  if (us) {
    sections.push({
      id: "us",
      questions: eu || uk ? ["largeVolume"] : ["largeVolume", "sensitiveData", "children"],
    });
  }
  return sections;
}

/** A yes applies, not sure is a check, a no is nothing. */
function fromAnswer(answer: ApplicabilityAnswer): ApplicabilityState | null {
  return answer === "YES" ? "applies" : answer === "UNSURE" ? "check" : null;
}

/**
 * The answers and the declared jurisdictions, turned into the list shown as
 * "These apply to you" and "Worth checking". Order: the comprehensive laws, the
 * role duty, then the duties that follow from posture, then the US states.
 * Items that do not apply at all are absent.
 */
export function evaluateApplicability(
  jurisdictionCodes: readonly string[],
  answers: ApplicabilityAnswers,
  /**
   * The questions the organisation has been asked (readAskedQuestions). A
   * question not asked yet changes nothing. Default: all of them, as on a
   * screen where every question shown has an answer.
   */
  asked: readonly ApplicabilityQuestion[] = APPLICABILITY_QUESTIONS,
): ApplicabilityItem[] {
  const items: ApplicabilityItem[] = [];
  const has = (codes: string[]) => codes.some((c) => jurisdictionCodes.includes(c));
  const askedSet = new Set<ApplicabilityQuestion>(asked);
  /** The answer, or null when the question has not been asked. */
  const a = (q: ApplicabilityQuestion): ApplicabilityAnswer | null => (askedSet.has(q) ? answers[q] : null);
  const yes = (q: ApplicabilityQuestion) => a(q) === "YES";
  const unsure = (q: ApplicabilityQuestion) => a(q) === "UNSURE";

  // Any privacy role at all: a controller or a processor. With both "no" the
  // organisation neither decides nor processes for others, and GDPR is not listed.
  const roleAnswers = ROLE_QUESTIONS.map((q) => answers[q]);
  const role: ApplicabilityState | null = roleAnswers.includes("YES")
    ? "applies"
    : roleAnswers.includes("UNSURE")
      ? "check"
      : null;
  const roleReasons: ApplicabilityReason[] =
    role === "applies"
      ? [
          ...(answers.actAsController === "YES" ? (["controller"] as const) : []),
          ...(answers.actAsProcessor === "YES" ? (["processor"] as const) : []),
        ]
      : role === "check"
        ? ["roleUnsure"]
        : [];

  // ─── Territorial scope (Art. 3) ────────────────────
  // A declared place stays the starting point. A yes to an Art. 3 ground names
  // that ground as the reason; three clear noes turn the law into a check
  // ("worth checking"), since the answers then say Art. 3 may not reach the
  // organisation. "Not sure yet" or "not asked yet" leaves it as declared.
  const territory = (
    questions: readonly [ApplicabilityQuestion, ApplicabilityQuestion, ApplicabilityQuestion],
    reasons: readonly [ApplicabilityReason, ApplicabilityReason, ApplicabilityReason],
    declared: ApplicabilityReason,
    notMet: ApplicabilityReason,
  ): { reasons: ApplicabilityReason[]; notMet: boolean } => {
    const grounds = questions.flatMap((q, i) => (yes(q) ? [reasons[i]!] : []));
    if (grounds.length > 0) return { reasons: grounds, notMet: false };
    if (questions.every((q) => a(q) === "NO")) return { reasons: [notMet], notMet: true };
    return { reasons: [declared], notMet: false };
  };

  // ─── EU GDPR ───────────────────────────────────────
  if (has(EU_GDPR_CODES) && role) {
    const t = territory(
      EU_TERRITORY_QUESTIONS,
      ["establishedEu", "targetsEu", "monitorsEu"],
      "operatesEu",
      "territoryNotMetEu",
    );
    items.push({
      id: "gdpr",
      kind: "law",
      state: t.notMet ? "check" : role,
      reasons: [...t.reasons, ...roleReasons],
    });
  }

  // ─── UK GDPR ───────────────────────────────────────
  if (has(UK_GDPR_CODES) && role) {
    const t = territory(
      UK_TERRITORY_QUESTIONS,
      ["establishedUk", "targetsUk", "monitorsUk"],
      "operatesUk",
      "territoryNotMetUk",
    );
    items.push({
      id: "ukGdpr",
      kind: "law",
      state: t.notMet ? "check" : role,
      reasons: [...t.reasons, ...roleReasons],
    });
  }

  // ─── Processor duties (Art. 28) ────────────────────
  const processor = fromAnswer(answers.actAsProcessor);
  if (processor && (has(EU_GDPR_CODES) || has(UK_GDPR_CODES))) {
    items.push({
      id: "processorDuties",
      kind: "duty",
      state: processor,
      reasons: [processor === "applies" ? "processor" : "answerUnsure"],
    });
  }

  // ─── A DPO may be required (Art. 37) ───────────────
  // Applies on a public authority or on large-scale regular monitoring; a
  // check on large-scale special category (the "large scale" part is not
  // settled here) or on any of those being unsure.
  // Art. 37(1)(c) covers large-scale special category (Art. 9) AND criminal
  // (Art. 10) data as core activities: either is a check here.
  if (has(EU_GDPR_CODES) || has(UK_GDPR_CODES)) {
    const applies = yes("publicAuthority") || yes("largeScaleMonitoring");
    const anyUnsure =
      unsure("publicAuthority") ||
      unsure("largeScaleMonitoring") ||
      unsure("sensitiveData") ||
      unsure("criminalData");
    const special: ApplicabilityReason[] = [
      ...(yes("sensitiveData") ? (["sensitiveData"] as const) : []),
      ...(yes("criminalData") ? (["criminalData"] as const) : []),
    ];
    if (applies) {
      const reasons: ApplicabilityReason[] = [];
      if (yes("publicAuthority")) reasons.push("publicAuthority");
      if (yes("largeScaleMonitoring")) reasons.push("largeScaleMonitoring");
      items.push({ id: "dpoRequired", kind: "duty", state: "applies", reasons });
    } else if (special.length > 0 || anyUnsure) {
      items.push({
        id: "dpoRequired",
        kind: "duty",
        state: "check",
        reasons: [...(special.length > 0 ? special : (["answerUnsure"] as const)), "thresholds"],
      });
    }
  }

  // ─── A DPIA is likely (Art. 35) ────────────────────
  // Large-scale systematic monitoring of a public area is an Art. 35(3)(c)
  // case on its own. Otherwise the nine WP248 criteria count (see the table
  // above): two or more met apply, one is a check. Criteria 4 and 7 each
  // count once, whichever of their questions is a yes.
  if (has(EU_GDPR_CODES) || has(UK_GDPR_CODES)) {
    const reasons: ApplicabilityReason[] = [];
    if (yes("largeScaleMonitoring")) reasons.push("largeScaleMonitoring");
    const criteria: ApplicabilityReason[][] = [
      yes("scoring") ? ["scoring"] : [],
      yes("automatedDecisions") ? ["automatedDecisions"] : [],
      [
        ...(yes("sensitiveData") ? (["sensitiveData"] as const) : []),
        ...(yes("criminalData") ? (["criminalData"] as const) : []),
      ],
      yes("largeScale") ? ["largeScale"] : [],
      yes("combiningDatasets") ? ["combiningDatasets"] : [],
      [
        ...(yes("children") ? (["children"] as const) : []),
        ...(yes("vulnerableSubjects") ? (["vulnerableSubjects"] as const) : []),
      ],
      yes("innovativeTech") ? ["innovativeTech"] : [],
      yes("blocksRights") ? ["blocksRights"] : [],
    ];
    const met = criteria.filter((c) => c.length > 0);
    reasons.push(...met.flat());
    const dpiaQuestions: ApplicabilityQuestion[] = [
      "largeScaleMonitoring",
      "sensitiveData",
      "children",
      ...DPIA_NEW_QUESTIONS,
    ];
    if (yes("largeScaleMonitoring") || met.length >= 2) {
      items.push({ id: "dpiaLikely", kind: "duty", state: "applies", reasons });
    } else if (met.length === 1) {
      items.push({ id: "dpiaLikely", kind: "duty", state: "check", reasons: [...reasons, "twoCriteria"] });
    } else if (dpiaQuestions.some(unsure)) {
      items.push({ id: "dpiaLikely", kind: "duty", state: "check", reasons: ["answerUnsure"] });
    }
  }

  // ─── California CCPA/CPRA ──────────────────────────
  // Its business thresholds decide, so a yes to the large-business question
  // applies; unsure is a check; a clear no leaves it off the list.
  // Cal. Civ. Code 1798.140(d)(1): annual gross revenue above US$25,000,000
  // (US$26,625,000 from 1 January 2025, CPPA adjustment under 1798.199.95(d)),
  // or buying, selling or sharing the personal information of 100,000 or more
  // consumers or households a year, or 50% or more of annual revenue from
  // selling or sharing it.
  if (has(CCPA_CODES)) {
    const volume = fromAnswer(answers.largeVolume);
    if (volume) {
      items.push({
        id: "ccpa",
        kind: "law",
        state: volume,
        reasons: [
          "operatesCalifornia",
          volume === "applies" ? "largeVolume" : "answerUnsure",
          "thresholds",
        ],
      });
    }
  }

  // ─── Other US state laws ───────────────────────────
  // Each turns on its own thresholds, which the regulations page asks; here
  // they are never more than a check.
  if (has(US_STATE_CODES)) {
    items.push({
      id: "usStates",
      kind: "law",
      state: "check",
      reasons: ["operatesUsStates", "thresholds"],
    });
  }

  return items;
}

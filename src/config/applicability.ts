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

export const APPLICABILITY_VERSION = "2026.09.1";

export type ApplicabilityAnswer = "YES" | "NO" | "UNSURE";

/** The posture questions, in the order they are asked. Ids are also i18n keys. */
export const APPLICABILITY_QUESTIONS = [
  "actAsController",
  "actAsProcessor",
  "largeVolume",
  "sensitiveData",
  "children",
  "largeScaleMonitoring",
  "publicAuthority",
] as const;

export type ApplicabilityQuestion = (typeof APPLICABILITY_QUESTIONS)[number];

export type ApplicabilityAnswers = Record<ApplicabilityQuestion, ApplicabilityAnswer>;

/** The first two questions are one group on screen: the organisation's role. */
export const ROLE_QUESTIONS: readonly ApplicabilityQuestion[] = ["actAsController", "actAsProcessor"];

export const EMPTY_APPLICABILITY_ANSWERS: ApplicabilityAnswers = {
  actAsController: "UNSURE",
  actAsProcessor: "UNSURE",
  largeVolume: "UNSURE",
  sensitiveData: "UNSURE",
  children: "UNSURE",
  largeScaleMonitoring: "UNSURE",
  publicAuthority: "UNSURE",
};

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
  | "answerUnsure";

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
): ApplicabilityItem[] {
  const items: ApplicabilityItem[] = [];
  const has = (codes: string[]) => codes.some((c) => jurisdictionCodes.includes(c));

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

  // ─── EU GDPR ───────────────────────────────────────
  if (has(EU_GDPR_CODES) && role) {
    items.push({ id: "gdpr", kind: "law", state: role, reasons: ["operatesEu", ...roleReasons] });
  }

  // ─── UK GDPR ───────────────────────────────────────
  if (has(UK_GDPR_CODES) && role) {
    items.push({ id: "ukGdpr", kind: "law", state: role, reasons: ["operatesUk", ...roleReasons] });
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
  if (has(EU_GDPR_CODES) || has(UK_GDPR_CODES)) {
    const applies =
      answers.publicAuthority === "YES" || answers.largeScaleMonitoring === "YES";
    const anyUnsure =
      answers.publicAuthority === "UNSURE" ||
      answers.largeScaleMonitoring === "UNSURE" ||
      answers.sensitiveData === "UNSURE";
    if (applies) {
      const reasons: ApplicabilityReason[] = [];
      if (answers.publicAuthority === "YES") reasons.push("publicAuthority");
      if (answers.largeScaleMonitoring === "YES") reasons.push("largeScaleMonitoring");
      items.push({ id: "dpoRequired", kind: "duty", state: "applies", reasons });
    } else if (answers.sensitiveData === "YES" || anyUnsure) {
      items.push({
        id: "dpoRequired",
        kind: "duty",
        state: "check",
        reasons: [answers.sensitiveData === "YES" ? "sensitiveData" : "answerUnsure", "thresholds"],
      });
    }
  }

  // ─── A DPIA is likely (Art. 35) ────────────────────
  if (has(EU_GDPR_CODES) || has(UK_GDPR_CODES)) {
    const reasons: ApplicabilityReason[] = [];
    if (answers.largeScaleMonitoring === "YES") reasons.push("largeScaleMonitoring");
    if (answers.sensitiveData === "YES") reasons.push("sensitiveData");
    if (answers.children === "YES") reasons.push("children");
    if (reasons.length > 0) {
      items.push({ id: "dpiaLikely", kind: "duty", state: "applies", reasons });
    } else if (
      answers.largeScaleMonitoring === "UNSURE" ||
      answers.sensitiveData === "UNSURE" ||
      answers.children === "UNSURE"
    ) {
      items.push({ id: "dpiaLikely", kind: "duty", state: "check", reasons: ["answerUnsure"] });
    }
  }

  // ─── California CCPA/CPRA ──────────────────────────
  // Its business thresholds decide, so a yes to the large-business question
  // applies; unsure is a check; a clear no leaves it off the list.
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

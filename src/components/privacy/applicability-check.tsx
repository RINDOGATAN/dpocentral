"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The applicability check (src/config/applicability.ts) on screen.
 *
 * - `ApplicabilityQuestions`: the plain posture questions, three answers each
 *   ("Yes", "No", "Not sure yet"). Controlled: the caller keeps the answers and
 *   saves them (the quick start on its way past, the settings card with a button).
 * - `ApplicabilityResult`: "These apply to you", one line each with its why,
 *   then "Worth checking" for what may apply.
 * - `ApplicabilityCard`: both, for Settings, where the answers stay editable.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, CircleHelp, ListChecks, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  APPLICABILITY_QUESTIONS,
  ROLE_QUESTIONS,
  evaluateApplicability,
  type ApplicabilityAnswer,
  type ApplicabilityAnswers,
  type ApplicabilityItem,
  type ApplicabilityQuestion,
} from "@/config/applicability";

const OPTIONS: ApplicabilityAnswer[] = ["YES", "NO", "UNSURE"];

function QuestionRow({
  question,
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  question: ApplicabilityQuestion;
  value: ApplicabilityAnswer;
  onChange: (answer: ApplicabilityAnswer) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const t = useTranslations("applicability");
  const name = `${idPrefix}-${question}`;
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm">{t(`questions.${question}.label`)}</legend>
      <p className="text-xs text-muted-foreground" id={`${name}-hint`}>
        {t(`questions.${question}.hint`)}
      </p>
      <div className="flex flex-wrap gap-1.5" aria-describedby={`${name}-hint`}>
        {OPTIONS.map((option) => (
          <label key={option} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex min-h-11 sm:min-h-8 items-center rounded-md border px-3 text-xs motion-safe:transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
                "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
                value === option
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {t(`answer.${option}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ApplicabilityQuestions({
  answers,
  onChange,
  disabled,
  idPrefix = "applicability",
}: {
  answers: ApplicabilityAnswers;
  onChange: (next: ApplicabilityAnswers) => void;
  disabled?: boolean;
  /** Keeps radio names apart when the questions appear twice on a page. */
  idPrefix?: string;
}) {
  const t = useTranslations("applicability");
  const set = (q: ApplicabilityQuestion) => (a: ApplicabilityAnswer) =>
    onChange({ ...answers, [q]: a });
  const others = APPLICABILITY_QUESTIONS.filter((q) => !ROLE_QUESTIONS.includes(q));
  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <p className="text-sm font-medium">{t("roleTitle")}</p>
        {ROLE_QUESTIONS.map((q) => (
          <QuestionRow
            key={q}
            question={q}
            value={answers[q]}
            onChange={set(q)}
            disabled={disabled}
            idPrefix={idPrefix}
          />
        ))}
      </div>
      <div className="space-y-4 border-t border-border pt-4">
        {others.map((q) => (
          <QuestionRow
            key={q}
            question={q}
            value={answers[q]}
            onChange={set(q)}
            disabled={disabled}
            idPrefix={idPrefix}
          />
        ))}
      </div>
    </div>
  );
}

function ItemLine({ item }: { item: ApplicabilityItem }) {
  const t = useTranslations("applicability");
  const Icon = item.state === "applies" ? CheckCircle2 : CircleHelp;
  return (
    <li className="flex items-start gap-2.5">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          item.state === "applies" ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">
        <span className="block text-sm font-medium">{t(`items.${item.id}`)}</span>
        <span className="block text-xs text-muted-foreground">
          <span className="sr-only">{t("whyLabel")}: </span>
          {item.reasons.map((r) => t(`reasons.${r}`)).join(" ")}
        </span>
      </span>
    </li>
  );
}

export function ApplicabilityResult({
  jurisdictionCodes,
  answers,
}: {
  jurisdictionCodes: readonly string[];
  answers: ApplicabilityAnswers;
}) {
  const t = useTranslations("applicability");
  const items = evaluateApplicability(jurisdictionCodes, answers);
  const applies = items.filter((i) => i.state === "applies");
  const check = items.filter((i) => i.state === "check");

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ListChecks className="size-4 text-primary" aria-hidden="true" />
          {t("appliesTitle")}
        </h3>
        {applies.length > 0 ? (
          <ul className="space-y-2.5">
            {applies.map((item) => (
              <ItemLine key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("appliesEmpty")}</p>
        )}
      </div>
      {check.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("checkTitle")}</h3>
          <ul className="space-y-2.5">
            {check.map((item) => (
              <ItemLine key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
      {jurisdictionCodes.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("noJurisdictions")}</p>
      )}
      <p className="text-xs text-muted-foreground border-t border-border pt-3">{t("editableNote")}</p>
    </div>
  );
}

/** Settings: the same questions, editable at any time, and the result. */
export function ApplicabilityCard({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const t = useTranslations("applicability");
  const tc = useTranslations("common");
  const utils = trpc.useUtils();
  const { data } = trpc.regulations.getApplicability.useQuery({ organizationId });
  const [edits, setEdits] = useState<ApplicabilityAnswers | null>(null);

  const save = trpc.regulations.setApplicability.useMutation({
    onSuccess: () => {
      setEdits(null);
      toast.success(t("saved"));
      void utils.regulations.getApplicability.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!data) return null;
  const answers = edits ?? data.answers;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-primary" aria-hidden="true" />
          {t("cardTitle")}
        </CardTitle>
        <CardDescription>{t("cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ApplicabilityQuestions
          answers={answers}
          onChange={setEdits}
          disabled={!canWrite || save.isPending}
          idPrefix="applicability-settings"
        />
        <div className="rounded-lg border border-border p-4">
          <ApplicabilityResult jurisdictionCodes={data.jurisdictionCodes} answers={answers} />
        </div>
        {canWrite && (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!edits || save.isPending}
              onClick={() => edits && save.mutate({ organizationId, answers: edits })}
            >
              {save.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
              {tc("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What is still outstanding on an assessment, in plain words, with a link on
 * every item that jumps to the step and field that answers it.
 *
 * It reads the same module the export reads (src/lib/assessment-completeness.ts),
 * so the panel and the exported document never disagree.
 *
 * While nothing is answered yet the list would be every question of the
 * assessment, so it opens folded into one line ("30 questions and 8
 * requirements outstanding · Show"), leaving the first question on the first
 * screen. A refusal to submit opens it (`openSignal`).
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FRAMEWORK_LABELS } from "@/config/assessment-frameworks";
import type { Completeness } from "@/lib/assessment-completeness";

export function CompletenessPanel({
  completeness,
  onJump,
  nothingAnswered = false,
  openSignal = 0,
}: {
  completeness: Completeness;
  onJump: (sectionId: string, questionId: string) => void;
  /** No answer saved yet: the list starts folded. */
  nothingAnswered?: boolean;
  /** Changes when the page wants the list shown (a refused submit). */
  openSignal?: number;
}) {
  const t = useTranslations("pages.assessmentDetail.completeness");
  // Folded when the page opens on an assessment with no answer, and kept
  // folded as the first answers come in, until the reader opens it: the list
  // would otherwise jump in above the question being answered.
  const [startedFolded] = useState(nothingAnswered);
  const [folded, setFolded] = useState(nothingAnswered);
  useEffect(() => {
    if (openSignal > 0) setFolded(false);
  }, [openSignal]);
  const lang = useLocale() === "es" ? "es" : "en";
  const {
    outstandingQuestions,
    outstandingRequirements,
    summary,
    frameworks,
    californiaTrigger,
    art36,
    priorConsultationRequired,
    complete,
  } = completeness;

  const californiaNotRequired =
    frameworks.includes("US_CCPA") && californiaTrigger === "not-required";

  return (
    <Card className={complete ? "border-primary/40" : "border-amber-500/40"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {complete ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600" />
          )}
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* One line per framework: covered, and whether it conforms yet. */}
        {summary.length > 0 && (
          <div className="space-y-1">
            {summary.map((f) => (
              <p key={f.framework} className="text-sm flex items-start gap-2">
                <Scale className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  {t(f.complete ? "frameworkComplete" : "frameworkPartial", {
                    framework: FRAMEWORK_LABELS[f.framework][lang],
                    covered: f.covered,
                    total: f.total,
                  })}
                  {!f.complete && (
                    <span className="text-muted-foreground">
                      {" "}
                      {t("notConforming", {
                        framework: FRAMEWORK_LABELS[f.framework][lang],
                      })}
                    </span>
                  )}
                </span>
              </p>
            ))}
          </div>
        )}

        {californiaNotRequired && (
          <p className="text-sm text-muted-foreground">{t("californiaNotRequired")}</p>
        )}

        {/* Article 36: a pair of answers that cannot be submitted, or the
            consultation the answers say is needed before processing. */}
        {art36 && (
          <p className="text-sm flex items-start gap-2" data-testid="art36-conflict">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span>{t(art36 === "CONSULTATION_UNDECIDED" ? "art36Undecided" : "art36HighResidual")}</span>
          </p>
        )}
        {!art36 && priorConsultationRequired && (
          <p className="text-sm flex items-start gap-2">
            <Scale className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <span>{t("priorConsultationRequired")}</span>
          </p>
        )}

        {complete ? (
          <p className="text-sm text-muted-foreground">{t("allDone")}</p>
        ) : folded ? (
          <button
            type="button"
            onClick={() => setFolded(false)}
            aria-expanded={false}
            data-testid="completeness-collapsed"
            className="text-left text-sm flex items-center gap-1.5 min-h-[44px] hover:text-primary transition-colors"
          >
            <span>
              {outstandingRequirements.length > 0
                ? t("collapsedBoth", {
                    questions: outstandingQuestions.length,
                    requirements: outstandingRequirements.length,
                  })
                : t("collapsedQuestions", { questions: outstandingQuestions.length })}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-primary flex items-center gap-0.5">
              {t("show")}
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <>
            {outstandingQuestions.length > 0 && (
              <div>
                <p className="text-sm font-medium">
                  {t("questionsTitle", { count: outstandingQuestions.length })}
                </p>
                <p className="text-xs text-muted-foreground mb-2">{t("submitHint")}</p>
                <div className="flex flex-col gap-1.5">
                  {outstandingQuestions.map((item) => (
                    <button
                      key={item.questionId}
                      type="button"
                      onClick={() => onJump(item.sectionId, item.questionId)}
                      title={t("jump")}
                      className="text-left rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50 hover:bg-muted/50 transition-colors min-h-[44px] flex items-start gap-2"
                    >
                      <ArrowRight className="w-3.5 h-3.5 mt-1 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="text-muted-foreground">{item.sectionTitle}</span>{" "}
                        <span>{item.text}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {outstandingRequirements.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  {t("requirementsTitle", { count: outstandingRequirements.length })}
                </p>
                <div className="flex flex-col gap-1.5">
                  {outstandingRequirements.map((row) => {
                    const target = row.sectionId && row.questionId;
                    const body = (
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.element.citation[lang]}
                        </span>{" "}
                        <span>{row.element.label[lang]}</span>
                      </span>
                    );
                    return target ? (
                      <button
                        key={row.element.id}
                        type="button"
                        onClick={() => onJump(row.sectionId!, row.questionId!)}
                        title={t("jump")}
                        className="text-left rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50 hover:bg-muted/50 transition-colors min-h-[44px] flex items-start gap-2"
                      >
                        <ArrowRight className="w-3.5 h-3.5 mt-1 shrink-0 text-muted-foreground" />
                        {body}
                      </button>
                    ) : (
                      <div
                        key={row.element.id}
                        className="rounded-md border border-dashed border-border px-3 py-2 text-sm flex items-start gap-2"
                      >
                        <AlertCircle className="w-3.5 h-3.5 mt-1 shrink-0 text-muted-foreground" />
                        {body}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{t("exportHint")}</p>
            {startedFolded && (
              <button
                type="button"
                onClick={() => setFolded(true)}
                aria-expanded={true}
                className="text-sm font-medium text-primary flex items-center gap-0.5 min-h-[44px]"
              >
                {t("hide")}
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

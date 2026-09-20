"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What is still outstanding on an assessment, in plain words, with a link on
 * every item that jumps to the step and field that answers it.
 *
 * It reads the same module the export reads (src/lib/assessment-completeness.ts),
 * so the panel and the exported document never disagree.
 */

import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, CheckCircle2, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FRAMEWORK_LABELS } from "@/config/assessment-frameworks";
import type { Completeness } from "@/lib/assessment-completeness";

export function CompletenessPanel({
  completeness,
  onJump,
}: {
  completeness: Completeness;
  onJump: (sectionId: string, questionId: string) => void;
}) {
  const t = useTranslations("pages.assessmentDetail.completeness");
  const lang = useLocale() === "es" ? "es" : "en";
  const {
    outstandingQuestions,
    outstandingRequirements,
    summary,
    frameworks,
    californiaTrigger,
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

        {complete ? (
          <p className="text-sm text-muted-foreground">{t("allDone")}</p>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

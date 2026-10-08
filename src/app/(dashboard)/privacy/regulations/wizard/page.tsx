"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { toneMark } from "@/config/status-palette";
import { useLocale, useTranslations } from "next-intl";
import { localizeJurisdiction, localizeQuestion } from "@/config/jurisdiction-catalog";

export default function RegulationsWizardPage() {
  const router = useRouter();
  const tw = useTranslations("pages.regulationsWizard");
  const tc = useTranslations("common");
  const tcard = useTranslations("pages.regulations.card");
  const tcat = useTranslations("pages.regulations.category");
  const locale = useLocale();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<"questions" | "results">("questions");

  const { data: questionData, isLoading } = trpc.regulations.getApplicabilityQuestions.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const { data: results } = trpc.regulations.checkApplicability.useQuery(
    { organizationId: orgId, answers },
    { enabled: !!orgId && step === "results" }
  );

  const applyMutation = trpc.regulations.applyJurisdiction.useMutation();
  const [applying, setApplying] = useState(false);

  const handleApplyAll = async () => {
    if (!results) return;
    setApplying(true);
    for (const j of results.applicableJurisdictions) {
      await applyMutation.mutateAsync({
        organizationId: orgId,
        jurisdictionCode: j.code,
        isPrimary: false,
      });
    }
    setApplying(false);
    router.push("/privacy/regulations");
  };

  const questions = (questionData?.questions ?? []).map((q) => localizeQuestion(q, locale));
  const applicable = (results?.applicableJurisdictions ?? []).map((j) => localizeJurisdiction(j, locale));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Globe className="w-6 h-6" />
          {tw("title")}
        </h1>
        <p className="text-muted-foreground">
          {tw("subtitle")}
        </p>
      </div>

      {step === "questions" && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <Card key={q.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{q.question}</p>
                        <p className="text-xs text-muted-foreground mt-1">{q.helpText}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant={answers[q.id] === true ? "default" : "outline"}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: true }))}
                        >
                          {tc("yes")}
                        </Button>
                        <Button
                          size="sm"
                          variant={answers[q.id] === false ? "default" : "outline"}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: false }))}
                        >
                          {tc("no")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => router.push("/privacy/regulations")}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> {tc("back")}
                </Button>
                <Button
                  onClick={() => setStep("results")}
                  disabled={Object.keys(answers).length === 0}
                  title={
                    Object.keys(answers).length === 0
                      ? tw("answerFirst")
                      : undefined
                  }
                >
                  {tw("check")} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                {tw("resultsTitle")}
              </CardTitle>
              <CardDescription>
                {tw("resultsCount", { count: results?.applicableJurisdictions.length ?? 0 })}
              </CardDescription>
            </CardHeader>
          </Card>

          {results?.applicableJurisdictions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className={`w-12 h-12 mx-auto mb-4 ${toneMark("success")}`} />
                <p className="text-muted-foreground">
                  {tw("noneFound")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {applicable.map((j) => (
                  <Card key={j.code}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {j.shortName}
                            <Badge variant="outline" className="text-xs">{j.regionLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{j.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{tcard("dsarShort", { days: j.dsarDeadlineDays })}</span>
                            <span>{tcard("breachShort", { hours: j.breachNotificationHours })}</span>
                            <span className="text-foreground">{j.penalties}</span>
                          </div>
                        </div>
                        <Badge className="shrink-0">{tcat(j.category)}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("questions")}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> {tw("revise")}
                </Button>
                <Button onClick={handleApplyAll} disabled={applying}>
                  {applying ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {tw("applying")}</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> {tw("applyAll")}</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

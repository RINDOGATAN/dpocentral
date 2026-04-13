"use client";

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

export default function RegulationsWizardPage() {
  const router = useRouter();
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

  const questions = questionData?.questions ?? [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Globe className="w-6 h-6" />
          Applicability Wizard
        </h1>
        <p className="text-muted-foreground">
          Answer questions about your organization to determine which regulations apply
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
                      <div className="flex-1">
                        <p className="font-medium text-sm">{q.question}</p>
                        <p className="text-xs text-muted-foreground mt-1">{q.helpText}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant={answers[q.id] === true ? "default" : "outline"}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: true }))}
                        >
                          Yes
                        </Button>
                        <Button
                          size="sm"
                          variant={answers[q.id] === false ? "default" : "outline"}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: false }))}
                        >
                          No
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => router.push("/privacy/regulations")}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={() => setStep("results")}
                  disabled={Object.keys(answers).length === 0}
                  title={
                    Object.keys(answers).length === 0
                      ? "Answer at least one question to see applicable jurisdictions"
                      : undefined
                  }
                >
                  Check Applicability <ArrowRight className="w-4 h-4 ml-2" />
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
                Applicable Regulations
              </CardTitle>
              <CardDescription>
                Based on your answers, {results?.applicableJurisdictions.length ?? 0} regulation(s) may apply
              </CardDescription>
            </CardHeader>
          </Card>

          {results?.applicableJurisdictions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">
                  No additional regulations identified. You may want to review the full catalog.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {results?.applicableJurisdictions.map((j) => (
                  <Card key={j.code}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {j.shortName}
                            <Badge variant="outline" className="text-xs">{j.region}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{j.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>DSAR: {j.dsarDeadlineDays}d</span>
                            <span>Breach: {j.breachNotificationHours}h</span>
                            <span className="text-yellow-600">{j.penalties}</span>
                          </div>
                        </div>
                        <Badge className="shrink-0">{j.category}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("questions")}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Revise Answers
                </Button>
                <Button onClick={handleApplyAll} disabled={applying}>
                  {applying ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Apply All</>
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

"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  FileText,
  Shield,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const statusColors: Record<string, string> = {
  DRAFT: "border-muted-foreground text-muted-foreground",
  IN_PROGRESS: "border-primary text-primary",
  PENDING_REVIEW: "border-muted-foreground text-muted-foreground",
  PENDING_APPROVAL: "border-muted-foreground text-muted-foreground",
  APPROVED: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-destructive text-destructive",
};

const riskColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-destructive/50 bg-destructive/20 text-foreground",
  CRITICAL: "border-destructive bg-destructive text-destructive-foreground",
};

const typeLabels: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment",
  PIA: "Privacy Impact Assessment",
  TIA: "Transfer Impact Assessment",
  LIA: "Legitimate Interest Assessment",
  VENDOR: "Vendor Risk Assessment",
  CUSTOM: "Custom Assessment",
};

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organization } = useOrganization();

  const { data: assessment, isLoading } = trpc.assessment.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  const submitAssessment = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      utils.assessment.getById.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Assessment not found</p>
        <Link href="/privacy/assessments">
          <Button variant="outline" className="mt-4">
            Back to Assessments
          </Button>
        </Link>
      </div>
    );
  }

  const template = assessment.template;
  const sections = (template?.sections as any[]) || [];
  const completionPercentage = assessment.completionPercentage ?? 0;
  const totalQuestions = assessment.totalQuestions ?? 0;
  const answeredQuestions = assessment.responses?.length ?? 0;

  const canSubmit =
    assessment.status === "IN_PROGRESS" || assessment.status === "DRAFT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/assessments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{template?.type}</Badge>
              <Badge variant="outline" className={statusColors[assessment.status] || ""}>
                {assessment.status.replace("_", " ")}
              </Badge>
              {assessment.riskLevel && (
                <Badge variant="outline" className={riskColors[assessment.riskLevel] || ""}>
                  {assessment.riskLevel} Risk
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold mt-1">{assessment.name}</h1>
            <p className="text-muted-foreground">
              {typeLabels[template?.type ?? ""] || template?.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <Button
              onClick={() =>
                submitAssessment.mutate({
                  organizationId: organization?.id ?? "",
                  assessmentId: id,
                })
              }
              disabled={submitAssessment.isPending || completionPercentage < 100}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {answeredQuestions} of {totalQuestions} questions answered
            </span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Sections</span>
            </div>
            <p className="font-medium text-xl">{sections.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardCheck className="w-4 h-4" />
              <span className="text-sm">Questions</span>
            </div>
            <p className="font-medium text-xl">{totalQuestions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Mitigations</span>
            </div>
            <p className="font-medium text-xl">{assessment.mitigations?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Risk Score</span>
            </div>
            <p className="font-medium text-xl">
              {assessment.riskScore !== null ? `${assessment.riskScore}%` : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="mitigations">
            Mitigations ({assessment.mitigations?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals ({assessment.approvals?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 space-y-4">
          {sections.length > 0 ? (
            sections.map((section, sectionIndex) => {
              const sectionQuestions = section.questions || [];
              const answeredInSection = assessment.responses?.filter(
                (r) => r.sectionId === section.id
              ).length ?? 0;

              return (
                <Card key={section.id || sectionIndex}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        {section.description && (
                          <CardDescription>{section.description}</CardDescription>
                        )}
                      </div>
                      <Badge variant="outline">
                        {answeredInSection}/{sectionQuestions.length} answered
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sectionQuestions.map((question: any, qIndex: number) => {
                        const response = assessment.responses?.find(
                          (r) => r.questionId === question.id
                        );
                        const isAnswered = !!response;

                        return (
                          <div
                            key={question.id || qIndex}
                            className={`p-4 border ${
                              isAnswered ? "border-primary/50 bg-primary/5" : "border-border"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${
                                  isAnswered
                                    ? "bg-primary text-primary-foreground"
                                    : "border-2 border-muted-foreground"
                                }`}
                              >
                                {isAnswered && <CheckCircle2 className="w-4 h-4" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{question.text}</span>
                                  {question.required && (
                                    <Badge variant="outline" className="text-xs">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                                {question.helpText && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {question.helpText}
                                  </p>
                                )}
                                {response && (
                                  <div className="mt-3 p-3 bg-muted/50">
                                    <p className="text-sm">
                                      <strong>Answer:</strong>{" "}
                                      {typeof response.response === "string"
                                        ? response.response
                                        : JSON.stringify(response.response)}
                                    </p>
                                    {response.notes && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        <strong>Notes:</strong> {response.notes}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No questions in this assessment</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mitigations" className="mt-4">
          {assessment.mitigations && assessment.mitigations.length > 0 ? (
            <div className="space-y-4">
              {assessment.mitigations.map((mitigation) => (
                <Card key={mitigation.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-primary" />
                          <span className="font-medium">{mitigation.title}</span>
                          <Badge variant="outline">{mitigation.status}</Badge>
                          <Badge variant="outline">Priority {mitigation.priority}</Badge>
                        </div>
                        {mitigation.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {mitigation.description}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        Update
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No mitigations identified</p>
                <Button className="mt-4">Add Mitigation</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          {assessment.approvals && assessment.approvals.length > 0 ? (
            <div className="space-y-4">
              {assessment.approvals.map((approval) => (
                <Card key={approval.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span className="font-medium">
                            Level {approval.level} Approval
                          </span>
                          <Badge variant="outline">{approval.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Approver: {approval.approver?.name || approval.approver?.email}
                        </p>
                        {approval.comments && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Comments: {approval.comments}
                          </p>
                        )}
                      </div>
                      {approval.decidedAt && (
                        <span className="text-sm text-muted-foreground">
                          {new Date(approval.decidedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No approvals requested</p>
                {assessment.status === "PENDING_REVIEW" && (
                  <Button className="mt-4">Request Approval</Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {assessment.versions && assessment.versions.length > 0 ? (
            <div className="space-y-4">
              {assessment.versions.map((version) => (
                <Card key={version.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">Version {version.version}</span>
                        <p className="text-sm text-muted-foreground">
                          {version.changeNotes}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No version history</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

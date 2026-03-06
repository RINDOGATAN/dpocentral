"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ShieldCheck,
  Save,
  Edit,
  Plus,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { getRisksAddressedByPet } from "@/config/pet-risk-mappings";

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

const mitigationStatusColors: Record<string, string> = {
  IDENTIFIED: "border-muted-foreground text-muted-foreground",
  PLANNED: "border-blue-500 text-blue-600",
  IN_PROGRESS: "border-primary text-primary",
  IMPLEMENTED: "border-green-500 text-green-600",
  VERIFIED: "border-green-600 bg-green-600 text-white",
  NOT_REQUIRED: "border-muted-foreground/50 text-muted-foreground/50",
};

const typeLabels: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment",
  PIA: "Privacy Impact Assessment",
  TIA: "Transfer Impact Assessment",
  LIA: "Legitimate Interest Assessment",
  VENDOR: "Vendor Risk Assessment",
  CUSTOM: "Custom Assessment",
};

const MITIGATION_STATUSES = [
  "IDENTIFIED",
  "PLANNED",
  "IN_PROGRESS",
  "IMPLEMENTED",
  "VERIFIED",
  "NOT_REQUIRED",
] as const;

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organization } = useOrganization();
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [draftResponses, setDraftResponses] = useState<Record<string, { response: string; notes: string }>>({});

  // Mitigation dialog state
  const [addMitigationOpen, setAddMitigationOpen] = useState(false);
  const [addMitigationTab, setAddMitigationTab] = useState<"manual" | "suggested">("manual");
  const [mitigationForm, setMitigationForm] = useState({
    title: "",
    description: "",
    priority: 3,
    owner: "",
    dueDate: "",
  });

  // Update mitigation dialog state
  const [updateMitigationOpen, setUpdateMitigationOpen] = useState(false);
  const [editingMitigation, setEditingMitigation] = useState<any>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "",
    owner: "",
    dueDate: "",
    evidence: "",
  });

  const { data: assessment, isLoading } = trpc.assessment.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  // Fetch PET-based suggestions when assessment loads
  const { data: suggestions } = trpc.assessment.getSuggestedMitigations.useQuery(
    { organizationId: organization?.id ?? "", assessmentId: id },
    { enabled: !!organization?.id && !!assessment }
  );

  const utils = trpc.useUtils();

  const submitAssessment = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      toast.success("Assessment submitted for review");
      utils.assessment.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit assessment");
    },
  });

  const saveResponse = trpc.assessment.saveResponse.useMutation({
    onSuccess: () => {
      toast.success("Response saved");
      utils.assessment.getById.invalidate();
      setEditingQuestion(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save response");
    },
  });

  const addMitigation = trpc.assessment.addMitigation.useMutation({
    onSuccess: () => {
      toast.success("Mitigation added");
      utils.assessment.getById.invalidate();
      utils.assessment.getSuggestedMitigations.invalidate();
      setAddMitigationOpen(false);
      setMitigationForm({ title: "", description: "", priority: 3, owner: "", dueDate: "" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add mitigation");
    },
  });

  const updateMitigation = trpc.assessment.updateMitigation.useMutation({
    onSuccess: () => {
      toast.success("Mitigation updated");
      utils.assessment.getById.invalidate();
      setUpdateMitigationOpen(false);
      setEditingMitigation(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update mitigation");
    },
  });

  const handleSaveResponse = useCallback((questionId: string, sectionId: string, question: any) => {
    if (!organization?.id) return;
    const draft = draftResponses[questionId];
    if (!draft?.response) return;

    saveResponse.mutate({
      organizationId: organization.id,
      assessmentId: id,
      questionId,
      sectionId,
      response: draft.response,
      notes: draft.notes || undefined,
      riskScore: question.riskScore,
    });
  }, [organization?.id, id, draftResponses, saveResponse]);

  const startEditingQuestion = useCallback((questionId: string, existingResponse?: any) => {
    setEditingQuestion(questionId);
    if (existingResponse) {
      setDraftResponses(prev => ({
        ...prev,
        [questionId]: {
          response: typeof existingResponse.response === "string"
            ? existingResponse.response
            : JSON.stringify(existingResponse.response),
          notes: existingResponse.notes || "",
        },
      }));
    } else {
      setDraftResponses(prev => ({
        ...prev,
        [questionId]: { response: "", notes: "" },
      }));
    }
  }, []);

  const updateDraftResponse = useCallback((questionId: string, field: "response" | "notes", value: string) => {
    setDraftResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
  }, []);

  const handleAddMitigation = () => {
    if (!organization?.id || !mitigationForm.title) return;
    addMitigation.mutate({
      organizationId: organization.id,
      assessmentId: id,
      riskId: "manual",
      title: mitigationForm.title,
      description: mitigationForm.description || undefined,
      priority: mitigationForm.priority,
      owner: mitigationForm.owner || undefined,
      dueDate: mitigationForm.dueDate ? new Date(mitigationForm.dueDate) : undefined,
    });
  };

  const handleAcceptSuggestion = (pet: string, riskLabel: string, gdprRef: string) => {
    if (!organization?.id) return;
    const vendorName = suggestions?.vendorName;
    const isVendorPet = suggestions?.vendorPets.includes(pet);
    const description = isVendorPet
      ? `Address ${riskLabel} risk (${gdprRef}). ${vendorName} implements this technology.`
      : `Address ${riskLabel} risk (${gdprRef}). Consider implementing ${pet} as a technical safeguard.`;

    addMitigation.mutate({
      organizationId: organization.id,
      assessmentId: id,
      riskId: "pet_suggestion",
      title: `Implement ${pet}`,
      description,
      priority: 2,
    });
  };

  const openUpdateDialog = (mitigation: any) => {
    setEditingMitigation(mitigation);
    setUpdateForm({
      status: mitigation.status,
      owner: mitigation.owner || "",
      dueDate: mitigation.dueDate ? new Date(mitigation.dueDate).toISOString().split("T")[0] : "",
      evidence: mitigation.evidence || "",
    });
    setUpdateMitigationOpen(true);
  };

  const handleUpdateMitigation = () => {
    if (!organization?.id || !editingMitigation) return;
    updateMitigation.mutate({
      organizationId: organization.id,
      id: editingMitigation.id,
      status: updateForm.status as any,
      owner: updateForm.owner || null,
      dueDate: updateForm.dueDate ? new Date(updateForm.dueDate) : null,
      evidence: updateForm.evidence || null,
    });
  };

  const openAddDialogWithSuggestions = () => {
    setAddMitigationTab("suggested");
    setAddMitigationOpen(true);
  };

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

  const vendorPets = suggestions?.vendorPets ?? [];
  const vendorName = suggestions?.vendorName ?? null;
  const hasSuggestions = (suggestions?.riskBasedSuggestions?.length ?? 0) > 0 || vendorPets.length > 0;

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
              {submitAssessment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
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
                                {/* Answer Section */}
                                {editingQuestion === question.id ? (
                                  <div className="mt-3 p-3 bg-muted/50 space-y-3">
                                    {question.type === "select" && question.options ? (
                                      <Select
                                        value={draftResponses[question.id]?.response || ""}
                                        onValueChange={(value) => updateDraftResponse(question.id, "response", value)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select an option" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(question.options as string[]).map((option: string) => (
                                            <SelectItem key={option} value={option}>
                                              {option}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : question.type === "textarea" ? (
                                      <Textarea
                                        placeholder="Enter your response..."
                                        rows={3}
                                        value={draftResponses[question.id]?.response || ""}
                                        onChange={(e) => updateDraftResponse(question.id, "response", e.target.value)}
                                      />
                                    ) : (
                                      <Input
                                        placeholder="Enter your response..."
                                        value={draftResponses[question.id]?.response || ""}
                                        onChange={(e) => updateDraftResponse(question.id, "response", e.target.value)}
                                      />
                                    )}
                                    <Textarea
                                      placeholder="Additional notes (optional)..."
                                      rows={2}
                                      value={draftResponses[question.id]?.notes || ""}
                                      onChange={(e) => updateDraftResponse(question.id, "notes", e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveResponse(question.id, section.id, question)}
                                        disabled={saveResponse.isPending || !draftResponses[question.id]?.response}
                                      >
                                        {saveResponse.isPending ? (
                                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        ) : (
                                          <Save className="w-4 h-4 mr-1" />
                                        )}
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingQuestion(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : response ? (
                                  <div className="mt-3 p-3 bg-muted/50">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
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
                                      {canSubmit && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditingQuestion(question.id, response)}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ) : canSubmit ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => startEditingQuestion(question.id)}
                                  >
                                    Answer Question
                                  </Button>
                                ) : null}
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

        <TabsContent value="mitigations" className="mt-4 space-y-4">
          {/* Vendor PETs Card */}
          {vendorPets.length > 0 && vendorName && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      <span className="font-medium">Vendor Privacy Technologies</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {vendorName} implements these PETs:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {vendorPets.map((pet) => (
                        <Badge key={pet} variant="outline" className="border-primary/50">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          {pet}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      These can be referenced as mitigating measures in your assessment.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openAddDialogWithSuggestions}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Suggest as Mitigations
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Mitigations */}
          {assessment.mitigations && assessment.mitigations.length > 0 ? (
            <div className="space-y-4">
              {assessment.mitigations.map((mitigation) => (
                <Card key={mitigation.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AlertTriangle className="w-4 h-4 text-primary" />
                          <span className="font-medium">{mitigation.title}</span>
                          <Badge variant="outline" className={mitigationStatusColors[mitigation.status] || ""}>
                            {mitigation.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline">Priority {mitigation.priority}</Badge>
                          {mitigation.owner && (
                            <span className="text-xs text-muted-foreground">
                              Owner: {mitigation.owner}
                            </span>
                          )}
                        </div>
                        {mitigation.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {mitigation.description}
                          </p>
                        )}
                        {mitigation.evidence && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Evidence:</strong> {mitigation.evidence}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUpdateDialog(mitigation)}
                      >
                        Update
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="outline"
                onClick={() => { setAddMitigationTab("manual"); setAddMitigationOpen(true); }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Mitigation
              </Button>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No mitigations identified</p>
                <Button
                  className="mt-4"
                  onClick={() => { setAddMitigationTab(hasSuggestions ? "suggested" : "manual"); setAddMitigationOpen(true); }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Mitigation
                </Button>
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

      {/* Add Mitigation Dialog */}
      <Dialog open={addMitigationOpen} onOpenChange={setAddMitigationOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Mitigation</DialogTitle>
            <DialogDescription>
              Add a mitigating measure to address identified risks.
            </DialogDescription>
          </DialogHeader>

          {hasSuggestions && (
            <Tabs value={addMitigationTab} onValueChange={(v) => setAddMitigationTab(v as "manual" | "suggested")}>
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
                <TabsTrigger value="suggested" className="flex-1">
                  <Lightbulb className="w-4 h-4 mr-1" />
                  Suggested
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="mt-4">
                <MitigationFormFields
                  form={mitigationForm}
                  onChange={setMitigationForm}
                />
              </TabsContent>

              <TabsContent value="suggested" className="mt-4 space-y-4">
                {/* Vendor PET suggestions */}
                {vendorPets.length > 0 && vendorName && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      {vendorName} Privacy Technologies
                    </h4>
                    <div className="space-y-2">
                      {vendorPets.map((pet) => {
                        const risks = getRisksAddressedByPet(pet);
                        return (
                          <div key={pet} className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{pet}</span>
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                  Vendor implements
                                </Badge>
                              </div>
                              {risks.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Addresses: {risks.map((r) => r.label).join(", ")}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcceptSuggestion(
                                pet,
                                risks[0]?.label ?? "identified",
                                risks[0]?.gdprReference ?? "GDPR"
                              )}
                              disabled={addMitigation.isPending}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Accept
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Risk-based suggestions */}
                {(suggestions?.riskBasedSuggestions ?? []).map((suggestion) => (
                  <div key={suggestion.riskId}>
                    <h4 className="text-sm font-medium mb-2">
                      {suggestion.label}
                      <span className="text-xs text-muted-foreground ml-2">
                        {suggestion.gdprReference}
                      </span>
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">{suggestion.description}</p>
                    <div className="space-y-2">
                      {suggestion.recommendedPets.map((pet) => {
                        const isVendorPet = vendorPets.includes(pet);
                        return (
                          <div key={pet} className="flex items-center justify-between p-3 border rounded-md">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{pet}</span>
                              {isVendorPet && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                  Vendor implements
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcceptSuggestion(pet, suggestion.label, suggestion.gdprReference)}
                              disabled={addMitigation.isPending}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Accept
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!hasSuggestions && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No suggestions yet. Answer assessment questions to get PET-based recommendations.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}

          {!hasSuggestions && (
            <MitigationFormFields
              form={mitigationForm}
              onChange={setMitigationForm}
            />
          )}

          {(addMitigationTab === "manual" || !hasSuggestions) && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddMitigationOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddMitigation}
                disabled={!mitigationForm.title || addMitigation.isPending}
              >
                {addMitigation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Add Mitigation
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Mitigation Dialog */}
      <Dialog open={updateMitigationOpen} onOpenChange={setUpdateMitigationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Mitigation</DialogTitle>
            <DialogDescription>
              {editingMitigation?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={updateForm.status}
                onValueChange={(v) => setUpdateForm({ ...updateForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MITIGATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Owner</Label>
              <Input
                placeholder="Person responsible"
                value={updateForm.owner}
                onChange={(e) => setUpdateForm({ ...updateForm, owner: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={updateForm.dueDate}
                onChange={(e) => setUpdateForm({ ...updateForm, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Evidence</Label>
              <Textarea
                placeholder="Evidence of implementation (documents, links, screenshots...)"
                rows={3}
                value={updateForm.evidence}
                onChange={(e) => setUpdateForm({ ...updateForm, evidence: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateMitigationOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMitigation}
              disabled={updateMitigation.isPending}
            >
              {updateMitigation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Reusable form fields for manual mitigation entry */
function MitigationFormFields({
  form,
  onChange,
}: {
  form: { title: string; description: string; priority: number; owner: string; dueDate: string };
  onChange: (f: typeof form) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input
          placeholder="e.g., Implement pseudonymization for customer records"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          placeholder="Describe the mitigation measure and how it addresses the risk..."
          rows={3}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={String(form.priority)}
            onValueChange={(v) => onChange({ ...form, priority: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 - Critical</SelectItem>
              <SelectItem value="2">2 - High</SelectItem>
              <SelectItem value="3">3 - Medium</SelectItem>
              <SelectItem value="4">4 - Low</SelectItem>
              <SelectItem value="5">5 - Minimal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Owner</Label>
          <Input
            placeholder="Person responsible"
            value={form.owner}
            onChange={(e) => onChange({ ...form, owner: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => onChange({ ...form, dueDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

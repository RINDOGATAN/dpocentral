"use client";

import { use, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  Download,
  Shield,
  ShieldCheck,
  Save,
  Edit,
  Plus,
  Lightbulb,
  Sparkles,
  Check,
  XCircle,
  UserCheck,
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

const typeKeys: Record<string, string> = {
  DPIA: "dpia",
  PIA: "pia",
  TIA: "tia",
  LIA: "lia",
  VENDOR: "vendor",
  CUSTOM: "custom",
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
  const tAssessments = useTranslations("assessments");
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.assessmentDetail");
  const tList = useTranslations("pages.assessments");
  const tCommon = useTranslations("common");
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [draftResponses, setDraftResponses] = useState<Record<string, { response: string; notes: string }>>({});
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [savedIndicators, setSavedIndicators] = useState<Record<string, boolean>>({});
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectApprovalId, setRejectApprovalId] = useState<string>("");
  const [rejectComments, setRejectComments] = useState("");

  // Session for current user
  const { data: sessionData } = useSession();
  const currentUserId = sessionData?.user?.id;

  // Fetch org members (for approver selection and single-user detection)
  const { data: orgData } = trpc.organization.getById.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );
  const members = (orgData as any)?.members;
  const memberCount = Array.isArray(members) ? members.length : -1;
  const isSingleUser = memberCount === 1;

  const { data: assessment, isLoading } = trpc.assessment.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id, staleTime: 30_000 }
  );

  // Fetch PET-based suggestions when assessment loads
  const { data: suggestions } = trpc.assessment.getSuggestedMitigations.useQuery(
    { organizationId: organization?.id ?? "", assessmentId: id },
    { enabled: !!organization?.id && !!assessment, staleTime: 60_000 }
  );

  const utils = trpc.useUtils();

  const submitAssessment = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      toast.success(t("assessment.submittedForReview"));
      utils.assessment.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  // Auto-save mutation (select/boolean/multiselect): optimistic local update, no full refetch
  const autoSaveResponse = trpc.assessment.saveResponse.useMutation({
    onSuccess: (_data, variables) => {
      // Show saved indicator without refetching the entire assessment
      setSavedIndicators(prev => ({ ...prev, [variables.questionId]: true }));
      setTimeout(() => {
        setSavedIndicators(prev => ({ ...prev, [variables.questionId]: false }));
      }, 2000);
    },
    onError: (error) => {
      // On error, invalidate to restore correct server state
      utils.assessment.getById.invalidate();
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  // Explicit save mutation (text responses): invalidates to get fresh data
  const saveResponse = trpc.assessment.saveResponse.useMutation({
    onSuccess: (_data, variables) => {
      utils.assessment.getById.invalidate();
      // Show saved indicator for this question
      setSavedIndicators(prev => ({ ...prev, [variables.questionId]: true }));
      setTimeout(() => {
        setSavedIndicators(prev => ({ ...prev, [variables.questionId]: false }));
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const addMitigation = trpc.assessment.addMitigation.useMutation({
    onSuccess: () => {
      toast.success(t("assessment.mitigationAdded"));
      utils.assessment.getById.invalidate();
      utils.assessment.getSuggestedMitigations.invalidate();
      setAddMitigationOpen(false);
      setMitigationForm({ title: "", description: "", priority: 3, owner: "", dueDate: "" });
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const updateMitigation = trpc.assessment.updateMitigation.useMutation({
    onSuccess: () => {
      toast.success(t("assessment.mitigationUpdated"));
      utils.assessment.getById.invalidate();
      setUpdateMitigationOpen(false);
      setEditingMitigation(null);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  // Approval mutations
  const submitAndApprove = trpc.assessment.submitAndApprove.useMutation({
    onSuccess: () => {
      toast.success(t("assessment.submittedApproved"));
      utils.assessment.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const requestApproval = trpc.assessment.requestApproval.useMutation({
    onSuccess: () => {
      toast.success(t("assessment.approvalRequested"));
      utils.assessment.getById.invalidate();
      setApprovalDialogOpen(false);
      setSelectedApproverId("");
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const processApproval = trpc.assessment.processApproval.useMutation({
    onSuccess: () => {
      toast.success(t("assessment.approvalRecorded"));
      utils.assessment.getById.invalidate();
      setRejectDialogOpen(false);
      setRejectComments("");
      setRejectApprovalId("");
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
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

  // Auto-save for select/boolean/multiselect — optimistic update, no full refetch
  const handleAutoSave = useCallback((questionId: string, sectionId: string, question: any, value: string) => {
    if (!organization?.id || !value) return;
    // Update draft state
    setDraftResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        response: value,
        notes: prev[questionId]?.notes || "",
      },
    }));
    // Optimistically update the query cache so UI reflects the change instantly
    const queryKey = { organizationId: organization.id, id };
    utils.assessment.getById.setData(queryKey, (old: any) => {
      if (!old) return old;
      const existingIdx = old.responses?.findIndex((r: any) => r.questionId === questionId) ?? -1;
      const newResponse = {
        questionId,
        sectionId,
        response: value,
        notes: draftResponses[questionId]?.notes || "",
        riskScore: question.riskScore ?? null,
      };
      const updatedResponses = [...(old.responses ?? [])];
      if (existingIdx >= 0) {
        updatedResponses[existingIdx] = { ...updatedResponses[existingIdx], ...newResponse };
      } else {
        updatedResponses.push(newResponse);
      }
      // Recalculate completion
      const totalQ = old.totalQuestions ?? 0;
      const answeredQ = updatedResponses.length;
      return {
        ...old,
        responses: updatedResponses,
        completionPercentage: totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0,
      };
    });
    // Fire mutation without invalidation
    autoSaveResponse.mutate({
      organizationId: organization.id,
      assessmentId: id,
      questionId,
      sectionId,
      response: value,
      notes: draftResponses[questionId]?.notes || undefined,
      riskScore: question.riskScore,
    });
  }, [organization?.id, id, draftResponses, autoSaveResponse, utils.assessment.getById]);

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

  const handleSaveTextResponse = useCallback((questionId: string, sectionId: string, question: any) => {
    handleSaveResponse(questionId, sectionId, question);
    setEditingQuestion(null);
  }, [handleSaveResponse]);

  const updateDraftResponse = useCallback((questionId: string, field: "response" | "notes", value: string) => {
    setDraftResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
  }, []);

  const handleAddMitigation = useCallback(() => {
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
  }, [organization?.id, id, mitigationForm, addMitigation]);

  const handleAcceptSuggestion = useCallback((pet: string, riskLabel: string, gdprRef: string) => {
    if (!organization?.id) return;
    const vName = suggestions?.vendorName;
    const isVendorPet = suggestions?.vendorPets.includes(pet);
    const description = isVendorPet
      ? `Address ${riskLabel} risk (${gdprRef}). ${vName} implements this technology.`
      : `Address ${riskLabel} risk (${gdprRef}). Consider implementing ${pet} as a technical safeguard.`;

    addMitigation.mutate({
      organizationId: organization.id,
      assessmentId: id,
      riskId: "pet_suggestion",
      title: `Implement ${pet}`,
      description,
      priority: 2,
    });
  }, [organization?.id, id, suggestions?.vendorName, suggestions?.vendorPets, addMitigation]);

  const openUpdateDialog = useCallback((mitigation: any) => {
    setEditingMitigation(mitigation);
    setUpdateForm({
      status: mitigation.status,
      owner: mitigation.owner || "",
      dueDate: mitigation.dueDate ? new Date(mitigation.dueDate).toISOString().split("T")[0] : "",
      evidence: mitigation.evidence || "",
    });
    setUpdateMitigationOpen(true);
  }, []);

  const handleUpdateMitigation = useCallback(() => {
    if (!organization?.id || !editingMitigation) return;
    updateMitigation.mutate({
      organizationId: organization.id,
      id: editingMitigation.id,
      status: updateForm.status as any,
      owner: updateForm.owner || null,
      dueDate: updateForm.dueDate ? new Date(updateForm.dueDate) : null,
      evidence: updateForm.evidence || null,
    });
  }, [organization?.id, editingMitigation, updateForm, updateMitigation]);

  const openAddDialogWithSuggestions = useCallback(() => {
    setAddMitigationTab("suggested");
    setAddMitigationOpen(true);
  }, []);

  // Derived values — safe to compute even when assessment is null
  const template = assessment?.template;
  const sections = (template?.sections as any[]) || [];
  const completionPercentage = assessment?.completionPercentage ?? 0;
  const totalQuestions = assessment?.totalQuestions ?? 0;
  const answeredQuestions = assessment?.responses?.length ?? 0;

  const canSubmit =
    assessment?.status === "IN_PROGRESS" || assessment?.status === "DRAFT";

  // Check if all REQUIRED questions are answered (mirrors server-side validation)
  const requiredQuestionIds = sections.flatMap((s: any) =>
    (s.questions || []).filter((q: any) => q.required).map((q: any) => q.id)
  );
  const answeredIds = new Set(assessment?.responses?.map((r: any) => r.questionId) ?? []);
  const allRequiredAnswered = requiredQuestionIds.length === 0 || requiredQuestionIds.every((id: string) => answeredIds.has(id));

  // These hooks MUST be called unconditionally (before early returns)
  const sectionCompletionData = useMemo(() => sections.map((section) => {
    const sectionQuestions = section.questions || [];
    const answeredInSection = assessment?.responses?.filter(
      (r: any) => r.sectionId === section.id
    ).length ?? 0;
    return {
      id: section.id,
      title: section.title,
      answered: answeredInSection,
      total: sectionQuestions.length,
      isComplete: answeredInSection === sectionQuestions.length && sectionQuestions.length > 0,
    };
  }), [sections, assessment?.responses]);

  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const parseMultiselectValue = useCallback((val: string | undefined): string[] => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON, return as single item if non-empty
    }
    return val ? [val] : [];
  }, []);

  const vendorPets = suggestions?.vendorPets ?? [];
  const vendorName = suggestions?.vendorName ?? null;
  const hasSuggestions = (suggestions?.riskBasedSuggestions?.length ?? 0) > 0 || vendorPets.length > 0;

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
        <p className="text-muted-foreground">{tp("notFound")}</p>
        <Link href="/privacy/assessments">
          <Button variant="outline" className="mt-4">{tp("back")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/assessments">
            <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{template?.type ? tList(`type.${template.type}` as `type.DPIA` | `type.PIA` | `type.TIA` | `type.LIA` | `type.VENDOR` | `type.CUSTOM`) : ""}</Badge>
              <Badge variant="outline" className={statusColors[assessment.status] || ""}>
                {tList(`status.${assessment.status}` as `status.DRAFT` | `status.IN_PROGRESS` | `status.PENDING_REVIEW` | `status.PENDING_APPROVAL` | `status.APPROVED` | `status.REJECTED`)}
              </Badge>
              {assessment.riskLevel && (
                <Badge variant="outline" className={riskColors[assessment.riskLevel] || ""}>
                  {tp("riskBadge", { level: tList(`riskLevel.${assessment.riskLevel}` as `riskLevel.LOW` | `riskLevel.MEDIUM` | `riskLevel.HIGH` | `riskLevel.CRITICAL`) })}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold mt-1">{assessment.name}</h1>
            <p className="text-muted-foreground">
              {typeKeys[template?.type ?? ""] ? tAssessments(`types.${typeKeys[template?.type ?? ""]}`) : template?.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/api/export/assessment/${id}`, "_blank")}
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{tp("exportPdf")}</span>
          </Button>
          {canSubmit && isSingleUser && (
            <Button
              onClick={() =>
                submitAndApprove.mutate({
                  organizationId: organization?.id ?? "",
                  assessmentId: id,
                })
              }
              disabled={submitAndApprove.isPending || !allRequiredAnswered}
            >
              {submitAndApprove.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {tp("submitApprove")}
            </Button>
          )}
          {canSubmit && !isSingleUser && (
            <Button
              onClick={() =>
                submitAssessment.mutate({
                  organizationId: organization?.id ?? "",
                  assessmentId: id,
                })
              }
              disabled={submitAssessment.isPending || !allRequiredAnswered}
            >
              {submitAssessment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {tp("submitReview")}
            </Button>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {tp("progress.answered", { answered: answeredQuestions, total: totalQuestions })}
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
              <span className="text-sm">{tp("stats.sections")}</span>
            </div>
            <p className="font-medium text-xl">{sections.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardCheck className="w-4 h-4" />
              <span className="text-sm">{tp("stats.questions")}</span>
            </div>
            <p className="font-medium text-xl">{totalQuestions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{tp("stats.mitigations")}</span>
            </div>
            <p className="font-medium text-xl">{assessment.mitigations?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="w-4 h-4" />
              <span className="text-sm">{tp("stats.riskScore")}</span>
            </div>
            <p className="font-medium text-xl">
              {assessment.riskScore !== null ? `${assessment.riskScore}%` : tp("stats.noScore")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
              {tp("stats.riskScoreScale")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">{tp("tabs.questions")}</TabsTrigger>
          <TabsTrigger value="mitigations">
            {tp("tabs.mitigationsWithCount", { count: assessment.mitigations?.length ?? 0 })}
          </TabsTrigger>
          <TabsTrigger value="approvals">
            {tp("tabs.approvalsWithCount", { count: assessment.approvals?.length ?? 0 })}
          </TabsTrigger>
          <TabsTrigger value="history">{tp("tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 space-y-4">
          {/* Section Navigation - sticky pills */}
          {sections.length > 1 && (
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-3 pt-1 -mx-1 px-1">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {sectionCompletionData.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
                      activeSectionId === sec.id
                        ? "bg-primary text-primary-foreground"
                        : sec.isComplete
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {sec.isComplete && <Check className="w-3.5 h-3.5" />}
                    <span className="whitespace-nowrap">{sec.title}</span>
                    <span className={`text-xs ${activeSectionId === sec.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {sec.answered}/{sec.total}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sections.length > 0 ? (
            sections.map((section, sectionIndex) => {
              const sectionQuestions = section.questions || [];
              const answeredInSection = assessment.responses?.filter(
                (r: any) => r.sectionId === section.id
              ).length ?? 0;

              return (
                <div
                  key={section.id || sectionIndex}
                  ref={(el) => { sectionRefs.current[section.id] = el; }}
                >
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{section.title}</CardTitle>
                          {section.description && (
                            <CardDescription className="mt-1">{section.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={answeredInSection === sectionQuestions.length && sectionQuestions.length > 0 ? "border-primary text-primary" : ""}>
                            {answeredInSection === sectionQuestions.length && sectionQuestions.length > 0 && (
                              <Check className="w-3 h-3 mr-1" />
                            )}
                            {answeredInSection}/{sectionQuestions.length}
                          </Badge>
                        </div>
                      </div>
                      {/* Section progress bar */}
                      <Progress
                        value={sectionQuestions.length > 0 ? (answeredInSection / sectionQuestions.length) * 100 : 0}
                        className="h-1 mt-3"
                      />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {sectionQuestions.map((question: any, qIndex: number) => {
                          const response = assessment.responses?.find(
                            (r: any) => r.questionId === question.id
                          );
                          const isAnswered = !!response;
                          const responseValue = response
                            ? typeof response.response === "string"
                              ? response.response
                              : JSON.stringify(response.response)
                            : "";
                          const isTextType = question.type === "textarea" || question.type === "text" || (!question.type && !question.options);
                          const isEditing = editingQuestion === question.id;
                          const draftValue = draftResponses[question.id]?.response ?? "";
                          const hasDraftChanges = isTextType && isEditing && draftValue !== responseValue;

                          return (
                            <div
                              key={question.id || qIndex}
                              className={`p-4 sm:p-5 rounded-lg border transition-colors ${
                                isAnswered
                                  ? "border-primary/30 bg-primary/5"
                                  : question.required
                                    ? "border-destructive/30 bg-destructive/5"
                                    : "border-border"
                              }`}
                            >
                              {/* Question Header */}
                              <div className="flex items-start gap-3 mb-3">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    isAnswered
                                      ? "bg-primary text-primary-foreground"
                                      : "border-2 border-muted-foreground/40"
                                  }`}
                                >
                                  {isAnswered ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <span className="text-xs text-muted-foreground font-medium">{qIndex + 1}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-1.5 flex-wrap">
                                    <span className="font-medium text-sm sm:text-base leading-snug">
                                      {question.text}
                                      {question.required && (
                                        <span className="text-destructive ml-0.5">*</span>
                                      )}
                                    </span>
                                    {!question.required && (
                                      <span className="text-xs text-muted-foreground mt-0.5">{tp("question.optional")}</span>
                                    )}
                                  </div>
                                  {question.helpText && (
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                      {question.helpText}
                                    </p>
                                  )}
                                </div>
                                {/* Saved indicator */}
                                {savedIndicators[question.id] && (
                                  <span className="flex items-center gap-1 text-xs text-primary flex-shrink-0 animate-in fade-in">
                                    <Check className="w-3.5 h-3.5" />
                                    {tp("question.saved")}
                                  </span>
                                )}
                              </div>

                              {/* Input Area - always visible for non-text types */}
                              <div className="ml-10">
                                {/* Boolean type: Yes/No toggle buttons */}
                                {question.type === "boolean" && (
                                  <div className="space-y-2">
                                    <div className="inline-flex rounded-lg border overflow-hidden">
                                      <button
                                        type="button"
                                        disabled={!canSubmit}
                                        onClick={() => handleAutoSave(question.id, section.id, question, "Yes")}
                                        className={`px-5 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                                          responseValue === "Yes"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-background hover:bg-muted text-foreground"
                                        } ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
                                      >
                                        {tp("question.yes")}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!canSubmit}
                                        onClick={() => handleAutoSave(question.id, section.id, question, "No")}
                                        className={`px-5 py-2.5 text-sm font-medium min-h-[44px] transition-colors border-l ${
                                          responseValue === "No"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-background hover:bg-muted text-foreground"
                                        } ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
                                      >
                                        {tp("question.no")}
                                      </button>
                                    </div>
                                    {response?.notes && !isEditing && (
                                      <p className="text-xs text-muted-foreground">
                                        <strong>{tp("question.notes")}</strong> {response.notes}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Select type: prominent dropdown */}
                                {question.type === "select" && question.options && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">{tp("question.chooseOne")}</Label>
                                    <Select
                                      value={responseValue || ""}
                                      onValueChange={(value) => handleAutoSave(question.id, section.id, question, value)}
                                      disabled={!canSubmit}
                                    >
                                      <SelectTrigger className="w-full sm:w-[400px] min-h-[44px] text-sm">
                                        <SelectValue placeholder={tp("question.selectOption")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(question.options as string[]).map((option: string) => (
                                          <SelectItem key={option} value={option} className="min-h-[40px]">
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {response?.notes && !isEditing && (
                                      <p className="text-xs text-muted-foreground">
                                        <strong>{tp("question.notes")}</strong> {response.notes}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Multiselect type: checkboxes */}
                                {question.type === "multiselect" && question.options && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">{tp("question.selectAllApply")}</Label>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {(question.options as string[]).map((option: string) => {
                                        const currentValues = parseMultiselectValue(responseValue);
                                        const isChecked = currentValues.includes(option);
                                        return (
                                          <label
                                            key={option}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors min-h-[44px] ${
                                              isChecked
                                                ? "border-primary/50 bg-primary/5"
                                                : "border-border hover:border-muted-foreground/50"
                                            } ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
                                          >
                                            <Checkbox
                                              checked={isChecked}
                                              disabled={!canSubmit}
                                              onCheckedChange={(checked) => {
                                                const newValues = checked
                                                  ? [...currentValues, option]
                                                  : currentValues.filter((v: string) => v !== option);
                                                handleAutoSave(question.id, section.id, question, JSON.stringify(newValues));
                                              }}
                                            />
                                            <span className="text-sm">{option}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    {response?.notes && !isEditing && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        <strong>Notes:</strong> {response.notes}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Textarea / Text type: show inline with save button */}
                                {isTextType && (
                                  <>
                                    {isEditing ? (
                                      <div className="space-y-3">
                                        <Textarea
                                          placeholder={tp("question.responsePlaceholder")}
                                          rows={3}
                                          value={draftValue}
                                          onChange={(e) => updateDraftResponse(question.id, "response", e.target.value)}
                                          className="min-h-[44px]"
                                        />
                                        <Textarea
                                          placeholder={tp("question.notesPlaceholder")}
                                          rows={2}
                                          value={draftResponses[question.id]?.notes || ""}
                                          onChange={(e) => updateDraftResponse(question.id, "notes", e.target.value)}
                                          className="text-sm"
                                        />
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant={hasDraftChanges ? "default" : "outline"}
                                            onClick={() => handleSaveTextResponse(question.id, section.id, question)}
                                            disabled={saveResponse.isPending || !draftValue}
                                            className="min-h-[44px]"
                                          >
                                            {saveResponse.isPending ? (
                                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            ) : (
                                              <Save className="w-4 h-4 mr-1" />
                                            )}
                                            {tp("question.save")}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingQuestion(null)}
                                            className="min-h-[44px]"
                                          >
                                            {tp("question.cancel")}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : isAnswered ? (
                                      <div className="p-3 bg-muted/50 rounded-lg">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm whitespace-pre-wrap">{responseValue}</p>
                                            {response.notes && (
                                              <p className="text-xs text-muted-foreground mt-2">
                                                <strong>Notes:</strong> {response.notes}
                                              </p>
                                            )}
                                          </div>
                                          {canSubmit && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => startEditingQuestion(question.id, response)}
                                              className="flex-shrink-0 min-h-[44px]"
                                            >
                                              <Edit className="w-4 h-4" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ) : canSubmit ? (
                                      <Textarea
                                        placeholder={tp("question.responsePlaceholder")}
                                        rows={2}
                                        className="min-h-[44px] cursor-pointer"
                                        onFocus={() => startEditingQuestion(question.id)}
                                        readOnly
                                      />
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tp("question.emptyTitle")}</p>
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
                      <span className="font-medium">{tp("vendorPets.title")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {tp("vendorPets.intro", { name: vendorName })}
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
                      {tp("vendorPets.footer")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openAddDialogWithSuggestions}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    {tp("vendorPets.suggest")}
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
                            {tp(`mitigationStatus.${mitigation.status}` as `mitigationStatus.IDENTIFIED` | `mitigationStatus.PLANNED` | `mitigationStatus.IN_PROGRESS` | `mitigationStatus.IMPLEMENTED` | `mitigationStatus.VERIFIED` | `mitigationStatus.NOT_REQUIRED`)}
                          </Badge>
                          <Badge variant="outline">{tp("mitigations.priorityBadge", { value: mitigation.priority })}</Badge>
                          {mitigation.owner && (
                            <span className="text-xs text-muted-foreground">
                              {tp("mitigations.owner", { name: mitigation.owner })}
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
                            <strong>{tp("mitigations.evidence")}</strong> {mitigation.evidence}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUpdateDialog(mitigation)}
                      >
                        {tp("mitigations.update")}
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
                {tp("mitigations.add")}
              </Button>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tp("mitigations.empty")}</p>
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
                            {tp("approvals.level", { n: approval.level })}
                          </span>
                          <Badge variant="outline">{approval.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {tp("approvals.approver", { name: approval.approver?.name || approval.approver?.email || "" })}
                        </p>
                        {approval.comments && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {tp("approvals.comments", { value: approval.comments })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {approval.decidedAt && (
                          <span className="text-sm text-muted-foreground">
                            {new Date(approval.decidedAt).toLocaleDateString()}
                          </span>
                        )}
                        {approval.status === "PENDING" && approval.approver?.id === currentUserId && (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                processApproval.mutate({
                                  organizationId: organization?.id ?? "",
                                  approvalId: approval.id,
                                  decision: "APPROVED",
                                })
                              }
                              disabled={processApproval.isPending}
                            >
                              {processApproval.isPending ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                              )}
                              {tp("approvals.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRejectApprovalId(approval.id);
                                setRejectComments("");
                                setRejectDialogOpen(true);
                              }}
                              disabled={processApproval.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              {tp("approvals.reject")}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {assessment.status === "PENDING_REVIEW" && (
                <Button
                  variant="outline"
                  onClick={() => setApprovalDialogOpen(true)}
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  {tp("approvals.request")}
                </Button>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tp("approvals.empty")}</p>
                {assessment.status === "PENDING_REVIEW" && (
                  <Button
                    className="mt-4"
                    onClick={() => setApprovalDialogOpen(true)}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Request Approval
                  </Button>
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
                        <span className="font-medium">{tp("history.version", { n: version.version })}</span>
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
                <p>{tp("history.empty")}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Mitigation Dialog */}
      <Dialog open={addMitigationOpen} onOpenChange={setAddMitigationOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tp("addDialog.title")}</DialogTitle>
            <DialogDescription>{tp("addDialog.subtitle")}</DialogDescription>
          </DialogHeader>

          {hasSuggestions && (
            <Tabs value={addMitigationTab} onValueChange={(v) => setAddMitigationTab(v as "manual" | "suggested")}>
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1">{tp("addDialog.tabs.manual")}</TabsTrigger>
                <TabsTrigger value="suggested" className="flex-1">
                  <Lightbulb className="w-4 h-4 mr-1" />
                  {tp("addDialog.tabs.suggested")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="mt-4">
                <MitigationFormFields
                  form={mitigationForm}
                  onChange={setMitigationForm}
                  tp={tp}
                />
              </TabsContent>

              <TabsContent value="suggested" className="mt-4 space-y-4">
                {/* Vendor PET suggestions */}
                {vendorPets.length > 0 && vendorName && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      {tp("vendorPets.vendorTitle", { name: vendorName })}
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
                                  {tp("vendorPets.implements")}
                                </Badge>
                              </div>
                              {risks.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {tp("vendorPets.addresses", { risks: risks.map((r) => r.label).join(", ") })}
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
                              {tp("vendorPets.accept")}
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
                                  {tp("vendorPets.implements")}
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
                              {tp("vendorPets.accept")}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!hasSuggestions && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {tp("addDialog.noSuggestions")}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}

          {!hasSuggestions && (
            <MitigationFormFields
              form={mitigationForm}
              onChange={setMitigationForm}
              tp={tp}
            />
          )}

          {(addMitigationTab === "manual" || !hasSuggestions) && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddMitigationOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleAddMitigation}
                disabled={!mitigationForm.title || addMitigation.isPending}
              >
                {addMitigation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {tp("addDialog.submit")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("requestApproval.title")}</DialogTitle>
            <DialogDescription>{tp("requestApproval.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tp("requestApproval.approver")}</Label>
              <Select
                value={selectedApproverId}
                onValueChange={setSelectedApproverId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tp("requestApproval.selectApprover")} />
                </SelectTrigger>
                <SelectContent>
                  {((orgData as any)?.members ?? []).map((member: any) => (
                    <SelectItem key={member.user.id} value={member.user.id}>
                      {member.user.name || member.user.email} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() =>
                requestApproval.mutate({
                  organizationId: organization?.id ?? "",
                  assessmentId: id,
                  approverId: selectedApproverId,
                })
              }
              disabled={!selectedApproverId || requestApproval.isPending}
            >
              {requestApproval.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {tp("requestApproval.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Approval Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("rejectDialog.title")}</DialogTitle>
            <DialogDescription>{tp("rejectDialog.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tp("rejectDialog.commentsLabel")}</Label>
              <Textarea
                placeholder={tp("rejectDialog.commentsPlaceholder")}
                rows={3}
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                processApproval.mutate({
                  organizationId: organization?.id ?? "",
                  approvalId: rejectApprovalId,
                  decision: "REJECTED",
                  comments: rejectComments || undefined,
                })
              }
              disabled={processApproval.isPending}
            >
              {processApproval.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {tp("rejectDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Mitigation Dialog */}
      <Dialog open={updateMitigationOpen} onOpenChange={setUpdateMitigationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tp("updateMitigation.title")}</DialogTitle>
            <DialogDescription>
              {editingMitigation?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tp("updateMitigation.statusLabel")}</Label>
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
                      {tp(`mitigationStatus.${s}` as `mitigationStatus.IDENTIFIED` | `mitigationStatus.PLANNED` | `mitigationStatus.IN_PROGRESS` | `mitigationStatus.IMPLEMENTED` | `mitigationStatus.VERIFIED` | `mitigationStatus.NOT_REQUIRED`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tp("updateMitigation.ownerLabel")}</Label>
              <Input
                placeholder={tp("updateMitigation.ownerPlaceholder")}
                value={updateForm.owner}
                onChange={(e) => setUpdateForm({ ...updateForm, owner: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{tp("updateMitigation.dueDateLabel")}</Label>
              <Input
                type="date"
                value={updateForm.dueDate}
                onChange={(e) => setUpdateForm({ ...updateForm, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{tp("updateMitigation.evidenceLabel")}</Label>
              <Textarea
                placeholder={tp("updateMitigation.evidencePlaceholder")}
                rows={3}
                value={updateForm.evidence}
                onChange={(e) => setUpdateForm({ ...updateForm, evidence: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateMitigationOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleUpdateMitigation}
              disabled={updateMitigation.isPending}
            >
              {updateMitigation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {tp("updateMitigation.submit")}
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
  tp,
}: {
  form: { title: string; description: string; priority: number; owner: string; dueDate: string };
  onChange: (f: typeof form) => void;
  tp: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{tp("mitigationForm.titleLabel")}</Label>
        <Input
          placeholder={tp("mitigationForm.titlePlaceholder")}
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{tp("mitigationForm.descLabel")}</Label>
        <Textarea
          placeholder={tp("mitigationForm.descPlaceholder")}
          rows={3}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>{tp("mitigationForm.priorityLabel")}</Label>
          <Select
            value={String(form.priority)}
            onValueChange={(v) => onChange({ ...form, priority: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{tp("mitigationForm.priority1")}</SelectItem>
              <SelectItem value="2">{tp("mitigationForm.priority2")}</SelectItem>
              <SelectItem value="3">{tp("mitigationForm.priority3")}</SelectItem>
              <SelectItem value="4">{tp("mitigationForm.priority4")}</SelectItem>
              <SelectItem value="5">{tp("mitigationForm.priority5")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{tp("mitigationForm.ownerLabel")}</Label>
          <Input
            placeholder={tp("mitigationForm.ownerPlaceholder")}
            value={form.owner}
            onChange={(e) => onChange({ ...form, owner: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tp("mitigationForm.dueDateLabel")}</Label>
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

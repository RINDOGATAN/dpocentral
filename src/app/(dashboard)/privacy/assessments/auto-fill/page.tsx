"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Edit3,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";

type WizardStep = "select" | "preview" | "review" | "create";

export default function DpiaAutoFillPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [step, setStep] = useState<WizardStep>("select");
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [editedResponses, setEditedResponses] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  const orgId = organization?.id ?? "";

  // Fetch processing activities (paginated)
  const {
    data: activitiesPages,
    isLoading: activitiesLoading,
    hasNextPage: hasMoreActivities,
    fetchNextPage: fetchNextActivitiesPage,
    isFetchingNextPage: isFetchingMoreActivities,
  } = trpc.dataInventory.listActivities.useInfiniteQuery(
    { organizationId: orgId, limit: 100 },
    { enabled: !!orgId, getNextPageParam: (lastPage) => lastPage.nextCursor }
  );
  const activities = { activities: activitiesPages?.pages.flatMap((p) => p.activities) ?? [] };
  useEffect(() => {
    if (hasMoreActivities && !isFetchingMoreActivities) fetchNextActivitiesPage();
  }, [hasMoreActivities, isFetchingMoreActivities, fetchNextActivitiesPage]);

  // Fetch vendors (paginated)
  const {
    data: vendorsPages,
    hasNextPage: hasMoreVendors,
    fetchNextPage: fetchNextVendorsPage,
    isFetchingNextPage: isFetchingMoreVendors,
  } = trpc.vendor.list.useInfiniteQuery(
    { organizationId: orgId, limit: 100 },
    { enabled: !!orgId, getNextPageParam: (lastPage) => lastPage.nextCursor }
  );
  const vendors = { vendors: vendorsPages?.pages.flatMap((p) => p.vendors) ?? [] };
  useEffect(() => {
    if (hasMoreVendors && !isFetchingMoreVendors) fetchNextVendorsPage();
  }, [hasMoreVendors, isFetchingMoreVendors, fetchNextVendorsPage]);

  // Fetch auto-fill suggestions when activity is selected
  const {
    data: autoFill,
    isLoading: autoFillLoading,
    error: autoFillError,
    refetch: refetchAutoFill,
  } = trpc.assessment.generateDpiaFromActivity.useQuery(
    {
      organizationId: orgId,
      processingActivityId: selectedActivityId,
      vendorId: selectedVendorId || undefined,
    },
    { enabled: !!orgId && !!selectedActivityId && step !== "select", retry: false }
  );

  // Fetch entitled types to check DPIA access
  const { data: entitledTypes } = trpc.assessment.getEntitledTypes.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  // Fetch templates for creating assessment
  const { data: templates } = trpc.assessment.listTemplates.useQuery(
    { organizationId: orgId, type: "DPIA" },
    { enabled: !!orgId && step === "create" }
  );

  // Create assessment mutation
  const createAssessment = trpc.assessment.create.useMutation();
  const saveResponse = trpc.assessment.saveResponse.useMutation();

  const hasDpiaAccess = entitledTypes?.entitledTypes.includes("DPIA");

  const handleCreate = async () => {
    if (!autoFill || !templates || templates.length === 0) return;

    setIsCreating(true);
    try {
      const template = templates[0];
      const assessment = await createAssessment.mutateAsync({
        organizationId: orgId,
        templateId: template.id,
        name: `DPIA — ${autoFill.activityName}${autoFill.vendorName ? ` (${autoFill.vendorName})` : ""}`,
        description: "Auto-filled from processing activity data",
        processingActivityId: selectedActivityId,
        vendorId: selectedVendorId || undefined,
      });

      // Save all auto-fill responses
      let savedCount = 0;
      for (const suggestion of autoFill.suggestions) {
        try {
          const response = editedResponses[suggestion.questionId] ?? suggestion.suggestedResponse;
          await saveResponse.mutateAsync({
            organizationId: orgId,
            assessmentId: assessment.id,
            questionId: suggestion.questionId,
            sectionId: suggestion.sectionId,
            response: response,
          });
          savedCount++;
        } catch {
          // Continue saving remaining responses even if one fails
        }
      }

      if (savedCount < autoFill.suggestions.length) {
        toast.warning(`Assessment created but only ${savedCount} of ${autoFill.suggestions.length} responses were saved`);
      } else {
        toast.success("Assessment created with all responses pre-filled");
      }

      router.push(`/privacy/assessments/${assessment.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create assessment");
    } finally {
      setIsCreating(false);
    }
  };

  const confidenceColor = (c: string) => {
    switch (c) {
      case "high": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          DPIA Auto-Fill Wizard
        </h1>
        <p className="text-muted-foreground">
          Auto-generate a DPIA from your existing data inventory
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["select", "preview", "review", "create"] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            <span
              className={`px-3 py-1 rounded-full ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {!hasDpiaAccess && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium">DPIA requires a premium license</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The auto-fill wizard will generate a Legitimate Interests Assessment (LIA) instead.
                  Upgrade to access full DPIA templates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Select Activity */}
      {step === "select" && (
        <Card>
          <CardHeader>
            <CardTitle>Select Processing Activity</CardTitle>
            <CardDescription>
              Choose a processing activity to auto-fill the assessment from
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Processing Activity</label>
              <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a processing activity..." />
                </SelectTrigger>
                <SelectContent>
                  {activitiesLoading && (
                    <SelectItem value="_loading" disabled>Loading...</SelectItem>
                  )}
                  {activities?.activities?.map((a: { id: string; name: string }) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Linked Vendor (optional)</label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {vendors?.vendors?.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                disabled={!selectedActivityId}
                onClick={() => setStep("preview")}
              >
                Preview Auto-Fill <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Auto-Fill Preview</CardTitle>
            <CardDescription>
              Review the data that will be used to pre-fill your assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {autoFillLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2">Analyzing processing activity...</span>
              </div>
            ) : autoFillError ? (
              <div className="py-8 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
                <p className="font-medium">Could not generate auto-fill suggestions</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {autoFillError.message || "Something went wrong analyzing this processing activity."}
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <Button variant="outline" onClick={() => setStep("select")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button variant="outline" onClick={() => refetchAutoFill()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : autoFill ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{autoFill.context.assetCount}</div>
                    <div className="text-xs text-muted-foreground">Assets</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{autoFill.context.elementCount}</div>
                    <div className="text-xs text-muted-foreground">Data Elements</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{autoFill.context.transferCount}</div>
                    <div className="text-xs text-muted-foreground">Transfers</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{autoFill.suggestions.length}</div>
                    <div className="text-xs text-muted-foreground">Auto-Filled</div>
                  </div>
                </div>

                {autoFill.context.hasSpecialCategory && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm">Special category data detected — DPIA strongly recommended</span>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep("select")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button onClick={() => setStep("review")}>
                    Review Responses <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Edit */}
      {step === "review" && autoFill && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Review & Edit Responses
              </CardTitle>
              <CardDescription>
                Edit any auto-filled responses before creating the assessment
              </CardDescription>
            </CardHeader>
          </Card>

          {autoFill.suggestions.map((s) => (
            <Card key={s.questionId}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {s.questionId.replace(/_/g, " ").replace(/^s\d+ /, "")}
                  </CardTitle>
                  <Badge className={confidenceColor(s.confidence)}>
                    {s.confidence} confidence
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Source: {s.source}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editedResponses[s.questionId] ?? s.suggestedResponse}
                  onChange={(e) =>
                    setEditedResponses((prev) => ({
                      ...prev,
                      [s.questionId]: e.target.value,
                    }))
                  }
                  rows={3}
                  className="text-sm"
                />
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep("preview")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={() => setStep("create")}>
              Create Assessment <CheckCircle2 className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Create */}
      {step === "create" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Create Assessment
            </CardTitle>
            <CardDescription>
              A draft {hasDpiaAccess ? "DPIA" : "LIA"} will be created with {autoFill?.suggestions.length ?? 0} pre-filled responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Activity:</span>
                  <span className="font-medium">{autoFill?.activityName}</span>
                </div>
                {autoFill?.vendorName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendor:</span>
                    <span className="font-medium">{autoFill.vendorName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pre-filled questions:</span>
                  <span className="font-medium">{autoFill?.suggestions.length ?? 0}</span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("review")}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating & saving responses...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Create & Open Assessment</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ExpertHelpCta context="assessment" />
    </div>
  );
}

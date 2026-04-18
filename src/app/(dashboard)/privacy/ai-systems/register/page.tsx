"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

type Step = "basics" | "classification" | "compliance" | "review";

export default function RegisterAISystemPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const t = useTranslations("toasts");
  const [step, setStep] = useState<Step>("basics");

  const [form, setForm] = useState({
    name: "",
    description: "",
    purpose: "",
    category: "",
    provider: "",
    deployer: "",
    modelType: "",
    vendorId: "",
    riskLevel: "MINIMAL" as "UNACCEPTABLE" | "HIGH_RISK" | "LIMITED" | "MINIMAL",
    trainingDataSources: [] as string[],
    humanOversight: "",
    transparencyMeasures: "",
    technicalDocUrl: "",
  });

  const [trainingInput, setTrainingInput] = useState("");

  // Fetch vendors for linking (paginated — auto-loads all pages)
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

  // Risk suggestion
  const { data: riskSuggestion } = trpc.aiGovernance.suggestRiskLevel.useQuery(
    { organizationId: orgId, purpose: form.purpose, category: form.category },
    { enabled: !!orgId && form.purpose.length > 10 && step === "classification" }
  );

  const createMutation = trpc.aiGovernance.create.useMutation({
    onSuccess: (data) => {
      toast.success(t("aiSystem.registered"));
      router.push(`/privacy/ai-systems/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      organizationId: orgId,
      ...form,
      vendorId: form.vendorId || undefined,
    });
  };

  const addTrainingSource = () => {
    if (trainingInput.trim()) {
      setForm((prev) => ({
        ...prev,
        trainingDataSources: [...prev.trainingDataSources, trainingInput.trim()],
      }));
      setTrainingInput("");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Register AI System
        </h1>
        <p className="text-muted-foreground">
          Register and classify an AI system per the EU AI Act
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["basics", "classification", "compliance", "review"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            <span
              className={`px-3 py-1 rounded-full ${
                step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === "basics" && (
        <Card>
          <CardHeader>
            <CardTitle>System Details</CardTitle>
            <CardDescription>Basic information about the AI system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>System Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Customer Support Chatbot"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of the AI system..."
                rows={3}
              />
            </div>
            <div>
              <Label>Purpose *</Label>
              <Textarea
                value={form.purpose}
                onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="What is this AI system used for?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Provider</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                  placeholder="e.g., OpenAI"
                />
              </div>
              <div>
                <Label>Model Type</Label>
                <Input
                  value={form.modelType}
                  onChange={(e) => setForm((p) => ({ ...p, modelType: e.target.value }))}
                  placeholder="e.g., LLM, Computer Vision"
                />
              </div>
            </div>
            <div>
              <Label>Linked Vendor</Label>
              <Select value={form.vendorId || "__none__"} onValueChange={(v) => setForm((p) => ({ ...p, vendorId: v === "__none__" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Link to existing vendor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {vendors?.vendors?.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end pt-4">
              <Button disabled={!form.name || !form.purpose} onClick={() => setStep("classification")}>
                Next: Classification <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Classification */}
      {step === "classification" && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Classification</CardTitle>
            <CardDescription>Classify the AI system by EU AI Act risk level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {riskSuggestion && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Suggested risk level: </span>
                  <Badge className="ml-1">{riskSuggestion.riskLevel.replace("_", " ")}</Badge>
                  <span className="text-muted-foreground ml-2">
                    ({riskSuggestion.confidence} confidence)
                  </span>
                  {riskSuggestion.matchedUseCase && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Matched: {riskSuggestion.matchedUseCase}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="e.g., Customer Service, HR Recruitment, Healthcare"
              />
            </div>
            <div>
              <Label>Risk Level *</Label>
              <Select
                value={form.riskLevel}
                onValueChange={(v) => setForm((p) => ({ ...p, riskLevel: v as typeof form.riskLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNACCEPTABLE">Unacceptable - Prohibited</SelectItem>
                  <SelectItem value="HIGH_RISK">High Risk - Strict obligations</SelectItem>
                  <SelectItem value="LIMITED">Limited - Transparency obligations</SelectItem>
                  <SelectItem value="MINIMAL">Minimal - No specific obligations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.riskLevel === "UNACCEPTABLE" && (
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  Unacceptable risk AI systems are prohibited under the EU AI Act.
                  If this system falls into this category, it must be decommissioned.
                </p>
              </div>
            )}

            <div>
              <Label>Deployer / Operator</Label>
              <Input
                value={form.deployer}
                onChange={(e) => setForm((p) => ({ ...p, deployer: e.target.value }))}
                placeholder="Who deploys/operates this system?"
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("basics")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep("compliance")}>
                Next: Compliance <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Compliance */}
      {step === "compliance" && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Details</CardTitle>
            <CardDescription>Document oversight and transparency measures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Training Data Sources</Label>
              <div className="flex gap-2">
                <Input
                  value={trainingInput}
                  onChange={(e) => setTrainingInput(e.target.value)}
                  placeholder="Add a training data source..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTrainingSource())}
                />
                <Button variant="outline" onClick={addTrainingSource}>Add</Button>
              </div>
              {form.trainingDataSources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.trainingDataSources.map((s, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() =>
                      setForm((p) => ({
                        ...p,
                        trainingDataSources: p.trainingDataSources.filter((_, idx) => idx !== i),
                      }))
                    }>
                      {s} &times;
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Human Oversight Measures</Label>
              <Textarea
                value={form.humanOversight}
                onChange={(e) => setForm((p) => ({ ...p, humanOversight: e.target.value }))}
                placeholder="Describe human oversight mechanisms..."
                rows={3}
              />
            </div>
            <div>
              <Label>Transparency Measures</Label>
              <Textarea
                value={form.transparencyMeasures}
                onChange={(e) => setForm((p) => ({ ...p, transparencyMeasures: e.target.value }))}
                placeholder="How are users informed they're interacting with AI?"
                rows={3}
              />
            </div>
            <div>
              <Label>Technical Documentation URL</Label>
              <Input
                value={form.technicalDocUrl}
                onChange={(e) => setForm((p) => ({ ...p, technicalDocUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("classification")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep("review")}>
                Review <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Create */}
      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Register</CardTitle>
            <CardDescription>Confirm the AI system details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{form.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Risk Level</span>
                <Badge>{form.riskLevel.replace("_", " ")}</Badge>
              </div>
              {form.category && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Category</span>
                  <span>{form.category}</span>
                </div>
              )}
              {form.provider && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Provider</span>
                  <span>{form.provider}</span>
                </div>
              )}
              {form.modelType && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Model Type</span>
                  <span>{form.modelType}</span>
                </div>
              )}
              {form.trainingDataSources.length > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Training Sources</span>
                  <span>{form.trainingDataSources.length}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("compliance")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registering...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Register AI System</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

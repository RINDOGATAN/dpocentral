"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, ClipboardCheck, FileText, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { AccessRequiredDialog } from "@/components/ui/access-required-dialog";

// Premium assessment types that require entitlements
const PREMIUM_TYPES = ["DPIA", "PIA", "TIA", "VENDOR"];

const typeLabels: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment",
  PIA: "Privacy Impact Assessment",
  TIA: "Transfer Impact Assessment",
  LIA: "Legitimate Interest Assessment",
  VENDOR: "Vendor Risk Assessment",
  CUSTOM: "Custom Assessment",
};

export default function NewAssessmentPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [accessRequiredOpen, setAccessRequiredOpen] = useState(false);
  const [accessRequiredFeature, setAccessRequiredFeature] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    processingActivityId: "",
    vendorId: "",
  });

  const utils = trpc.useUtils();

  const { data: templates, isLoading: templatesLoading } = trpc.assessment.listTemplates.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  // Query entitled assessment types
  const { data: entitledData } = trpc.assessment.getEntitledTypes.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const entitledTypes = entitledData?.entitledTypes ?? [];

  const { data: activitiesData } = trpc.dataInventory.listActivities.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: vendorsData } = trpc.vendor.list.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const activities = activitiesData?.activities ?? [];
  const vendors = vendorsData?.vendors ?? [];
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  const createAssessment = trpc.assessment.create.useMutation({
    onSuccess: (data) => {
      utils.assessment.list.invalidate();
      router.push(`/privacy/assessments/${data.id}`);
    },
    onError: (error) => {
      console.error("Failed to create assessment:", error);
      setIsSubmitting(false);

      // Handle FORBIDDEN error for premium features
      if (error.data?.code === "FORBIDDEN") {
        const templateType = selectedTemplate?.type || "Assessment";
        setAccessRequiredFeature(typeLabels[templateType] || templateType);
        setAccessRequiredOpen(true);
      }
    },
  });

  // Helper to check if a template type is entitled
  const isTypeEntitled = (type: string) => entitledTypes.includes(type as any);
  const isPremiumType = (type: string) => PREMIUM_TYPES.includes(type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name || !selectedTemplateId) return;

    setIsSubmitting(true);

    createAssessment.mutate({
      organizationId: organization.id,
      templateId: selectedTemplateId,
      name: formData.name,
      description: formData.description || undefined,
      processingActivityId: formData.processingActivityId || undefined,
      vendorId: formData.vendorId || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/assessments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">New Assessment</h1>
          <p className="text-muted-foreground">
            Start a new privacy impact assessment
          </p>
        </div>
      </div>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Template</CardTitle>
          <CardDescription>
            Choose an assessment template to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const isPremium = isPremiumType(template.type);
                const isEntitled = isTypeEntitled(template.type);
                const isLocked = isPremium && !isEntitled;

                return (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTemplateId === template.id
                        ? "border-primary bg-primary/5"
                        : isLocked
                        ? "border-dashed opacity-75 hover:border-amber-500/50"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className={`w-10 h-10 border-2 flex items-center justify-center ${
                          isLocked ? "border-amber-500" : "border-primary"
                        }`}>
                          {isLocked ? (
                            <Lock className="w-5 h-5 text-amber-500" />
                          ) : (
                            <ClipboardCheck className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          <Badge variant="outline">{template.type}</Badge>
                          {isPremium && (
                            <Badge variant={isEntitled ? "default" : "secondary"} className={!isEntitled ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : ""}>
                              {isEntitled ? "Licensed" : "Premium"}
                            </Badge>
                          )}
                          {template.isSystem && (
                            <Badge variant="secondary">System</Badge>
                          )}
                        </div>
                      </div>
                      <h4 className="font-medium mt-3">{template.name}</h4>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {(template.sections as any[])?.length || 0} sections
                      </p>
                      {isLocked && (
                        <p className="text-xs text-amber-600 mt-2 font-medium">
                          Contact North End Law to enable
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No templates available</p>
              <p className="text-sm">Create a template first or seed the database with system templates</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Details */}
      {selectedTemplateId && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assessment Details</CardTitle>
              <CardDescription>
                Using template: {selectedTemplate?.name} ({typeLabels[selectedTemplate?.type ?? ""] || selectedTemplate?.type})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Assessment Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Customer Analytics Platform DPIA"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of what this assessment covers..."
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="processingActivity">Link to Processing Activity</Label>
                  <Select
                    value={formData.processingActivityId}
                    onValueChange={(value) => setFormData({ ...formData, processingActivityId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select activity (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {activities.map((activity) => (
                        <SelectItem key={activity.id} value={activity.id}>
                          {activity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTemplate?.type === "VENDOR" && (
                  <div className="space-y-2">
                    <Label htmlFor="vendor">Link to Vendor</Label>
                    <Select
                      value={formData.vendorId}
                      onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {createAssessment.error && (
            <div className="text-sm text-destructive">
              Error: {createAssessment.error.message}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Link href="/privacy/assessments">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting || !formData.name || !selectedTemplateId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Start Assessment"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Access Required Dialog */}
      <AccessRequiredDialog
        open={accessRequiredOpen}
        onClose={() => setAccessRequiredOpen(false)}
        featureName={accessRequiredFeature}
      />
    </div>
  );
}

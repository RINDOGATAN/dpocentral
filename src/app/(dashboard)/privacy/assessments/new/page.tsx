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
import {
  ArrowLeft,
  Loader2,
  ClipboardCheck,
  Lock,
  Scale,
  FileText,
  ShieldCheck,
  ArrowRightLeft,
  Building2,
  Settings2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { AccessRequiredDialog } from "@/components/ui/access-required-dialog";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { SKILL_PACKAGE_IDS, SKILL_DISPLAY_NAMES } from "@/config/skill-packages";
import { features } from "@/config/features";

// Premium assessment types that require entitlements
const PREMIUM_TYPES = ["DPIA", "PIA", "TIA", "VENDOR"];

const ASSESSMENT_TYPES = [
  {
    type: "LIA",
    name: "Legitimate Interest Assessment",
    shortName: "LIA",
    description: "Balance legitimate interests against data subject rights under GDPR Article 6(1)(f).",
    icon: Scale,
    premium: false,
  },
  {
    type: "CUSTOM",
    name: "Custom Assessment",
    shortName: "Custom",
    description: "Flexible assessment template for custom privacy reviews and evaluations.",
    icon: Settings2,
    premium: false,
  },
  {
    type: "DPIA",
    name: "Data Protection Impact Assessment",
    shortName: "DPIA",
    description: "Comprehensive assessment for high-risk processing activities under GDPR Article 35.",
    icon: ShieldCheck,
    premium: true,
  },
  {
    type: "PIA",
    name: "Privacy Impact Assessment",
    shortName: "PIA",
    description: "Evaluate privacy risks and impacts of projects, systems, or processes.",
    icon: ClipboardCheck,
    premium: true,
  },
  {
    type: "TIA",
    name: "Transfer Impact Assessment",
    shortName: "TIA",
    description: "Assess risks of international data transfers and supplementary measures needed.",
    icon: ArrowRightLeft,
    premium: true,
  },
  {
    type: "VENDOR",
    name: "Vendor Risk Assessment",
    shortName: "Vendor",
    description: "Evaluate privacy and security risks associated with third-party vendors.",
    icon: Building2,
    premium: true,
  },
];

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
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [accessRequiredOpen, setAccessRequiredOpen] = useState(false);
  const [accessRequiredFeature, setAccessRequiredFeature] = useState("");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeSkillKey, setUpgradeSkillKey] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    processingActivityId: "",
    vendorId: "",
  });

  const utils = trpc.useUtils();

  // Query entitled assessment types
  const { data: entitledData } = trpc.assessment.getEntitledTypes.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const entitledTypes = entitledData?.entitledTypes ?? [];

  // Load templates filtered by selected type
  const { data: templates, isLoading: templatesLoading } = trpc.assessment.listTemplates.useQuery(
    { organizationId: organization?.id ?? "", type: selectedType as any },
    { enabled: !!organization?.id && !!selectedType }
  );

  const { data: activitiesData } = trpc.dataInventory.listActivities.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && !!selectedType }
  );

  const { data: vendorsData } = trpc.vendor.list.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && selectedType === "VENDOR" }
  );

  const activities = activitiesData?.activities ?? [];
  const vendors = vendorsData?.vendors ?? [];

  // Auto-select template when templates load for selected type
  const effectiveTemplateId = (() => {
    if (selectedTemplateId) return selectedTemplateId;
    if (templates && templates.length === 1) return templates[0].id;
    return "";
  })();

  const selectedTemplate = templates?.find((t) => t.id === effectiveTemplateId);

  const createAssessment = trpc.assessment.create.useMutation({
    onSuccess: (data) => {
      utils.assessment.list.invalidate();
      router.push(`/privacy/assessments/${data.id}`);
    },
    onError: (error) => {
      console.error("Failed to create assessment:", error);
      setIsSubmitting(false);

      if (error.data?.code === "FORBIDDEN") {
        setAccessRequiredFeature(typeLabels[selectedType ?? ""] || "Assessment");
        setAccessRequiredOpen(true);
      }
    },
  });

  const isTypeEntitled = (type: string) => entitledTypes.includes(type as any);
  const isPremiumType = (type: string) => PREMIUM_TYPES.includes(type);

  const handleTypeSelect = (type: string) => {
    const isPremium = isPremiumType(type);
    const isEntitled = isTypeEntitled(type);

    if (isPremium && !isEntitled) {
      setAccessRequiredFeature(typeLabels[type] || type);
      setUpgradeSkillKey(type);
      setAccessRequiredOpen(true);
      return;
    }

    setSelectedType(type);
    setSelectedTemplateId("");
    setFormData({ name: "", description: "", processingActivityId: "", vendorId: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name || !effectiveTemplateId) return;

    setIsSubmitting(true);

    createAssessment.mutate({
      organizationId: organization.id,
      templateId: effectiveTemplateId,
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
            {selectedType
              ? `Creating ${typeLabels[selectedType] || selectedType}`
              : "Choose an assessment type to get started"}
          </p>
        </div>
      </div>

      {/* Step 1: Type Selection */}
      {!selectedType && (
        <Card>
          <CardHeader>
            <CardTitle>Select Assessment Type</CardTitle>
            <CardDescription>
              Choose the type of assessment you need to perform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ASSESSMENT_TYPES.map((at) => {
                const Icon = at.icon;
                const isPremium = at.premium;
                const isEntitled = isTypeEntitled(at.type);
                const isLocked = isPremium && !isEntitled;

                return (
                  <Card
                    key={at.type}
                    className={`cursor-pointer transition-all ${
                      isLocked
                        ? "border-dashed opacity-75 hover:border-amber-500/50"
                        : "hover:border-primary/50 hover:shadow-md"
                    }`}
                    onClick={() => handleTypeSelect(at.type)}
                  >
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center ${
                            isLocked
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-primary bg-primary/10"
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Icon className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {isPremium ? (
                            isEntitled ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 hover:bg-green-100 text-xs"
                              >
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs"
                              >
                                €9/mo
                              </Badge>
                            )
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-800 hover:bg-green-100 text-xs"
                            >
                              Included
                            </Badge>
                          )}
                        </div>
                      </div>
                      <h4 className="font-medium">{at.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {at.description}
                      </p>
                      {isLocked && (
                        <p className="text-xs text-amber-600 mt-2 font-medium">
                          {features.selfServiceUpgrade ? "Click to enable" : "Contact TODO.LAW to enable"}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Template picker (only if multiple templates for this type) */}
      {selectedType && templates && templates.length > 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Template</CardTitle>
                <CardDescription>
                  Multiple templates available for {typeLabels[selectedType]}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                Change type
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-colors ${
                    effectiveTemplateId === template.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                      {template.isSystem && (
                        <Badge variant="secondary" className="text-xs">System</Badge>
                      )}
                    </div>
                    <h4 className="font-medium mt-2">{template.name}</h4>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {(template.sections as any[])?.length || 0} sections
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading templates */}
      {selectedType && templatesLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* No templates found */}
      {selectedType && !templatesLoading && templates && templates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="font-medium">No templates available</p>
            <p className="text-sm text-muted-foreground mt-1">
              No template found for {typeLabels[selectedType]}. Run the template seed script or create a template first.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setSelectedType(null)}>
              Choose a different type
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Assessment Details Form */}
      {selectedType && effectiveTemplateId && !templatesLoading && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Assessment Details</CardTitle>
                  <CardDescription>
                    {selectedTemplate
                      ? `Using template: ${selectedTemplate.name}`
                      : `Creating ${typeLabels[selectedType]}`}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                  Change type
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Assessment Name *</Label>
                <Input
                  id="name"
                  placeholder={`e.g., ${typeLabels[selectedType]} - Q1 2026`}
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

                {selectedType === "VENDOR" && (
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
            <Button type="submit" disabled={isSubmitting || !formData.name || !effectiveTemplateId}>
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
        onUpgrade={() => {
          setAccessRequiredOpen(false);
          setUpgradeModalOpen(true);
        }}
      />

      {/* Enable Feature Modal */}
      <EnableFeatureModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        organizationId={organization?.id ?? ""}
        skillPackageId={SKILL_PACKAGE_IDS[upgradeSkillKey] ?? ""}
        skillName={SKILL_DISPLAY_NAMES[upgradeSkillKey] ?? accessRequiredFeature}
      />
    </div>
  );
}

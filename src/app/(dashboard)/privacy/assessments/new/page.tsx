"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { SKILL_PACKAGE_IDS, SKILL_DISPLAY_NAMES, COMING_SOON_SKILL_IDS } from "@/config/skill-packages";
import { features } from "@/config/features";
import { brand } from "@/config/brand";
import { formatPrice } from "@/lib/currency";

// Premium assessment types that require entitlements
const PREMIUM_TYPES = ["DPIA", "PIA", "TIA", "VENDOR"];

const ASSESSMENT_TYPES: Array<{
  type: "LIA" | "CUSTOM" | "DPIA" | "PIA" | "TIA" | "VENDOR";
  icon: typeof Scale;
  premium: boolean;
}> = [
  { type: "LIA", icon: Scale, premium: false },
  { type: "CUSTOM", icon: Settings2, premium: false },
  { type: "DPIA", icon: ShieldCheck, premium: true },
  { type: "PIA", icon: ClipboardCheck, premium: true },
  { type: "TIA", icon: ArrowRightLeft, premium: true },
  { type: "VENDOR", icon: Building2, premium: true },
];

export default function NewAssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newAssessment");
  const tCommon = useTranslations("common");
  const typeName = (type: string | null | undefined) =>
    type
      ? tp(`type.${type}` as `type.LIA` | `type.CUSTOM` | `type.DPIA` | `type.PIA` | `type.TIA` | `type.VENDOR`)
      : tp("fallbackName");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(
    searchParams.get("type")
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeSkillKey, setUpgradeSkillKey] = useState("");
  const [upgradeFeatureName, setUpgradeFeatureName] = useState("");

  const [formData, setFormData] = useState(() => {
    const prefillVendorId = searchParams.get("vendorId") ?? "";
    const prefillVendorName = searchParams.get("vendorName") ?? "";
    return {
      name: prefillVendorName ? `Assessment: ${prefillVendorName}` : "",
      description: "",
      processingActivityId: "",
      vendorId: prefillVendorId,
    };
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

  const {
    data: activitiesPages,
    hasNextPage: hasMoreActivities,
    fetchNextPage: fetchNextActivitiesPage,
    isFetchingNextPage: isFetchingMoreActivities,
  } = trpc.dataInventory.listActivities.useInfiniteQuery(
    { organizationId: organization?.id ?? "", limit: 100 },
    {
      enabled: !!organization?.id && !!selectedType,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  useEffect(() => {
    if (hasMoreActivities && !isFetchingMoreActivities) fetchNextActivitiesPage();
  }, [hasMoreActivities, isFetchingMoreActivities, fetchNextActivitiesPage]);
  const activities = activitiesPages?.pages.flatMap((p) => p.activities) ?? [];

  const {
    data: vendorsPages,
    hasNextPage: hasMoreVendors,
    fetchNextPage: fetchNextVendorsPage,
    isFetchingNextPage: isFetchingMoreVendors,
  } = trpc.vendor.list.useInfiniteQuery(
    { organizationId: organization?.id ?? "", limit: 100 },
    {
      enabled: !!organization?.id && !!selectedType && ["VENDOR", "DPIA", "PIA", "TIA"].includes(selectedType),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  useEffect(() => {
    if (hasMoreVendors && !isFetchingMoreVendors) fetchNextVendorsPage();
  }, [hasMoreVendors, isFetchingMoreVendors, fetchNextVendorsPage]);
  const vendors = vendorsPages?.pages.flatMap((p) => p.vendors) ?? [];

  // Auto-select template when templates load for selected type
  const effectiveTemplateId = (() => {
    if (selectedTemplateId) return selectedTemplateId;
    if (templates && templates.length === 1) return templates[0].id;
    return "";
  })();

  const selectedTemplate = templates?.find((t) => t.id === effectiveTemplateId);

  const createAssessment = trpc.assessment.create.useMutation({
    onSuccess: (data) => {
      toast.success(t("assessment.created"));
      utils.assessment.list.invalidate();
      router.push(`/privacy/assessments/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);

      if (error.data?.code === "FORBIDDEN") {
        setUpgradeFeatureName(typeName(selectedType));
        setUpgradeSkillKey(selectedType ?? "");
        setUpgradeModalOpen(true);
      }
    },
  });

  const isTypeEntitled = (type: string) => entitledTypes.includes(type as any);
  const isPremiumType = (type: string) => PREMIUM_TYPES.includes(type);
  const isComingSoon = (type: string) => COMING_SOON_SKILL_IDS.has(SKILL_PACKAGE_IDS[type] ?? "");

  const handleTypeSelect = (type: string) => {
    if (isComingSoon(type)) return;

    const isPremium = isPremiumType(type);
    const isEntitled = isTypeEntitled(type);

    if (isPremium && !isEntitled) {
      setUpgradeFeatureName(typeName(type));
      setUpgradeSkillKey(type);
      setUpgradeModalOpen(true);
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
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tp("title")}</h1>
          <p className="text-muted-foreground">
            {selectedType
              ? tp("subtitleCreating", { name: typeName(selectedType) })
              : tp("subtitleChoose")}
          </p>
        </div>
      </div>

      {/* Step 1: Type Selection */}
      {!selectedType && (
        <Card>
          <CardHeader>
            <CardTitle>{tp("selectType")}</CardTitle>
            <CardDescription>{tp("selectTypeSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ASSESSMENT_TYPES.map((at) => {
                const Icon = at.icon;
                const isPremium = at.premium;
                const isEntitled = isTypeEntitled(at.type);
                const comingSoon = isComingSoon(at.type);
                const isLocked = isPremium && !isEntitled && !comingSoon;

                return (
                  <Card
                    key={at.type}
                    className={`transition-all ${
                      comingSoon
                        ? "border-dashed opacity-60 cursor-default"
                        : isLocked
                          ? "cursor-pointer border-dashed opacity-75 hover:border-amber-500/50"
                          : "cursor-pointer hover:border-primary/50 hover:shadow-md"
                    }`}
                    onClick={() => handleTypeSelect(at.type)}
                  >
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center ${
                            comingSoon
                              ? "border-muted-foreground/30 bg-muted"
                              : isLocked
                                ? "border-amber-500 bg-amber-500/10"
                                : "border-primary bg-primary/10"
                          }`}
                        >
                          {comingSoon || isLocked ? (
                            <Lock className={`w-5 h-5 ${comingSoon ? "text-muted-foreground/50" : "text-amber-500"}`} />
                          ) : (
                            <Icon className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {comingSoon ? (
                            <Badge
                              variant="secondary"
                              className="bg-muted text-muted-foreground text-xs"
                            >
                              {tp("comingSoon")}
                            </Badge>
                          ) : isPremium ? (
                            isEntitled ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 hover:bg-green-100 text-xs"
                              >
                                {tp("active")}
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs"
                              >
                                {formatPrice(9)}{tp("perMonth")}
                              </Badge>
                            )
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-800 hover:bg-green-100 text-xs"
                            >
                              {tp("included")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <h4 className="font-medium">{tp(`type.${at.type}` as `type.LIA` | `type.CUSTOM` | `type.DPIA` | `type.PIA` | `type.TIA` | `type.VENDOR`)}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {tp(`type.${at.type}_desc` as `type.LIA_desc` | `type.CUSTOM_desc` | `type.DPIA_desc` | `type.PIA_desc` | `type.TIA_desc` | `type.VENDOR_desc`)}
                      </p>
                      {isLocked && (
                        <p className="text-xs text-amber-600 mt-2 font-medium">
                          {features.selfServiceUpgrade ? tp("clickToEnable") : tp("contactToEnable", { name: brand.companyName })}
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
                <CardTitle>{tp("selectTemplate")}</CardTitle>
                <CardDescription>
                  {tp("selectTemplateSubtitle", { name: typeName(selectedType) })}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                {tp("changeType")}
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
                        <Badge variant="secondary" className="text-xs">{tp("system")}</Badge>
                      )}
                    </div>
                    <h4 className="font-medium mt-2">{template.name}</h4>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {tp("sectionsCount", { count: (template.sections as any[])?.length || 0 })}
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
            <p className="font-medium">{tp("noTemplatesTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {tp("noTemplatesBody", { name: typeName(selectedType) })}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setSelectedType(null)}>
              {tp("chooseDifferent")}
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
                  <CardTitle>{tp("details")}</CardTitle>
                  <CardDescription>
                    {selectedTemplate
                      ? tp("usingTemplate", { name: selectedTemplate.name })
                      : tp("subtitleCreating", { name: typeName(selectedType) })}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                  {tp("changeType")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{tp("name")}</Label>
                <Input
                  id="name"
                  placeholder={tp("namePlaceholder", { type: typeName(selectedType) })}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{tp("description")}</Label>
                <Textarea
                  id="description"
                  placeholder={tp("descriptionPlaceholder")}
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="processingActivity">{tp("linkActivity")}</Label>
                  <Select
                    value={formData.processingActivityId}
                    onValueChange={(value) => setFormData({ ...formData, processingActivityId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tp("selectActivity")} />
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

                {selectedType && ["VENDOR", "DPIA", "PIA", "TIA"].includes(selectedType) && (
                  <div className="space-y-2">
                    <Label htmlFor="vendor">
                      {selectedType === "VENDOR" ? tp("linkVendor") : tp("linkVendorOptional")}
                    </Label>
                    <Select
                      value={formData.vendorId}
                      onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tp("selectVendor")} />
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
              {tp("errorPrefix", { message: createAssessment.error.message })}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Link href="/privacy/assessments">
              <Button variant="outline" type="button">{tCommon("cancel")}</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting || !formData.name || !effectiveTemplateId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {tp("creating")}
                </>
              ) : (
                tp("submit")
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Enable Feature Modal */}
      <EnableFeatureModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        organizationId={organization?.id ?? ""}
        skillPackageId={SKILL_PACKAGE_IDS[upgradeSkillKey] ?? ""}
        skillName={SKILL_DISPLAY_NAMES[upgradeSkillKey] ?? upgradeFeatureName}
      />
    </div>
  );
}

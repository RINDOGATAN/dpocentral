"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, Suspense } from "react";
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
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const VENDOR_CATEGORY_KEYS = [
  "CLOUD_SERVICES", "DATA_PROCESSING", "ANALYTICS", "MARKETING", "HR_SERVICES",
  "PAYMENT_PROCESSING", "CUSTOMER_SUPPORT", "IT_SECURITY", "LEGAL", "OTHER",
] as const;

const RISK_TIER_KEYS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const DATA_CATEGORY_KEYS = [
  "IDENTIFIERS", "DEMOGRAPHICS", "FINANCIAL", "HEALTH",
  "LOCATION", "BEHAVIORAL", "EMPLOYMENT",
] as const;

function NewVendorPageContent() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newVendor");
  const tCommon = useTranslations("common");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website: "",
    contactName: "",
    contactEmail: "",
    categories: [] as string[],
    dataProcessed: [] as string[],
    countries: [] as string[],
    riskTier: "",
    // Links to the vendor's own documents
    privacyPolicyUrl: "",
    trustCenterUrl: "",
    dpaUrl: "",
    certifications: [] as string[],
    status: "PROSPECTIVE" as "ACTIVE" | "PROSPECTIVE",
    processingActivityId: "",
  });

  const [newCountry, setNewCountry] = useState("");

  // The organisation's processing activities, for "Used by which activity?".
  const { data: activityList } = trpc.dataInventory.listActivities.useQuery(
    { organizationId: organization?.id ?? "", isActive: true, limit: 200 },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: () => {
      toast.success(t("vendor.created"));
      utils.vendor.list.invalidate();
      router.push("/privacy/vendors");
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name) return;

    setIsSubmitting(true);

    const metadata: Record<string, unknown> = {};
    if (formData.privacyPolicyUrl) metadata.privacyPolicyUrl = formData.privacyPolicyUrl;
    if (formData.dpaUrl) metadata.dpaUrl = formData.dpaUrl;
    if (formData.trustCenterUrl) metadata.trustCenterUrl = formData.trustCenterUrl;

    createVendor.mutate({
      organizationId: organization.id,
      name: formData.name,
      description: formData.description || undefined,
      website: formData.website || undefined,
      primaryContact: formData.contactName || undefined,
      contactEmail: formData.contactEmail || undefined,
      categories: formData.categories,
      dataProcessed: formData.dataProcessed as any[],
      countries: formData.countries,
      certifications: formData.certifications,
      riskTier: (formData.riskTier || undefined) as any,
      status: formData.status,
      ...(formData.processingActivityId ? { processingActivityId: formData.processingActivityId } : {}),
      ...(Object.keys(metadata).length ? { metadata } : {}),
    });
  };

  const toggleCategory = (value: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.includes(value)
        ? formData.categories.filter((c) => c !== value)
        : [...formData.categories, value],
    });
  };

  const toggleDataProcessed = (value: string) => {
    setFormData({
      ...formData,
      dataProcessed: formData.dataProcessed.includes(value)
        ? formData.dataProcessed.filter((d) => d !== value)
        : [...formData.dataProcessed, value],
    });
  };

  const addCountry = () => {
    if (newCountry && !formData.countries.includes(newCountry)) {
      setFormData({ ...formData, countries: [...formData.countries, newCountry] });
      setNewCountry("");
    }
  };

  const removeCountry = (country: string) => {
    setFormData({ ...formData, countries: formData.countries.filter((c) => c !== country) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/vendors">
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            {tp("title")}
          </h1>
          <p className="text-muted-foreground">
            {tp("subtitle")}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{tp("info.title")}</CardTitle>
            <CardDescription>{tp("info.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{tp("info.name")}</Label>
                <Input
                  id="name"
                  placeholder={tp("info.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">{tp("info.website")}</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder={tp("info.websitePlaceholder")}
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{tp("info.description")}</Label>
              <Textarea
                id="description"
                placeholder={tp("info.descriptionPlaceholder")}
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactName">{tp("info.contactName")}</Label>
                <Input
                  id="contactName"
                  placeholder={tp("info.contactNamePlaceholder")}
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">{tp("info.contactEmail")}</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder={tp("info.contactEmailPlaceholder")}
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tp("categoriesRisk.title")}</CardTitle>
            <CardDescription>{tp("categoriesRisk.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tp("categoriesRisk.serviceCategories")}</Label>
              <div className="flex flex-wrap gap-2">
                {VENDOR_CATEGORY_KEYS.map((value) => (
                  <Badge
                    key={value}
                    variant={formData.categories.includes(value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(value)}
                  >
                    {tp(`category.${value}` as `category.CLOUD_SERVICES` | `category.DATA_PROCESSING` | `category.ANALYTICS` | `category.MARKETING` | `category.HR_SERVICES` | `category.PAYMENT_PROCESSING` | `category.CUSTOMER_SUPPORT` | `category.IT_SECURITY` | `category.LEGAL` | `category.OTHER`)}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskTier">{tp("categoriesRisk.riskTier")}</Label>
              <Select
                value={formData.riskTier}
                onValueChange={(value) => setFormData({ ...formData, riskTier: value })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={tp("categoriesRisk.selectRisk")} />
                </SelectTrigger>
                <SelectContent>
                  {RISK_TIER_KEYS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tp(`riskTierOption.${value}` as `riskTierOption.LOW` | `riskTierOption.MEDIUM` | `riskTierOption.HIGH` | `riskTierOption.CRITICAL`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tp("dataProcessing.title")}</CardTitle>
            <CardDescription>{tp("dataProcessing.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tp("dataProcessing.dataCategories")}</Label>
              <div className="flex flex-wrap gap-2">
                {DATA_CATEGORY_KEYS.map((value) => (
                  <Badge
                    key={value}
                    variant={formData.dataProcessed.includes(value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleDataProcessed(value)}
                  >
                    {tp(`dataCategory.${value}` as `dataCategory.IDENTIFIERS` | `dataCategory.DEMOGRAPHICS` | `dataCategory.FINANCIAL` | `dataCategory.HEALTH` | `dataCategory.LOCATION` | `dataCategory.BEHAVIORAL` | `dataCategory.EMPLOYMENT`)}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tp("dataProcessing.countries")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={tp("dataProcessing.countriesPlaceholder")}
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCountry())}
                />
                <Button type="button" variant="outline" onClick={addCountry}>
                  {tp("dataProcessing.addCountry")}
                </Button>
              </div>
              {formData.countries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.countries.map((country) => (
                    <Badge key={country} variant="secondary">
                      {country}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={() => removeCountry(country)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tp("usage.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-status">{tp("usage.status")}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as "ACTIVE" | "PROSPECTIVE" })}
              >
                <SelectTrigger id="vendor-status" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{tp("usage.inUse")}</SelectItem>
                  <SelectItem value="PROSPECTIVE">{tp("usage.considering")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(activityList?.activities?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label htmlFor="vendor-activity">{tp("usage.activity")}</Label>
                <Select
                  value={formData.processingActivityId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, processingActivityId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger id="vendor-activity" className="w-full sm:w-80" data-testid="vendor-activity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tp("usage.noActivity")}</SelectItem>
                    {activityList!.activities.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{tp("usage.activityHint")}</p>
              </div>
            )}
          </CardContent>
        </Card>


        {createVendor.error && (
          <div className="text-sm text-destructive">
            {tp("errorPrefix", { message: createVendor.error.message })}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/privacy/vendors">
            <Button variant="outline" type="button">{tCommon("cancel")}</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || !formData.name}>
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
    </div>
  );
}

export default function NewVendorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <NewVendorPageContent />
    </Suspense>
  );
}

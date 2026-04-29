"use client";

import { useState, useEffect, useRef, Suspense } from "react";
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
  X,
  Search,
  Building2,
  CheckCircle2,
  Shield,
  ExternalLink,
  Sparkles,
} from "lucide-react";
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

// Type for catalog vendor
interface CatalogVendor {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  website: string | null;
  privacyPolicyUrl: string | null;
  trustCenterUrl: string | null;
  dpaUrl: string | null;
  securityPageUrl: string | null;
  certifications: string[];
  frameworks: string[];
  gdprCompliant: boolean | null;
  ccpaCompliant: boolean | null;
  hipaaCompliant: boolean | null;
  dataLocations: string[];
  hasEuDataCenter: boolean | null;
  privacyTechnologies: string[];
  isVerified: boolean;
}

function NewVendorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newVendor");
  const tCommon = useTranslations("common");

  // Catalog mode state
  const isCatalogMode = searchParams.get("catalog") === "true";
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogVendor, setSelectedCatalogVendor] = useState<CatalogVendor | null>(null);
  const [showCatalogResults, setShowCatalogResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowCatalogResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    // Additional fields from catalog
    privacyPolicyUrl: "",
    trustCenterUrl: "",
    dpaUrl: "",
    certifications: [] as string[],
  });

  const [newCountry, setNewCountry] = useState("");

  const utils = trpc.useUtils();

  // Catalog search query
  const { data: catalogResults, isLoading: isSearching } = trpc.vendorCatalog.search.useQuery(
    { query: catalogSearch, limit: 10 },
    { enabled: catalogSearch.length >= 2 }
  );

  // Catalog categories for filtering
  const { data: catalogCategories } = trpc.vendorCatalog.listCategories.useQuery(
    undefined,
    { enabled: isCatalogMode }
  );

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

  // Auto-fill form when catalog vendor is selected
  const selectCatalogVendor = (vendor: CatalogVendor) => {
    setSelectedCatalogVendor(vendor);
    setShowCatalogResults(false);
    setCatalogSearch(vendor.name);

    // Map catalog category to our categories (all 22 canonical VW categories)
    const categoryMapping: Record<string, string> = {
      "Cloud Infrastructure": "CLOUD_SERVICES",
      "Data Warehouse & Integration": "DATA_PROCESSING",
      "Analytics & BI": "ANALYTICS",
      "Customer Data Platform": "DATA_PROCESSING",
      "CRM & Sales": "MARKETING",
      "Marketing Automation": "MARKETING",
      "Advertising": "MARKETING",
      "Content Management": "DATA_PROCESSING",
      "E-commerce": "PAYMENT_PROCESSING",
      "Payment Processing": "PAYMENT_PROCESSING",
      "Communication": "OTHER",
      "Customer Support": "CUSTOMER_SUPPORT",
      "Personalization & Engagement": "MARKETING",
      "HR & People": "HR_SERVICES",
      "Productivity & Collaboration": "OTHER",
      "Developer Tools": "CLOUD_SERVICES",
      "Security & Identity": "IT_SECURITY",
      "Privacy & Consent": "LEGAL",
      "AI & Machine Learning": "DATA_PROCESSING",
      "Legal & Compliance": "LEGAL",
      "Design & Creative": "OTHER",
      "Surveys & Research": "ANALYTICS",
    };

    const mappedCategory = categoryMapping[vendor.category] || "OTHER";

    setFormData({
      ...formData,
      name: vendor.name,
      description: vendor.description || "",
      website: vendor.website || "",
      categories: [mappedCategory],
      countries: vendor.dataLocations || [],
      privacyPolicyUrl: vendor.privacyPolicyUrl || "",
      trustCenterUrl: vendor.trustCenterUrl || "",
      dpaUrl: vendor.dpaUrl || "",
      certifications: vendor.certifications || [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name) return;

    setIsSubmitting(true);

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
      ...(selectedCatalogVendor?.privacyTechnologies?.length
        ? { metadata: { privacyTechnologies: selectedCatalogVendor.privacyTechnologies } }
        : {}),
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

  const clearCatalogSelection = () => {
    setSelectedCatalogVendor(null);
    setCatalogSearch("");
    setFormData({
      name: "",
      description: "",
      website: "",
      contactName: "",
      contactEmail: "",
      categories: [],
      dataProcessed: [],
      countries: [],
      riskTier: "",
      privacyPolicyUrl: "",
      trustCenterUrl: "",
      dpaUrl: "",
      certifications: [],
    });
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
            {isCatalogMode ? tp("titleCatalog") : tp("title")}
          </h1>
          <p className="text-muted-foreground">
            {isCatalogMode ? tp("subtitleCatalog") : tp("subtitle")}
          </p>
        </div>
      </div>

      {/* Catalog Search Section */}
      {isCatalogMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle>{tp("catalog.title")}</CardTitle>
            </div>
            <CardDescription>{tp("catalog.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCatalogVendor ? (
              // Selected vendor display
              <div className="border border-primary/50 bg-background p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{selectedCatalogVendor.name}</span>
                        {selectedCatalogVendor.isVerified && (
                          <Badge variant="outline" className="border-primary text-primary">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {tp("catalog.verified")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedCatalogVendor.category}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearCatalogSelection}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Compliance badges */}
                <div className="flex flex-wrap gap-2">
                  {selectedCatalogVendor.gdprCompliant && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      GDPR
                    </Badge>
                  )}
                  {selectedCatalogVendor.ccpaCompliant && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      CCPA
                    </Badge>
                  )}
                  {selectedCatalogVendor.certifications.map((cert) => (
                    <Badge key={cert} variant="outline" className="text-xs">
                      {cert}
                    </Badge>
                  ))}
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {selectedCatalogVendor.website && (
                    <a
                      href={selectedCatalogVendor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {tp("catalog.website")} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedCatalogVendor.privacyPolicyUrl && (
                    <a
                      href={selectedCatalogVendor.privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {tp("catalog.privacyPolicy")} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedCatalogVendor.dpaUrl && (
                    <a
                      href={selectedCatalogVendor.dpaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {tp("catalog.dpa")} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedCatalogVendor.trustCenterUrl && (
                    <a
                      href={selectedCatalogVendor.trustCenterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {tp("catalog.trustCenter")} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {tp("catalog.autoFilled")}
                </p>
              </div>
            ) : (
              // Search input
              <div className="relative" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tp("catalog.searchPlaceholder")}
                  className="pl-9"
                  value={catalogSearch}
                  onChange={(e) => {
                    setCatalogSearch(e.target.value);
                    setShowCatalogResults(true);
                  }}
                  onFocus={() => setShowCatalogResults(true)}
                />

                {/* Search results dropdown */}
                {showCatalogResults && catalogSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border shadow-lg z-50 max-h-80 overflow-y-auto">
                    {isSearching ? (
                      <div className="p-4 text-center">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground mt-2">{tp("catalog.searching")}</p>
                      </div>
                    ) : catalogResults && catalogResults.length > 0 ? (
                      catalogResults.map((vendor) => (
                        <button
                          key={vendor.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-muted/50 border-b last:border-b-0 flex items-center gap-3"
                          onClick={() => selectCatalogVendor(vendor)}
                        >
                          <div className="w-8 h-8 border flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{vendor.name}</span>
                              {vendor.isVerified && (
                                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {vendor.category}{vendor.subcategory ? ` / ${vendor.subcategory}` : ""}
                              {vendor.description && ` • ${vendor.description.substring(0, 50)}...`}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {vendor.privacyTechnologies?.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {tp("catalog.petsCount", { count: vendor.privacyTechnologies.length })}
                              </Badge>
                            )}
                            {vendor.gdprCompliant && (
                              <Badge variant="outline" className="text-xs px-1.5">GDPR</Badge>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        <p className="text-sm">{tp("catalog.noResults", { query: catalogSearch })}</p>
                        <p className="text-xs mt-1">{tp("catalog.noResultsHint")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!selectedCatalogVendor && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  {tp("catalog.cantFind")}
                </p>
                <Link href="/privacy/vendors/new">
                  <Button variant="link" size="sm" className="text-primary">
                    {tp("catalog.skipCatalog")}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

        {/* Compliance Info Card - only show if we have catalog data */}
        {selectedCatalogVendor && (formData.certifications.length > 0 || formData.privacyPolicyUrl || formData.dpaUrl) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {tp("compliance.title")}
                <Badge variant="outline" className="text-xs">{tp("compliance.fromCatalog")}</Badge>
              </CardTitle>
              <CardDescription>{tp("compliance.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.certifications.length > 0 && (
                <div className="space-y-2">
                  <Label>{tp("compliance.certifications")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.certifications.map((cert) => (
                      <Badge key={cert} variant="outline">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {formData.privacyPolicyUrl && (
                  <div className="space-y-2">
                    <Label>{tp("compliance.privacyPolicyUrl")}</Label>
                    <div className="flex gap-2">
                      <Input value={formData.privacyPolicyUrl} readOnly className="bg-muted" />
                      <a href={formData.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline" size="icon" aria-label="Open in new tab">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
                {formData.dpaUrl && (
                  <div className="space-y-2">
                    <Label>{tp("compliance.dpaUrl")}</Label>
                    <div className="flex gap-2">
                      <Input value={formData.dpaUrl} readOnly className="bg-muted" />
                      <a href={formData.dpaUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline" size="icon" aria-label="Open in new tab">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {formData.trustCenterUrl && (
                <div className="space-y-2">
                  <Label>{tp("compliance.trustCenterUrl")}</Label>
                  <div className="flex gap-2">
                    <Input value={formData.trustCenterUrl} readOnly className="bg-muted" />
                    <a href={formData.trustCenterUrl} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline" size="icon" aria-label="Open in new tab">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

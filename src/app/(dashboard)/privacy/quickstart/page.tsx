"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Search,
  ShoppingCart,
  Cloud,
  Heart,
  Landmark,
  Newspaper,
  Briefcase,
  Building2,
  Database,
  FileText,
  ArrowRightLeft,
  CheckCircle2,
  Package,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

// ============================================================
// ICON MAP
// ============================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Cloud,
  Heart,
  Landmark,
  Newspaper,
  Briefcase,
};

// ============================================================
// TYPES
// ============================================================

type WizardStep = "welcome" | "choose" | "vendors" | "industry" | "review" | "success";

// ============================================================
// PAGE COMPONENT
// ============================================================

export default function QuickstartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";

  // Detect if user arrived from Vendor.Watch
  const fromVendorWatch = searchParams.get("from") === "vendorwatch";

  // Wizard state — start at "welcome" if from VW, otherwise "choose"
  const [step, setStep] = useState<WizardStep>(fromVendorWatch ? "welcome" : "choose");
  const [useVendors, setUseVendors] = useState(false);
  const [useIndustry, setUseIndustry] = useState(false);
  const [portfolioInitialized, setPortfolioInitialized] = useState(false);

  // Vendor selection
  const [vendorSearch, setVendorSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Industry selection
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(null);
  const [expandedAssets, setExpandedAssets] = useState(false);

  // Skip lists
  const [skipAssetNames, setSkipAssetNames] = useState<string[]>([]);
  const [skipActivityNames, setSkipActivityNames] = useState<string[]>([]);

  // Debounce search
  const debounceTimeout = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback(
    (value: string) => {
      setVendorSearch(value);
      if (debounceTimeout[0]) clearTimeout(debounceTimeout[0]);
      debounceTimeout[0] = setTimeout(() => {
        setDebouncedSearch(value);
      }, 300);
    },
    [debounceTimeout]
  );

  // ─── QUERIES ──────────────────────────────────────

  // Fetch Vendor.Watch portfolio (always — used for both VW flow and dashboard detection)
  const { data: portfolio, isLoading: portfolioLoading } =
    trpc.quickstart.getPortfolio.useQuery(
      { organizationId: orgId },
      { enabled: !!orgId }
    );

  // When portfolio loads and we're in VW flow, pre-select vendors
  useEffect(() => {
    if (portfolioInitialized) return;
    if (!portfolio?.hasPortfolio) return;
    if (portfolio.slugs.length > 0) {
      setSelectedSlugs(portfolio.slugs);
      setUseVendors(true);
      setPortfolioInitialized(true);
    }
  }, [portfolio, portfolioInitialized]);

  // If user came from VW but has no portfolio, fall through to normal choose step
  useEffect(() => {
    if (fromVendorWatch && !portfolioLoading && portfolio && !portfolio.hasPortfolio) {
      setStep("choose");
    }
  }, [fromVendorWatch, portfolioLoading, portfolio]);

  const { data: catalogAccess } = trpc.vendor.hasVendorCatalogAccess.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const { data: catalogResults, isLoading: catalogLoading } =
    trpc.vendorCatalog.search.useQuery(
      { query: debouncedSearch, limit: 20 },
      { enabled: debouncedSearch.length >= 2 }
    );

  const { data: templates } = trpc.quickstart.listTemplates.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const { data: vendorPreview } = trpc.quickstart.previewVendorImport.useQuery(
    { organizationId: orgId, vendorSlugs: selectedSlugs },
    { enabled: !!orgId && selectedSlugs.length > 0 && catalogAccess?.hasAccess === true }
  );

  const { data: industryPreview } =
    trpc.quickstart.previewIndustryTemplate.useQuery(
      { organizationId: orgId, industryId: selectedIndustryId ?? "" },
      { enabled: !!orgId && !!selectedIndustryId }
    );

  const executeMutation = trpc.quickstart.execute.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Created ${data.assets} assets, ${data.activities} activities, ${data.vendors} vendors`
      );
      setStep("success");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ─── HANDLERS ─────────────────────────────────────

  const toggleVendorSlug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const removeVendorSlug = (slug: string) => {
    setSelectedSlugs((prev) => prev.filter((s) => s !== slug));
  };

  const handleProceedFromChoose = () => {
    if (useVendors && !useIndustry) setStep("vendors");
    else if (useIndustry && !useVendors) setStep("industry");
    else if (useVendors) setStep("vendors");
    else toast.error("Select at least one option");
  };

  const handleProceedFromVendors = () => {
    if (selectedSlugs.length === 0) {
      toast.error("Select at least one vendor");
      return;
    }
    if (useIndustry) setStep("industry");
    else setStep("review");
  };

  const handleProceedFromIndustry = () => {
    if (!selectedIndustryId) {
      toast.error("Select an industry template");
      return;
    }
    setStep("review");
  };

  const handleExecute = () => {
    executeMutation.mutate({
      organizationId: orgId,
      vendorSlugs: useVendors ? selectedSlugs : [],
      industryId: useIndustry ? selectedIndustryId ?? undefined : undefined,
      skipAssetNames,
      skipActivityNames,
    });
  };

  // Calculate totals for review step
  const reviewTotals = {
    vendors: vendorPreview?.totals.vendors ?? 0,
    assets:
      (vendorPreview?.totals.assets ?? 0) +
      (industryPreview?.totals.assets ?? 0),
    elements:
      (vendorPreview?.totals.elements ?? 0) +
      (industryPreview?.totals.elements ?? 0),
    activities:
      (vendorPreview?.totals.activities ?? 0) +
      (industryPreview?.totals.activities ?? 0),
    flows: industryPreview?.totals.flows ?? 0,
    transfers: vendorPreview?.totals.transfers ?? 0,
  };

  // ─── RENDER ───────────────────────────────────────

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">
            Privacy Program Quickstart
          </h1>
          <p className="text-sm text-muted-foreground">
            Get a head start on your privacy program
          </p>
        </div>
      </div>

      {/* Step indicator — hidden on welcome step */}
      {step !== "welcome" && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {[
            ...(!fromVendorWatch
              ? [{ key: "choose", label: "Choose Path" }]
              : []),
            ...(useVendors
              ? [{ key: "vendors", label: fromVendorWatch ? "Your Vendors" : "Select Vendors" }]
              : []),
            ...(useIndustry
              ? [{ key: "industry", label: "Industry Template" }]
              : []),
            { key: "review", label: "Review & Confirm" },
          ].map((s, i, arr) => (
            <span key={s.key} className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  step === s.key
                    ? "bg-primary text-primary-foreground"
                    : step === "success" || arr.findIndex((x) => x.key === step) > i
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={
                  step === s.key ? "font-medium" : "text-muted-foreground"
                }
              >
                {s.label}
              </span>
              {i < arr.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              )}
            </span>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          WELCOME — Vendor.Watch portfolio detected
          ════════════════════════════════════════════════ */}
      {step === "welcome" && (
        <div className="space-y-6">
          {portfolioLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : portfolio?.hasPortfolio ? (
            <>
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                      <Building2 className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg sm:text-xl font-semibold">
                        Welcome from Vendor.Watch!
                      </h2>
                      <p className="text-muted-foreground mt-2">
                        We found <strong>{portfolio.vendors.length} vendor{portfolio.vendors.length !== 1 ? "s" : ""}</strong> in
                        your portfolio. Can we help you build your privacy program
                        around your initial vendor portfolio?
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        You will be able to add more vendors and processing activities
                        later on.
                      </p>
                    </div>
                  </div>

                  {/* Portfolio vendor list */}
                  <div className="mt-6 space-y-2">
                    {portfolio.vendors.map((v) => (
                      <div
                        key={v!.slug}
                        className={`flex items-center justify-between p-3 rounded border ${
                          v!.alreadyImported ? "opacity-50 border-dashed" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{v!.name}</span>
                              {v!.isVerified && (
                                <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                  Verified
                                </Badge>
                              )}
                              {v!.criticality === "high" && (
                                <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                                  High criticality
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {v!.category} — {v!.mappingLabel} — {v!.elementCount} data elements
                            </span>
                          </div>
                        </div>
                        {v!.alreadyImported && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Already imported
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Button
                      size="lg"
                      onClick={() => {
                        setUseVendors(true);
                        setStep("vendors");
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Yes, build my privacy program
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setUseVendors(true);
                        setUseIndustry(true);
                        setStep("vendors");
                      }}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Yes, and also add an industry template
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => setStep("choose")}
                    >
                      Let me choose manually
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                Portfolio imported from{" "}
                <a
                  href="https://vendorwatch.todo.law"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Vendor.Watch
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </>
          ) : null}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          STEP 1: Choose Path
          ════════════════════════════════════════════════ */}
      {step === "choose" && (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Choose how you want to bootstrap your privacy program. You can use
            both options together.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Vendor Import Card */}
            <Card
              className={`cursor-pointer transition-all ${
                useVendors
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-primary/50"
              } ${!catalogAccess?.hasAccess ? "opacity-70" : ""}`}
              onClick={() => {
                if (catalogAccess?.hasAccess) setUseVendors(!useVendors);
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Building2 className="w-8 h-8 text-primary" />
                  {!catalogAccess?.hasAccess && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="w-3 h-3" />
                      Premium
                    </Badge>
                  )}
                  {useVendors && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                <CardTitle className="text-lg">Import from Vendor Catalog</CardTitle>
                <CardDescription>
                  Select vendors you use and auto-generate data assets, elements,
                  and processing activities from their known data profiles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Data Assets</Badge>
                  <Badge variant="secondary">Data Elements</Badge>
                  <Badge variant="secondary">Processing Activities</Badge>
                  <Badge variant="secondary">Data Transfers</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Industry Template Card */}
            <Card
              className={`cursor-pointer transition-all ${
                useIndustry
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setUseIndustry(!useIndustry)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Sparkles className="w-8 h-8 text-primary" />
                  <Badge variant="outline" className="text-green-600 border-green-600/50">
                    Free
                  </Badge>
                  {useIndustry && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                <CardTitle className="text-lg">Start from Industry Template</CardTitle>
                <CardDescription>
                  Pick your industry and get a pre-built privacy program with
                  common data assets, processing activities, and data flows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Data Assets</Badge>
                  <Badge variant="secondary">Processing Activities</Badge>
                  <Badge variant="secondary">Data Flows</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleProceedFromChoose}
              disabled={!useVendors && !useIndustry}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          STEP 2A: Vendor Selection
          ════════════════════════════════════════════════ */}
      {step === "vendors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Select Vendors</h2>
              <p className="text-sm text-muted-foreground">
                Search the vendor catalog and select the tools your organization
                uses.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(fromVendorWatch && portfolio?.hasPortfolio ? "welcome" : "choose")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>

          {/* Selected vendors */}
          {selectedSlugs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedSlugs.map((slug) => {
                const vendor = vendorPreview?.previews.find(
                  (p) => p.vendorSlug === slug
                );
                return (
                  <Badge
                    key={slug}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1 py-1"
                  >
                    {vendor?.vendorName ?? slug}
                    <button
                      onClick={() => removeVendorSlug(slug)}
                      className="ml-1 hover:bg-muted rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
              <span className="text-xs text-muted-foreground self-center">
                {selectedSlugs.length} selected
              </span>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={vendorSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Search vendors (e.g., Google Analytics, Salesforce, Stripe...)"
              className="pl-10"
            />

            {/* Search dropdown */}
            {searchFocused && debouncedSearch.length >= 2 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-80 overflow-auto">
                {catalogLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Searching...
                  </div>
                ) : catalogResults && catalogResults.length > 0 ? (
                  catalogResults.map((vendor) => {
                    const isSelected = selectedSlugs.includes(vendor.slug);
                    return (
                      <button
                        key={vendor.slug}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0 flex items-center gap-3 ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          toggleVendorSlug(vendor.slug);
                        }}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {vendor.name}
                            </span>
                            {vendor.isVerified && (
                              <Badge
                                variant="outline"
                                className="text-xs border-primary/50 text-primary shrink-0"
                              >
                                Verified
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {vendor.category}
                            </span>
                            {vendor.gdprCompliant && (
                              <Badge variant="outline" className="text-xs">
                                GDPR
                              </Badge>
                            )}
                          </div>
                          {vendor.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {vendor.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No vendors found for &quot;{debouncedSearch}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vendor preview */}
          {vendorPreview && vendorPreview.previews.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Import Preview</CardTitle>
                <CardDescription>
                  {vendorPreview.totals.vendors} vendors,{" "}
                  {vendorPreview.totals.assets} assets,{" "}
                  {vendorPreview.totals.elements} elements,{" "}
                  {vendorPreview.totals.activities} activities
                  {vendorPreview.totals.transfers > 0 &&
                    `, ${vendorPreview.totals.transfers} data transfers`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {vendorPreview.previews.map((p) => {
                  const isExisting =
                    vendorPreview.existingVendorNames.includes(p.vendorName);
                  return (
                    <div
                      key={p.vendorSlug}
                      className={`p-3 rounded border ${
                        isExisting ? "opacity-50 border-dashed" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium text-sm">
                            {p.vendorName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {p.category}
                          </Badge>
                        </div>
                        {isExisting && (
                          <Badge variant="secondary" className="text-xs">
                            Already exists
                          </Badge>
                        )}
                        {p.isHighRisk && !isExisting && (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-500/50 text-amber-500"
                          >
                            High Risk
                          </Badge>
                        )}
                      </div>
                      {!isExisting && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">
                            Will create:
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            1 Asset
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {p.elementCount} Elements
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            1 Activity
                          </Badge>
                          {p.transfers.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {p.transfers.length} Transfer
                              {p.transfers.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleProceedFromVendors}
              disabled={selectedSlugs.length === 0}
            >
              {useIndustry ? "Continue to Industry" : "Review"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          STEP 2B: Industry Selection
          ════════════════════════════════════════════════ */}
      {step === "industry" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Select Industry</h2>
              <p className="text-sm text-muted-foreground">
                Choose the template that best matches your organization.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(useVendors ? "vendors" : "choose")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>

          {/* Industry grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates?.map((t) => {
              const Icon = ICON_MAP[t.icon] ?? Package;
              const isSelected = selectedIndustryId === t.id;
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedIndustryId(t.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Icon className="w-6 h-6 text-primary" />
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {t.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{t.assetCount} assets</span>
                      <span>{t.activityCount} activities</span>
                      <span>{t.flowCount} flows</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Industry preview */}
          {industryPreview && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {industryPreview.template.name} Template Preview
                    </CardTitle>
                    <CardDescription>
                      {industryPreview.totals.assets} assets,{" "}
                      {industryPreview.totals.elements} elements,{" "}
                      {industryPreview.totals.activities} activities,{" "}
                      {industryPreview.totals.flows} flows
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedAssets(!expandedAssets)}
                  >
                    {expandedAssets ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    <span className="ml-1 text-xs">
                      {expandedAssets ? "Collapse" : "Expand"}
                    </span>
                  </Button>
                </div>
              </CardHeader>
              {expandedAssets && (
                <CardContent className="space-y-4">
                  {/* Assets */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Data Assets
                    </h4>
                    <div className="space-y-2">
                      {industryPreview.assets.map((a) => (
                        <div
                          key={a.name}
                          className={`p-2 rounded border text-sm ${
                            a.alreadyExists ? "opacity-50 border-dashed" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{a.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {a.type}
                              </Badge>
                              {a.alreadyExists && (
                                <Badge variant="secondary" className="text-xs">
                                  Exists
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {a.elementCount} elements: {a.elements.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activities */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Processing Activities
                    </h4>
                    <div className="space-y-2">
                      {industryPreview.activities.map((a) => (
                        <div
                          key={a.name}
                          className={`p-2 rounded border text-sm ${
                            a.alreadyExists ? "opacity-50 border-dashed" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{a.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {a.legalBasis}
                              </Badge>
                              {a.alreadyExists && (
                                <Badge variant="secondary" className="text-xs">
                                  Exists
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {a.purpose}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Flows */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4" />
                      Data Flows
                    </h4>
                    <div className="space-y-2">
                      {industryPreview.flows.map((f) => (
                        <div key={f.name} className="p-2 rounded border text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{f.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {f.frequency}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {f.sourceAssetName} → {f.destAssetName}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleProceedFromIndustry}
              disabled={!selectedIndustryId}
            >
              Review
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          STEP 3: Review & Confirm
          ════════════════════════════════════════════════ */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Review & Confirm</h2>
              <p className="text-sm text-muted-foreground">
                Review what will be created, then build your privacy program.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setStep(useIndustry ? "industry" : useVendors ? "vendors" : "choose")
              }
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>

          {/* Summary stats */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: "Vendors",
                count: reviewTotals.vendors,
                icon: Building2,
                show: useVendors,
              },
              { label: "Data Assets", count: reviewTotals.assets, icon: Database, show: true },
              {
                label: "Data Elements",
                count: reviewTotals.elements,
                icon: Package,
                show: true,
              },
              {
                label: "Activities",
                count: reviewTotals.activities,
                icon: FileText,
                show: true,
              },
              {
                label: "Data Flows",
                count: reviewTotals.flows,
                icon: ArrowRightLeft,
                show: useIndustry,
              },
              {
                label: "Transfers",
                count: reviewTotals.transfers,
                icon: ArrowRightLeft,
                show: useVendors && reviewTotals.transfers > 0,
              },
            ]
              .filter((s) => s.show)
              .map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4 text-center">
                    <s.icon className="w-5 h-5 mx-auto text-primary mb-1" />
                    <div className="text-2xl font-bold">{s.count}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Non-destructive notice */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Non-destructive operation</p>
                  <p className="text-muted-foreground mt-1">
                    This will only create new records. Existing data assets,
                    vendors, and processing activities will not be modified.
                    Duplicates are automatically skipped.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What's included */}
          {useVendors && vendorPreview && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Vendor Import
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {vendorPreview.previews
                    .filter(
                      (p) =>
                        !vendorPreview.existingVendorNames.includes(
                          p.vendorName
                        )
                    )
                    .map((p) => (
                      <div
                        key={p.vendorSlug}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span>{p.vendorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.elementCount} elements, 1 activity
                          {p.transfers.length > 0 &&
                            `, ${p.transfers.length} transfer${p.transfers.length !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {useIndustry && industryPreview && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {industryPreview.template.name} Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {industryPreview.assets
                    .filter((a) => !a.alreadyExists)
                    .map((a) => (
                      <div
                        key={a.name}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span>{a.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.elementCount} elements
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              size="lg"
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Building...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Build My Privacy Program
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          SUCCESS
          ════════════════════════════════════════════════ */}
      {step === "success" && (
        <div className="space-y-6">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Privacy Program Created!
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your privacy program has been bootstrapped. Explore your new
                records and customize them as needed.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/privacy/data-inventory">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <Database className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Data Inventory</p>
                    <p className="text-xs text-muted-foreground">
                      View assets & elements
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/privacy/processing-activities">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Processing Activities</p>
                    <p className="text-xs text-muted-foreground">
                      View activities & ROPA
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/privacy/vendors">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Vendors</p>
                    <p className="text-xs text-muted-foreground">
                      Manage vendor list
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/privacy">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <ArrowLeft className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Dashboard</p>
                    <p className="text-xs text-muted-foreground">
                      Return to overview
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

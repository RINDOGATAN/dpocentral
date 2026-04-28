"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  ShieldCheck,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";

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
  const tQs = useTranslations("quickstart");
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.quickstart");

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

  // Result data from execute mutation
  const [executionResult, setExecutionResult] = useState<{ assets: number; activities: number; vendors: number; elements: number; flows: number; transfers: number; aiSystems?: number } | null>(null);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setVendorSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

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
      { enabled: debouncedSearch.length >= 2 && step === "vendors" }
    );

  const { data: templates } = trpc.quickstart.listTemplates.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const isPortfolioFlow = fromVendorWatch && portfolio?.hasPortfolio === true;

  const { data: vendorPreview } = trpc.quickstart.previewVendorImport.useQuery(
    { organizationId: orgId, vendorSlugs: selectedSlugs, fromPortfolio: isPortfolioFlow },
    { enabled: !!orgId && selectedSlugs.length > 0 && (step === "vendors" || step === "review") }
  );

  const { data: industryPreview } =
    trpc.quickstart.previewIndustryTemplate.useQuery(
      { organizationId: orgId, industryId: selectedIndustryId ?? "" },
      { enabled: !!orgId && !!selectedIndustryId }
    );

  const executeMutation = trpc.quickstart.execute.useMutation({
    onSuccess: (data) => {
      setExecutionResult(data);
      const total = data.assets + data.activities + data.vendors;
      if (total === 0) {
        toast.info(t("quickstart.noNewRecords"));
      } else {
        const parts: string[] = [];
        if (data.vendors > 0) parts.push(t("quickstart.createdVendors", { count: data.vendors }));
        if (data.assets > 0) parts.push(t("quickstart.createdAssets", { count: data.assets }));
        if (data.activities > 0) parts.push(t("quickstart.createdActivities", { count: data.activities }));
        toast.success(t("quickstart.createdSummary", { summary: parts.join(", ") }));
      }
      setStep("success");
    },
    onError: (err) => {
      toast.error(err.message || t("generic.somethingWentWrong"));
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
    else toast.error(t("quickstart.selectAtLeastOne"));
  };

  const handleProceedFromVendors = () => {
    if (selectedSlugs.length === 0) {
      toast.error(t("quickstart.selectAtLeastOneVendor"));
      return;
    }
    if (useIndustry) setStep("industry");
    else setStep("review");
  };

  const handleProceedFromIndustry = () => {
    if (!selectedIndustryId) {
      toast.error(t("quickstart.selectTemplate"));
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
      fromPortfolio: isPortfolioFlow && useVendors,
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
    aiSystems: vendorPreview?.totals.aiSystems ?? 0,
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
        <Link href="/privacy?from=quickstart">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {tp("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{tp("title")}</h1>
          <p className="text-sm text-muted-foreground">{tp("subtitle")}</p>
        </div>
      </div>

      {/* Step indicator — hidden on welcome step */}
      {step !== "welcome" && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {[
            ...(!fromVendorWatch
              ? [{ key: "choose", label: tp("steps.choose") }]
              : []),
            ...(useVendors
              ? [{ key: "vendors", label: fromVendorWatch ? tp("steps.yourVendors") : tp("steps.vendors") }]
              : []),
            ...(useIndustry
              ? [{ key: "industry", label: tp("steps.industry") }]
              : []),
            { key: "review", label: tp("steps.review") },
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
          ) : portfolio?.hasPortfolio ? (() => {
            const allImported = portfolio.slugs.length === 0;
            const hasEntitlement = catalogAccess?.hasAccess === true;
            return (
              <>
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                        {allImported ? (
                          <CheckCircle2 className="w-8 h-8 text-primary" />
                        ) : (
                          <Building2 className="w-8 h-8 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg sm:text-xl font-semibold">
                          {allImported ? tp("welcome.allImportedTitle") : tp("welcome.vwTitle")}
                        </h2>
                        {allImported ? (
                          <p className="text-muted-foreground mt-2">
                            {tp.rich("welcome.allImportedBody", {
                              count: portfolio.vendors.length,
                              b: (chunks) => <strong>{chunks}</strong>,
                            })}
                          </p>
                        ) : (
                          <>
                            <p className="text-muted-foreground mt-2">
                              {tp.rich("welcome.vwBody", {
                                count: portfolio.vendors.length,
                                newCount: portfolio.slugs.length < portfolio.vendors.length ? portfolio.slugs.length : "none",
                                b: (chunks) => <strong>{chunks}</strong>,
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                              {tp("welcome.vwAddMore")}
                            </p>
                          </>
                        )}
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
                                    {tp("welcome.verified")}
                                  </Badge>
                                )}
                                {v!.criticality === "high" && (
                                  <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                                    {tp("welcome.highCriticality")}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {tp("welcome.vendorMeta", { category: v!.category, label: v!.mappingLabel, count: v!.elementCount })}
                              </span>
                            </div>
                          </div>
                          {v!.alreadyImported && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {tp("welcome.alreadyImported")}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action buttons — vary by state */}
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      {allImported ? (
                        <>
                          <Button
                            size="lg"
                            onClick={() => {
                              setUseIndustry(true);
                              setStep("industry");
                            }}
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            {tp("welcome.addIndustry")}
                          </Button>
                          <Link href="/privacy?from=quickstart">
                            <Button variant="ghost" size="lg">
                              {tp("welcome.backToDashboard")}
                            </Button>
                          </Link>
                        </>
                      ) : (
                        <>
                          <Button
                            size="lg"
                            onClick={() => {
                              setUseVendors(true);
                              setStep("vendors");
                            }}
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            {tp("welcome.yesBuild")}
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
                            {tp("welcome.yesAndIndustry")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => setStep("choose")}
                          >
                            {tp("welcome.manual")}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground text-center">
                  {tp("welcome.portfolioFrom")}{" "}
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
            );
          })() : null}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          STEP 1: Choose Path
          ════════════════════════════════════════════════ */}
      {step === "choose" && (
        <div className="space-y-4">
          <p className="text-muted-foreground">{tp("choose.intro")}</p>

          {/* Recommended: one-click complete setup */}
          <Card
            className="cursor-pointer border-primary/50 bg-primary/5 hover:border-primary transition-all"
            onClick={() => {
              setUseVendors(true);
              setUseIndustry(true);
              setStep("vendors");
            }}
          >
            <CardContent className="p-4 sm:p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm sm:text-base">
                    {tQs("recommended")}
                  </h3>
                  <Badge variant="outline" className="text-primary border-primary/50">
                    {tp("choose.best")}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {tQs("recommendedDesc")}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-primary shrink-0" />
            </CardContent>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">{tp("choose.or")}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Vendor Import Card */}
            <Card
              className={`cursor-pointer transition-all ${
                useVendors
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setUseVendors(!useVendors)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Building2 className="w-8 h-8 text-primary" />
                  {!catalogAccess?.hasAccess && (
                    <Badge variant="outline" className="text-green-600 border-green-600/50">
                      {tp("choose.fiveFree")}
                    </Badge>
                  )}
                  {useVendors && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                <CardTitle className="text-lg">{tp("choose.vendorCardTitle")}</CardTitle>
                <CardDescription>{tp("choose.vendorCardDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{tp("choose.tagAssets")}</Badge>
                  <Badge variant="secondary">{tp("choose.tagElements")}</Badge>
                  <Badge variant="secondary">{tp("choose.tagActivities")}</Badge>
                  <Badge variant="secondary">{tp("choose.tagTransfers")}</Badge>
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
                    {tp("choose.free")}
                  </Badge>
                  {useIndustry && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                <CardTitle className="text-lg">{tp("choose.industryCardTitle")}</CardTitle>
                <CardDescription>{tp("choose.industryCardDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{tp("choose.tagAssets")}</Badge>
                  <Badge variant="secondary">{tp("choose.tagActivities")}</Badge>
                  <Badge variant="secondary">{tp("choose.tagFlows")}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleProceedFromChoose}
              disabled={!useVendors && !useIndustry}
            >
              {tp("choose.continue")}
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
              <h2 className="text-lg font-semibold">{tp("vendors.title")}</h2>
              <p className="text-sm text-muted-foreground">{tp("vendors.subtitle")}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(fromVendorWatch && portfolio?.hasPortfolio ? "welcome" : "choose")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {tp("vendors.back")}
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
                {tp("vendors.selectedSuffix", { count: selectedSlugs.length })}
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
              placeholder={tp("vendors.searchPlaceholder")}
              className="pl-10"
            />

            {/* Search dropdown */}
            {searchFocused && debouncedSearch.length >= 2 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-80 overflow-auto">
                {catalogLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    {tp("vendors.searching")}
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
                                {tp("vendors.verified")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {vendor.category}
                            </span>
                            {vendor.gdprCompliant && (
                              <Badge variant="outline" className="text-xs">
                                {tp("vendors.gdpr")}
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
                    {tp("vendors.noResults", { query: debouncedSearch })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vendor preview */}
          {vendorPreview && vendorPreview.previews.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tp("vendors.previewTitle")}</CardTitle>
                <CardDescription>
                  {vendorPreview.totals.transfers > 0
                    ? tp("vendors.previewSummaryWithTransfers", {
                        vendors: vendorPreview.totals.vendors,
                        assets: vendorPreview.totals.assets,
                        elements: vendorPreview.totals.elements,
                        activities: vendorPreview.totals.activities,
                        transfers: vendorPreview.totals.transfers,
                      })
                    : tp("vendors.previewSummary", {
                        vendors: vendorPreview.totals.vendors,
                        assets: vendorPreview.totals.assets,
                        elements: vendorPreview.totals.elements,
                        activities: vendorPreview.totals.activities,
                      })}
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
                            {tp("vendors.alreadyExists")}
                          </Badge>
                        )}
                        {p.isHighRisk && !isExisting && (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-500/50 text-amber-500"
                          >
                            {tp("vendors.highRisk")}
                          </Badge>
                        )}
                      </div>
                      {!isExisting && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">
                            {tp("vendors.willCreate")}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {tp("vendors.assetCount", { count: 1 })}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {tp("vendors.elementCount", { count: p.elementCount })}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {tp("vendors.activityCount", { count: 1 })}
                          </Badge>
                          {p.transfers.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {tp("vendors.transferCount", { count: p.transfers.length })}
                            </Badge>
                          )}
                        </div>
                      )}
                      {p.privacyTechnologies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">
                            {tp("vendors.privacyTech")}
                          </span>
                          {p.privacyTechnologies.map((pet) => (
                            <Badge key={pet} variant="outline" className="text-xs">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              {pet}
                            </Badge>
                          ))}
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
              {useIndustry ? tp("vendors.continueToIndustry") : tp("vendors.reviewBtn")}
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
              <h2 className="text-lg font-semibold">{tp("industry.title")}</h2>
              <p className="text-sm text-muted-foreground">{tp("industry.subtitle")}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(useVendors ? "vendors" : "choose")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {tp("industry.back")}
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
                      <span>{tp("industry.templateAssets", { count: t.assetCount })}</span>
                      <span>{tp("industry.templateActivities", { count: t.activityCount })}</span>
                      <span>{tp("industry.templateFlows", { count: t.flowCount })}</span>
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
                      {tp("industry.previewTitle", { name: industryPreview.template.name })}
                    </CardTitle>
                    <CardDescription>
                      {tp("industry.previewSummary", {
                        assets: industryPreview.totals.assets,
                        elements: industryPreview.totals.elements,
                        activities: industryPreview.totals.activities,
                        flows: industryPreview.totals.flows,
                      })}
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
                      {expandedAssets ? tp("industry.collapse") : tp("industry.expand")}
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
                      {tp("industry.dataAssets")}
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
                                  {tp("industry.exists")}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {tp("industry.elementsList", { count: a.elementCount, list: a.elements.join(", ") })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activities */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {tp("industry.processingActivities")}
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
                                  {tp("industry.exists")}
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
                      {tp("industry.dataFlows")}
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
              {tp("industry.review")}
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
              <h2 className="text-lg font-semibold">{tp("review.title")}</h2>
              <p className="text-sm text-muted-foreground">{tp("review.subtitle")}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setStep(useIndustry ? "industry" : useVendors ? "vendors" : "choose")
              }
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {tp("review.back")}
            </Button>
          </div>

          {/* Summary stats */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: tp("review.stats.vendors"),
                count: reviewTotals.vendors,
                icon: Building2,
                show: useVendors,
              },
              { label: tp("review.stats.assets"), count: reviewTotals.assets, icon: Database, show: true },
              {
                label: tp("review.stats.elements"),
                count: reviewTotals.elements,
                icon: Package,
                show: true,
              },
              {
                label: tp("review.stats.activities"),
                count: reviewTotals.activities,
                icon: FileText,
                show: true,
              },
              {
                label: tp("review.stats.flows"),
                count: reviewTotals.flows,
                icon: ArrowRightLeft,
                show: useIndustry,
              },
              {
                label: tp("review.stats.transfers"),
                count: reviewTotals.transfers,
                icon: ArrowRightLeft,
                show: useVendors && reviewTotals.transfers > 0,
              },
              {
                label: tp("review.stats.aiSystems"),
                count: reviewTotals.aiSystems,
                icon: Bot,
                show: useVendors && reviewTotals.aiSystems > 0,
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
                  <p className="font-medium">{tp("review.nondestructiveTitle")}</p>
                  <p className="text-muted-foreground mt-1">{tp("review.nondestructiveBody")}</p>
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
                  {tp("review.vendorImport")}
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
                        <span className="flex items-center gap-1.5">
                          {p.vendorName}
                          {p.isAiCapable && (
                            <span title={tp("review.aiTooltip")}>
                              <Bot className="w-3.5 h-3.5 text-blue-500" />
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.transfers.length > 0 && p.isAiCapable
                            ? tp("review.vendorMetaFull", { count: p.elementCount, transfers: p.transfers.length })
                            : p.transfers.length > 0
                              ? tp("review.vendorMetaWithTransfers", { count: p.elementCount, transfers: p.transfers.length })
                              : p.isAiCapable
                                ? tp("review.vendorMetaWithAi", { count: p.elementCount })
                                : tp("review.vendorMeta", { count: p.elementCount })}
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
                  {tp("review.templateSuffix", { name: industryPreview.template.name })}
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
                          {tp("review.templateAssetMeta", { count: a.elementCount })}
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
                  {tp("review.building")}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {tp("review.build")}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          SUCCESS
          ════════════════════════════════════════════════ */}
      {step === "success" && (() => {
        const totalCreated = executionResult
          ? executionResult.assets + executionResult.activities + executionResult.vendors
          : 0;
        const nothingCreated = totalCreated === 0;
        return (
        <div className="space-y-6">
          <Card className={nothingCreated ? "border-primary/30 bg-primary/5" : "border-green-500/30 bg-green-500/5"}>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className={`w-12 h-12 mx-auto mb-4 ${nothingCreated ? "text-primary" : "text-green-500"}`} />
              <h2 className="text-xl font-semibold mb-2">
                {nothingCreated ? tp("success.alreadySetTitle") : tp("success.createdTitle")}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {nothingCreated ? tp("success.alreadySetBody") : tp("success.createdBody")}
              </p>
            </CardContent>
          </Card>

          <ExpertHelpCta context="quickstart" />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/privacy/data-inventory">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <Database className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{tp("success.cardDataInventory")}</p>
                    <p className="text-xs text-muted-foreground">{tp("success.cardDataInventoryDesc")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/privacy/processing-activities">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{tp("success.cardActivities")}</p>
                    <p className="text-xs text-muted-foreground">{tp("success.cardActivitiesDesc")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/privacy/vendors">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{tp("success.cardVendors")}</p>
                    <p className="text-xs text-muted-foreground">{tp("success.cardVendorsDesc")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            {executionResult && (executionResult.aiSystems ?? 0) > 0 && (
              <Link href="/privacy/ai-systems">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Bot className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{tp("success.cardAiSystems")}</p>
                      <p className="text-xs text-muted-foreground">
                        {tp("success.cardAiSystemsDesc", { count: executionResult.aiSystems ?? 0 })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
            <Link href="/privacy?from=quickstart">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <ArrowLeft className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{tp("success.cardDashboard")}</p>
                    <p className="text-xs text-muted-foreground">{tp("success.cardDashboardDesc")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

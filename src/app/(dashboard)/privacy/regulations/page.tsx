"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scale,
  Search,
  Globe,
  CheckCircle2,
  ArrowRight,
  Loader2,
  MapPin,
  Clock,
  AlertTriangle,
  Plus,
  X,
  Download,
  Circle,
  CircleDashed,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { useDebounce } from "@/hooks/use-debounce";
import { useTranslations } from "next-intl";

export default function RegulationsPage() {
  const t = useTranslations("pages.regulations");
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 300);

  const { data: catalog, isLoading } = trpc.regulations.listAvailable.useQuery(
    {
      organizationId: orgId,
      search: debouncedSearch || undefined,
      category: categoryFilter !== "all" ? categoryFilter as "comprehensive" | "sectoral" | "ai_governance" | "emerging" : undefined,
    },
    { enabled: !!orgId }
  );

  const { data: applied } = trpc.regulations.listApplied.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const { data: status } = trpc.regulations.getRequirementsStatus.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId && (applied?.jurisdictions.length ?? 0) > 0 }
  );
  const statusByJurisdiction = new Map(
    (status?.jurisdictions ?? []).map((j) => [j.jurisdictionId, j])
  );

  const utils = trpc.useUtils();

  const applyMutation = trpc.regulations.applyJurisdiction.useMutation({
    onSuccess: () => {
      utils.regulations.listAvailable.invalidate();
      utils.regulations.listApplied.invalidate();
    },
  });

  const removeMutation = trpc.regulations.removeJurisdiction.useMutation({
    onSuccess: () => {
      utils.regulations.listAvailable.invalidate();
      utils.regulations.listApplied.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Scale className="w-6 h-6" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                `/api/export/regulatory-landscape?organizationId=${orgId}`,
                "_blank"
              )
            }
            disabled={!applied?.jurisdictions.length}
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{t("exportReport")}</span>
          </Button>
          <Button asChild>
            <Link href="/privacy/regulations/wizard">
              <Globe className="w-4 h-4 mr-2" />
              {t("wizard")}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">{t("tabs.catalog")}</TabsTrigger>
          <TabsTrigger value="applied">
            {t("tabs.appliedWithCount", { count: applied?.jurisdictions.length ?? 0 })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("category.label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("category.all")}</SelectItem>
                <SelectItem value="comprehensive">{t("category.comprehensive")}</SelectItem>
                <SelectItem value="sectoral">{t("category.sectoral")}</SelectItem>
                <SelectItem value="ai_governance">{t("category.ai_governance")}</SelectItem>
                <SelectItem value="emerging">{t("category.emerging")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {catalog?.jurisdictions.map((j) => (
                <Card key={j.code} className={j.isApplied ? "border-primary" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{j.shortName}</CardTitle>
                        <CardDescription className="text-xs mt-1">{j.name}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">{j.region}</Badge>
                        {j.isApplied && (
                          <Badge className="text-xs bg-primary">{t("card.applied")}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{j.description}</p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t("card.dsarShort", { days: j.dsarDeadlineDays })}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t("card.breachShort", { hours: j.breachNotificationHours })}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {j.keyRequirements.slice(0, 2).map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {r}
                        </Badge>
                      ))}
                      {j.keyRequirements.length > 2 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("card.moreItems", { count: j.keyRequirements.length - 2 })}
                        </Badge>
                      )}
                    </div>

                    {!j.isApplied ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          applyMutation.mutate({
                            organizationId: orgId,
                            jurisdictionCode: j.code,
                          })
                        }
                        disabled={applyMutation.isPending}
                      >
                        <Plus className="w-3 h-3 mr-1" /> {t("card.apply")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="w-full text-muted-foreground" disabled>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {t("card.applied")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applied" className="space-y-4">
          {applied?.jurisdictions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">{t("applied.emptyTitle")}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("applied.emptySubtitle")}
                </p>
                <Button asChild>
                  <Link href="/privacy/regulations/wizard">
                    {t("applied.startWizard")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applied?.jurisdictions.map((j) => {
                const reqStatus = statusByJurisdiction.get(j.jurisdictionId);
                return (
                  <Card key={j.id}>
                    <CardContent className="py-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {j.name}
                              {j.isPrimary && <Badge className="text-[10px]">{t("card.primary")}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("card.appliedSummary", { region: j.region, days: j.dsarDeadlineDays, hours: j.breachNotificationHours })}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            removeMutation.mutate({
                              organizationId: orgId,
                              jurisdictionId: j.jurisdictionId,
                            })
                          }
                          disabled={removeMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {reqStatus && reqStatus.requirements.length > 0 && (
                        <div className="border-t pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{t("checklist.headingPrefix")}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {t("checklist.summary", { satisfied: reqStatus.satisfiedCount, total: reqStatus.totalCount })}
                            </Badge>
                          </div>
                          <ul className="space-y-2">
                            {reqStatus.requirements.map((req) => {
                              const Icon =
                                req.status === "satisfied"
                                  ? CheckCircle2
                                  : req.status === "partial"
                                    ? Circle
                                    : CircleDashed;
                              const iconClass =
                                req.status === "satisfied"
                                  ? "text-green-500"
                                  : req.status === "partial"
                                    ? "text-amber-500"
                                    : "text-muted-foreground";
                              return (
                                <li key={req.id} className="flex items-start gap-3 text-sm">
                                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium leading-tight">{t(`checklist.req${req.id.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")}` as any)}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{req.detail}</p>
                                  </div>
                                  {req.status !== "satisfied" && (
                                    <Link href={req.actionHref} className="shrink-0">
                                      <Button variant="outline" size="sm" className="h-7 text-xs">
                                        {t("checklist.takeAction")}
                                        <ArrowRight className="w-3 h-3 ml-1" />
                                      </Button>
                                    </Link>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ExpertHelpCta context="general" />
    </div>
  );
}

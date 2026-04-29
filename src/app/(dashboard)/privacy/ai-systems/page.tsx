"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bot,
  Search,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield,
  ExternalLink,
  Send,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { useDebounce } from "@/hooks/use-debounce";
import { features } from "@/config/features";

const RISK_COLORS: Record<string, string> = {
  UNACCEPTABLE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  HIGH_RISK: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  LIMITED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  MINIMAL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const STATUS_VARIANTS: Record<string, { className: string; variant?: "secondary" | "outline" }> = {
  DRAFT: { className: "", variant: "secondary" },
  REGISTERED: { className: "bg-blue-100 text-blue-800" },
  UNDER_REVIEW: { className: "bg-yellow-100 text-yellow-800" },
  COMPLIANT: { className: "bg-green-100 text-green-800" },
  NON_COMPLIANT: { className: "bg-red-100 text-red-800" },
  DECOMMISSIONED: { className: "", variant: "outline" },
};

export default function AISystemsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.aiSystems");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 300);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);

  const {
    data: pages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.aiGovernance.list.useInfiniteQuery(
    {
      organizationId: orgId,
      search: debouncedSearch || undefined,
      riskLevel: riskFilter !== "all" ? riskFilter as "UNACCEPTABLE" | "HIGH_RISK" | "LIMITED" | "MINIMAL" : undefined,
      status: statusFilter !== "all" ? statusFilter as "DRAFT" | "REGISTERED" | "UNDER_REVIEW" | "COMPLIANT" | "NON_COMPLIANT" | "DECOMMISSIONED" : undefined,
      limit: 100,
    },
    {
      enabled: !!orgId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const data = useMemo(
    () => ({ systems: pages?.pages.flatMap((p) => p.systems) ?? [] }),
    [pages]
  );

  const { data: stats } = trpc.aiGovernance.getStats.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const { data: aisConnection } = trpc.aiGovernance.checkAiSentinelConnection.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId && features.aiSentinelIntegrationEnabled }
  );

  const exportMutation = trpc.aiGovernance.exportToAiSentinel.useMutation({
    onSuccess: (result) => {
      toast.success(t("aiSystem.sentToSentinel", { count: result.exported }));
      setExportDialogOpen(false);
      setSelectedExportIds([]);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const showAisExport = features.aiSentinelIntegrationEnabled && aisConnection?.configured;

  function toggleExportId(id: string) {
    setSelectedExportIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            {tp("title")}
          </h1>
          <p className="text-muted-foreground">{tp("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {showAisExport && (
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (data?.systems) {
                      setSelectedExportIds(
                        data.systems
                          .filter((s) => !s.aiSentinelSystemId)
                          .map((s) => s.id)
                      );
                    }
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {tp("sentinel.send")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{tp("sentinel.title")}</DialogTitle>
                  <DialogDescription>
                    {tp("sentinel.description")}
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[300px] overflow-y-auto space-y-2 py-2">
                  {data?.systems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{tp("sentinel.noSystems")}</p>
                  )}
                  {data?.systems.every((s) => s.aiSentinelSystemId) && (data?.systems.length ?? 0) > 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">{tp("sentinel.allSynced")}</p>
                  )}
                  {data?.systems.map((system) => (
                    <label
                      key={system.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedExportIds.includes(system.id)}
                        onCheckedChange={() => toggleExportId(system.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{system.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={`text-[10px] ${RISK_COLORS[system.riskLevel] ?? ""}`}>
                            {tp(`riskLevel.${system.riskLevel}` as `riskLevel.UNACCEPTABLE` | `riskLevel.HIGH_RISK` | `riskLevel.LIMITED` | `riskLevel.MINIMAL`)}
                          </Badge>
                          {system.aiSentinelSystemId && (
                            <span className="text-[10px] text-green-600 flex items-center gap-1">
                              <Shield className="w-3 h-3" /> {tp("sentinel.alreadySynced")}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setExportDialogOpen(false)}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    onClick={() => exportMutation.mutate({
                      organizationId: orgId,
                      systemIds: selectedExportIds,
                    })}
                    disabled={selectedExportIds.length === 0 || exportMutation.isPending}
                  >
                    {exportMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {tp("sentinel.sending")}</>
                    ) : (
                      tp("sentinel.sendCount", { count: selectedExportIds.length })
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button asChild>
            <Link href="/privacy/ai-systems/register">
              <Plus className="w-4 h-4 mr-2" />
              {tp("register")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">{tp("stats.total")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.byRiskLevel.UNACCEPTABLE ?? 0}</div>
              <div className="text-xs text-muted-foreground">{tp("stats.unacceptable")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.byRiskLevel.HIGH_RISK ?? 0}</div>
              <div className="text-xs text-muted-foreground">{tp("stats.highRisk")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.byRiskLevel.LIMITED ?? 0}</div>
              <div className="text-xs text-muted-foreground">{tp("stats.limited")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.byRiskLevel.MINIMAL ?? 0}</div>
              <div className="text-xs text-muted-foreground">{tp("stats.minimal")}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tp("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={tp("filter.riskLevel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tp("filter.allRisks")}</SelectItem>
            <SelectItem value="UNACCEPTABLE">{tp("riskLevel.UNACCEPTABLE")}</SelectItem>
            <SelectItem value="HIGH_RISK">{tp("riskLevel.HIGH_RISK")}</SelectItem>
            <SelectItem value="LIMITED">{tp("riskLevel.LIMITED")}</SelectItem>
            <SelectItem value="MINIMAL">{tp("riskLevel.MINIMAL")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={tp("filter.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tp("filter.allStatus")}</SelectItem>
            <SelectItem value="DRAFT">{tp("status.DRAFT")}</SelectItem>
            <SelectItem value="REGISTERED">{tp("status.REGISTERED")}</SelectItem>
            <SelectItem value="COMPLIANT">{tp("status.COMPLIANT")}</SelectItem>
            <SelectItem value="NON_COMPLIANT">{tp("status.NON_COMPLIANT")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* System List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : data?.systems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">{tp("empty.title")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {tp("empty.subtitle")}
            </p>
            <Button asChild>
              <Link href="/privacy/ai-systems/register">
                <Plus className="w-4 h-4 mr-2" /> {tp("register")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {data?.systems.map((system) => (
            <Link key={system.id} href={`/privacy/ai-systems/${system.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{system.name}</span>
                        <Badge className={RISK_COLORS[system.riskLevel] ?? ""}>
                          {tp(`riskLevel.${system.riskLevel}` as `riskLevel.UNACCEPTABLE` | `riskLevel.HIGH_RISK` | `riskLevel.LIMITED` | `riskLevel.MINIMAL`)}
                        </Badge>
                        {(() => {
                          const v = STATUS_VARIANTS[system.status];
                          return v ? (
                            <Badge variant={v.variant} className={v.className}>
                              {tp(`status.${system.status}` as `status.DRAFT` | `status.REGISTERED` | `status.UNDER_REVIEW` | `status.COMPLIANT` | `status.NON_COMPLIANT` | `status.DECOMMISSIONED`)}
                            </Badge>
                          ) : null;
                        })()}
                        {system.aiSentinelSystemId && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400" title="Synced with AI Sentinel">
                            <Shield className="w-3 h-3" />
                            AIS
                          </span>
                        )}
                      </div>
                      {system.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {system.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {system.provider && <span>{tp("card.provider", { value: system.provider })}</span>}
                        {system.modelType && <span>{tp("card.type", { value: system.modelType })}</span>}
                        {system.vendor && <span>{tp("card.vendor", { value: system.vendor.name })}</span>}
                        {system.category && <span>{tp("card.category", { value: system.category })}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ExpertHelpCta context="assessment" />
    </div>
  );
}

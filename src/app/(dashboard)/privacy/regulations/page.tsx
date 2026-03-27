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
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ExpertHelpCta } from "@/components/privacy/expert-help-cta";
import { useDebounce } from "@/hooks/use-debounce";

export default function RegulationsPage() {
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
            Regulation Hub
          </h1>
          <p className="text-muted-foreground">
            Track applicable privacy regulations and compliance requirements
          </p>
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
            <span className="hidden sm:inline">Export Report</span>
          </Button>
          <Button asChild>
            <Link href="/privacy/regulations/wizard">
              <Globe className="w-4 h-4 mr-2" />
              Applicability Wizard
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Jurisdiction Catalog</TabsTrigger>
          <TabsTrigger value="applied">
            Applied ({applied?.jurisdictions.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search regulations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="comprehensive">Comprehensive</SelectItem>
                <SelectItem value="sectoral">Sectoral</SelectItem>
                <SelectItem value="ai_governance">AI Governance</SelectItem>
                <SelectItem value="emerging">Emerging</SelectItem>
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
                          <Badge className="text-xs bg-primary">Applied</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{j.description}</p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        DSAR: {j.dsarDeadlineDays}d
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Breach: {j.breachNotificationHours}h
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
                          +{j.keyRequirements.length - 2} more
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
                        <Plus className="w-3 h-3 mr-1" /> Apply
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="w-full text-muted-foreground" disabled>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Applied
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
                <h3 className="font-medium mb-2">No jurisdictions applied</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Use the Applicability Wizard to determine which regulations apply to your organization
                </p>
                <Button asChild>
                  <Link href="/privacy/regulations/wizard">
                    Start Wizard <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applied?.jurisdictions.map((j) => (
                <Card key={j.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {j.name}
                            {j.isPrimary && <Badge className="text-[10px]">Primary</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {j.region} | DSAR: {j.dsarDeadlineDays} days | Breach: {j.breachNotificationHours}h
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ExpertHelpCta context="general" />
    </div>
  );
}

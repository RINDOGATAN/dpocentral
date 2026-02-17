"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck,
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useDebounce } from "@/hooks/use-debounce";

const statusColors: Record<string, string> = {
  DRAFT: "border-muted-foreground text-muted-foreground",
  IN_PROGRESS: "border-primary text-primary",
  PENDING_REVIEW: "border-muted-foreground text-muted-foreground",
  PENDING_APPROVAL: "border-muted-foreground text-muted-foreground",
  APPROVED: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-muted-foreground text-muted-foreground",
};

const riskColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-muted-foreground bg-muted-foreground/20 text-foreground",
  CRITICAL: "border-muted-foreground bg-muted-foreground text-foreground",
};

const typeLabels: Record<string, string> = {
  DPIA: "DPIA",
  PIA: "PIA",
  TIA: "TIA",
  LIA: "LIA",
  VENDOR: "Vendor",
  CUSTOM: "Custom",
};

export default function AssessmentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const [activeTab, setActiveTab] = useState("all");
  const { organization } = useOrganization();

  const { data: assessmentsData, isLoading } = trpc.assessment.list.useQuery(
    { organizationId: organization?.id ?? "", search: debouncedSearch || undefined },
    { enabled: !!organization?.id }
  );

  const { data: templatesData } = trpc.assessment.listTemplates.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: statsData } = trpc.assessment.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const assessments = assessmentsData?.assessments ?? [];
  const templates = templatesData ?? [];

  const byStatus = statsData?.byStatus as Record<string, number> | undefined;
  const byRiskLevel = statsData?.byRiskLevel as Record<string, number> | undefined;
  const inProgressCount = (byStatus?.DRAFT ?? 0) + (byStatus?.IN_PROGRESS ?? 0);
  const pendingReviewCount = (byStatus?.PENDING_REVIEW ?? 0) + (byStatus?.PENDING_APPROVAL ?? 0);
  const highRiskCount = (byRiskLevel?.HIGH ?? 0) + (byRiskLevel?.CRITICAL ?? 0);

  const filteredAssessments = (() => {
    switch (activeTab) {
      case "dpia":
        return assessments.filter((a) => a.template?.type === "DPIA");
      case "vendor":
        return assessments.filter((a) => a.template?.type === "VENDOR");
      case "tia":
        return assessments.filter((a) => a.template?.type === "TIA");
      default:
        return assessments;
    }
  })();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Privacy impact assessments and vendor evaluations
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/privacy/assessments/templates" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto">
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
          </Link>
          <Link href="/privacy/assessments/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Assessment</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-primary">{assessments.length}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Assessments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-primary">{inProgressCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-primary">{pendingReviewCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {highRiskCount > 0 ? (
                <span className="bg-destructive/20 px-2 py-0.5">{highRiskCount}</span>
              ) : (
                <span className="text-primary">0</span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">High Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search assessments..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="dpia">DPIA</TabsTrigger>
          <TabsTrigger value="vendor">Vendor</TabsTrigger>
          <TabsTrigger value="tia">TIA</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Assessment List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredAssessments.length > 0 ? (
        <div className="space-y-3">
          {filteredAssessments.map((assessment) => (
            <Link key={assessment.id} href={`/privacy/assessments/${assessment.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  {/* Mobile Layout - Stacked */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{assessment.name}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${statusColors[assessment.status] || ""}`}>
                        {assessment.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[assessment.template?.type ?? ""] || assessment.template?.type}
                      </Badge>
                      {assessment.riskLevel && (
                        <Badge variant="outline" className={`text-xs ${riskColors[assessment.riskLevel] || ""}`}>
                          {assessment.riskLevel} Risk
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {assessment.template?.name || "Unknown"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{assessment._count?.responses ?? 0} responses</span>
                      <span>
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(assessment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Layout - Horizontal */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className={`w-10 h-10 flex items-center justify-center border-2 shrink-0 ${
                      assessment.status === "APPROVED" ? "border-primary bg-primary" :
                      assessment.status === "PENDING_APPROVAL" ? "border-muted-foreground" :
                      "border-primary"
                    }`}>
                      {assessment.status === "APPROVED" ? (
                        <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                      ) : assessment.status === "PENDING_APPROVAL" ? (
                        <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ClipboardCheck className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{assessment.name}</span>
                        <Badge variant="outline">{typeLabels[assessment.template?.type ?? ""] || assessment.template?.type}</Badge>
                        <Badge variant="outline" className={statusColors[assessment.status] || ""}>
                          {assessment.status.replace("_", " ")}
                        </Badge>
                        {assessment.riskLevel && (
                          <Badge variant="outline" className={riskColors[assessment.riskLevel] || ""}>
                            {assessment.riskLevel} Risk
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Template: {assessment.template?.name || "Unknown"}
                      </p>
                    </div>

                    <div className="text-center shrink-0">
                      <p className="text-lg font-semibold text-primary">
                        {assessment._count?.responses ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Responses</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline w-3 h-3 mr-1" />
                        {new Date(assessment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : activeTab === "all" ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No assessments yet</p>
            <p className="text-sm mb-4">Start your first privacy impact assessment</p>
            <Link href="/privacy/assessments/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Assessment
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {activeTab === "dpia" && "No DPIA assessments"}
              {activeTab === "vendor" && "No vendor assessments"}
              {activeTab === "tia" && "No TIA assessments"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Start Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Start Templates</CardTitle>
          <CardDescription>Start a new assessment from a template</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[
              { type: "LIA", name: "Legitimate Interest Assessment", premium: false },
              { type: "CUSTOM", name: "Custom Assessment", premium: false },
              { type: "DPIA", name: "Data Protection Impact Assessment", premium: true },
            ].map((item) => (
              <Link key={item.type} href={`/privacy/assessments/new?type=${item.type}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{item.type}</Badge>
                      {item.premium && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="w-3 h-3" />
                          Premium
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {templates.find((t) => t.type === item.type)
                        ? `${(templates.find((t) => t.type === item.type)!.sections as any[])?.length || 0} sections`
                        : "System template"}
                    </p>
                    <Button variant="ghost" size="sm" className="mt-2 w-full">
                      Use Template <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

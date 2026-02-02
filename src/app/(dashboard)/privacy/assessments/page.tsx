"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck,
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

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
  const { organization } = useOrganization();

  const { data: assessmentsData, isLoading } = trpc.assessment.list.useQuery(
    { organizationId: organization?.id ?? "" },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assessments</h1>
          <p className="text-muted-foreground">
            Privacy impact assessments and vendor evaluations
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/privacy/assessments/templates">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
          </Link>
          <Link href="/privacy/assessments/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Assessment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{assessments.length}</div>
            <p className="text-sm text-muted-foreground">Total Assessments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{inProgressCount}</div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{pendingReviewCount}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">
              {highRiskCount > 0 ? (
                <span className="bg-destructive/20 px-2 py-0.5">{highRiskCount}</span>
              ) : (
                <span className="text-primary">0</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">High Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assessments..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Assessments</TabsTrigger>
          <TabsTrigger value="dpia">DPIA</TabsTrigger>
          <TabsTrigger value="vendor">Vendor</TabsTrigger>
          <TabsTrigger value="tia">TIA</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : assessments.length > 0 ? (
            assessments.map((assessment) => (
              <Link key={assessment.id} href={`/privacy/assessments/${assessment.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-6">
                      {/* Icon */}
                      <div className={`w-10 h-10 flex items-center justify-center border-2 ${
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

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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

                      {/* Responses */}
                      <div className="text-center">
                        <p className="text-lg font-semibold text-primary">
                          {assessment._count?.responses ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Responses</p>
                      </div>

                      {/* Date */}
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          <Clock className="inline w-3 h-3 mr-1" />
                          {new Date(assessment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
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
          )}
        </TabsContent>

        <TabsContent value="dpia" className="mt-4">
          <p className="text-muted-foreground">DPIA assessments will be filtered here</p>
        </TabsContent>

        <TabsContent value="vendor" className="mt-4">
          <p className="text-muted-foreground">Vendor assessments will be filtered here</p>
        </TabsContent>

        <TabsContent value="tia" className="mt-4">
          <p className="text-muted-foreground">TIA assessments will be filtered here</p>
        </TabsContent>
      </Tabs>

      {/* Quick Start Templates */}
      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Start Templates</CardTitle>
            <CardDescription>Start a new assessment from a template</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {templates.slice(0, 3).map((template) => (
                <Card key={template.id} className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{template.type}</Badge>
                      {template.isSystem && (
                        <Badge variant="secondary">System</Badge>
                      )}
                    </div>
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(template.sections as any[])?.length || 0} sections
                    </p>
                    <Button variant="ghost" size="sm" className="mt-2 w-full">
                      Use Template <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

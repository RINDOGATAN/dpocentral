"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Settings,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const statusColors: Record<string, string> = {
  SUBMITTED: "border-primary text-primary",
  IDENTITY_PENDING: "border-muted-foreground text-muted-foreground",
  IDENTITY_VERIFIED: "border-primary text-primary",
  IN_PROGRESS: "border-primary text-primary",
  DATA_COLLECTED: "border-primary text-primary",
  REVIEW_PENDING: "border-muted-foreground text-muted-foreground",
  COMPLETED: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-muted-foreground text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  ACCESS: "Access",
  RECTIFICATION: "Rectification",
  ERASURE: "Erasure",
  PORTABILITY: "Portability",
  OBJECTION: "Objection",
  RESTRICTION: "Restriction",
};

export default function DSARPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();

  const { data: dsarData, isLoading } = trpc.dsar.list.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: statsData } = trpc.dsar.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const requests = dsarData?.requests ?? [];
  const byStatus = statsData?.byStatus as Record<string, number> | undefined;
  const stats = {
    total: statsData?.total ?? 0,
    open: (byStatus?.SUBMITTED ?? 0) +
          (byStatus?.IDENTITY_PENDING ?? 0) +
          (byStatus?.IDENTITY_VERIFIED ?? 0) +
          (byStatus?.IN_PROGRESS ?? 0) +
          (byStatus?.DATA_COLLECTED ?? 0) +
          (byStatus?.REVIEW_PENDING ?? 0),
    overdue: statsData?.overdue ?? 0,
    atRisk: 0,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Data Subject Requests</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track DSARs
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/privacy/dsar/settings" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto">
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
          <Button className="flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">New Request</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Stats - 2x2 on mobile */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-primary">{stats.open}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className={stats.overdue > 0 ? "border-muted-foreground" : ""}>
          <CardContent className="p-4 sm:pt-6">
            <div className={`text-xl sm:text-2xl font-bold ${stats.overdue > 0 ? "text-foreground" : "text-primary"}`}>
              {stats.overdue > 0 && <span className="bg-destructive/20 px-2 py-0.5">{stats.overdue}</span>}
              {stats.overdue === 0 && stats.overdue}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="text-xl sm:text-2xl font-bold text-primary">{stats.atRisk}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">At Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0 sm:hidden">
          <Filter className="w-4 h-4" />
        </Button>
        <Button variant="outline" className="shrink-0 hidden sm:flex">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Request List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((request) => (
            <Link key={request.id} href={`/privacy/dsar/${request.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  {/* Mobile Layout - Stacked */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium font-mono text-primary text-sm">{request.publicId}</span>
                        <Badge variant="outline" className="text-xs">{typeLabels[request.type] || request.type}</Badge>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${statusColors[request.status] || ""}`}>
                        {request.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {request.requesterName} - {request.requesterEmail}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{request._count?.tasks ?? 0} tasks</span>
                      <span className={request.slaStatus === "overdue" ? "bg-destructive/20 text-foreground px-1.5 py-0.5" : ""}>
                        <Clock className="inline h-3 w-3 mr-1" />
                        {request.slaStatus === "overdue"
                          ? `${Math.abs(request.daysUntilDue ?? 0)}d overdue`
                          : request.daysUntilDue === 0
                            ? "Due today"
                            : `${request.daysUntilDue ?? 0}d left`
                        }
                      </span>
                    </div>
                  </div>

                  {/* Desktop Layout - Horizontal */}
                  <div className="hidden sm:flex items-center gap-6">
                    <div className={`w-10 h-10 flex items-center justify-center border-2 shrink-0 ${
                      request.slaStatus === "overdue"
                        ? "border-muted-foreground bg-muted-foreground/20"
                        : request.status === "COMPLETED"
                          ? "border-primary bg-primary"
                          : "border-primary"
                    }`}>
                      {request.slaStatus === "overdue" ? (
                        <AlertTriangle className="w-5 h-5 text-foreground" />
                      ) : request.status === "COMPLETED" ? (
                        <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                      ) : (
                        <Clock className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium font-mono text-primary">{request.publicId}</span>
                        <Badge variant="outline">{typeLabels[request.type] || request.type}</Badge>
                        <Badge variant="outline" className={statusColors[request.status] || ""}>
                          {request.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {request.requesterName} - {request.requesterEmail}
                      </p>
                    </div>

                    <div className="text-center shrink-0">
                      <p className="text-lg font-semibold text-primary">
                        {request._count?.tasks ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Tasks</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        {request.slaStatus === "overdue"
                          ? <span className="bg-destructive/20 text-foreground px-1.5 py-0.5">{Math.abs(request.daysUntilDue ?? 0)} days overdue</span>
                          : request.daysUntilDue === 0
                            ? "Due today"
                            : `${request.daysUntilDue ?? 0} days left`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {request.dueDate ? new Date(request.dueDate).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No data subject requests yet</p>
            <p className="text-sm mb-4">Create a request or set up a public intake form</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Public Portal Link */}
      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm sm:text-base">Public Intake Portal</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Share this link with data subjects
            </p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Portal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

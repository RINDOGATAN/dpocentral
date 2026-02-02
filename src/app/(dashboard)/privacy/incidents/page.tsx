"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Plus,
  Search,
  Clock,
  Shield,
  Bell,
  Filter,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const severityColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-muted-foreground bg-muted-foreground/20 text-foreground",
  CRITICAL: "border-muted-foreground bg-muted-foreground text-foreground",
};

const statusColors: Record<string, string> = {
  REPORTED: "border-primary text-primary",
  INVESTIGATING: "border-primary text-primary",
  CONTAINED: "border-muted-foreground text-muted-foreground",
  ERADICATED: "border-primary text-primary",
  RECOVERING: "border-muted-foreground text-muted-foreground",
  CLOSED: "border-primary bg-primary text-primary-foreground",
  FALSE_POSITIVE: "border-muted-foreground text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  DATA_BREACH: "Data Breach",
  UNAUTHORIZED_ACCESS: "Unauthorized Access",
  DATA_LOSS: "Data Loss",
  SYSTEM_COMPROMISE: "System Compromise",
  PHISHING: "Phishing",
  RANSOMWARE: "Ransomware",
  INSIDER_THREAT: "Insider Threat",
  PHYSICAL_SECURITY: "Physical Security",
  VENDOR_INCIDENT: "Vendor Incident",
  OTHER: "Other",
};

export default function IncidentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();

  const { data: incidentsData, isLoading } = trpc.incident.list.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: statsData } = trpc.incident.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const incidents = incidentsData?.incidents ?? [];
  const bySeverity = statsData?.bySeverity as Record<string, number> | undefined;
  const stats = {
    total: statsData?.total ?? 0,
    open: statsData?.open ?? 0,
    critical: bySeverity?.CRITICAL ?? 0,
    pendingNotification: statsData?.overdueNotifications ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Incident Management</h1>
          <p className="text-muted-foreground">
            Track and respond to security incidents and data breaches
          </p>
        </div>
        <Link href="/privacy/incidents/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Report Incident
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Incidents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.open}</div>
            <p className="text-sm text-muted-foreground">Open Incidents</p>
          </CardContent>
        </Card>
        <Card className={stats.critical > 0 ? "border-muted-foreground" : ""}>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${stats.critical > 0 ? "text-foreground" : "text-primary"}`}>
              {stats.critical > 0 && <span className="bg-destructive/20 px-2 py-0.5">{stats.critical}</span>}
              {stats.critical === 0 && stats.critical}
            </div>
            <p className="text-sm text-muted-foreground">Critical Severity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.pendingNotification}</div>
            <p className="text-sm text-muted-foreground">Pending Notification</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents..."
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

      {/* Incident List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : incidents.length > 0 ? (
        <div className="space-y-4">
          {incidents.map((incident) => (
            <Link key={incident.id} href={`/privacy/incidents/${incident.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center gap-6">
                    {/* Severity Icon */}
                    <div className={`w-10 h-10 flex items-center justify-center border-2 ${
                      incident.severity === "CRITICAL" ? "border-muted-foreground bg-muted-foreground/30" :
                      incident.severity === "HIGH" ? "border-muted-foreground bg-muted-foreground/20" :
                      incident.severity === "MEDIUM" ? "border-muted-foreground" :
                      "border-primary"
                    }`}>
                      {incident.severity === "CRITICAL" || incident.severity === "HIGH" ? (
                        <AlertTriangle className="w-5 h-5 text-foreground" />
                      ) : (
                        <AlertCircle className={`w-5 h-5 ${
                          incident.severity === "MEDIUM" ? "text-muted-foreground" : "text-primary"
                        }`} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium font-mono text-primary">{incident.publicId}</span>
                        <Badge variant="outline">{typeLabels[incident.type] || incident.type}</Badge>
                        <Badge variant="outline" className={severityColors[incident.severity] || ""}>
                          {incident.severity}
                        </Badge>
                        <Badge variant="outline" className={statusColors[incident.status] || ""}>
                          {incident.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {incident.title}
                      </p>
                    </div>

                    {/* Affected Records */}
                    <div className="text-center">
                      <p className="text-lg font-semibold text-primary">
                        {incident.affectedRecords?.toLocaleString() ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Records</p>
                    </div>

                    {/* Discovery Time */}
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline w-3 h-3 mr-1" />
                        {new Date(incident.discoveredAt).toLocaleDateString()}
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
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No incidents reported</p>
            <p className="text-sm mb-4">Report security incidents and data breaches here</p>
            <Link href="/privacy/incidents/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Report Incident
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response Resources</CardTitle>
          <CardDescription>Quick access to incident response tools</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button variant="outline">
            <Shield className="w-4 h-4 mr-2" />
            Incident Response Plan
          </Button>
          <Button variant="outline">
            <Bell className="w-4 h-4 mr-2" />
            DPA Notification Templates
          </Button>
          <Button variant="outline">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Breach Assessment Checklist
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

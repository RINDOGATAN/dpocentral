"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Search,
  FileSpreadsheet,
  Download,
  Loader2,
  Scale,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const legalBasisLabels: Record<string, string> = {
  CONSENT: "Consent",
  CONTRACT: "Contract",
  LEGAL_OBLIGATION: "Legal Obligation",
  VITAL_INTERESTS: "Vital Interests",
  PUBLIC_TASK: "Public Task",
  LEGITIMATE_INTERESTS: "Legitimate Interests",
};

const legalBasisColors: Record<string, string> = {
  CONSENT: "border-primary text-primary",
  CONTRACT: "border-primary text-primary",
  LEGAL_OBLIGATION: "border-muted-foreground text-muted-foreground",
  VITAL_INTERESTS: "border-muted-foreground text-muted-foreground",
  PUBLIC_TASK: "border-muted-foreground text-muted-foreground",
  LEGITIMATE_INTERESTS: "border-primary text-primary",
};

export default function ProcessingActivitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();

  const { data: activitiesData, isLoading } = trpc.dataInventory.listActivities.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const activities = activitiesData?.activities ?? [];

  const filteredActivities = activities.filter(
    (activity) =>
      activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.purpose.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/data-inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Processing Activities</h1>
            <p className="text-muted-foreground">
              Record of Processing Activities (ROPA) for GDPR compliance
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export ROPA
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Activity
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{activities.length}</div>
            <p className="text-sm text-muted-foreground">Total Activities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {activities.filter((a) => a.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {activities.filter((a) => a.legalBasis === "CONSENT").length}
            </div>
            <p className="text-sm text-muted-foreground">Consent-Based</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {activities.filter((a) => a._count?.transfers && a._count.transfers > 0).length}
            </div>
            <p className="text-sm text-muted-foreground">With Transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Activities List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredActivities.length > 0 ? (
        <div className="space-y-4">
          {filteredActivities.map((activity) => (
            <Card key={activity.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start gap-6">
                  {/* Icon */}
                  <div className="w-10 h-10 border-2 border-primary flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium">{activity.name}</span>
                      <Badge
                        variant="outline"
                        className={legalBasisColors[activity.legalBasis] || ""}
                      >
                        <Scale className="w-3 h-3 mr-1" />
                        {legalBasisLabels[activity.legalBasis] || activity.legalBasis}
                      </Badge>
                      {!activity.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {activity.purpose}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{activity.assets?.length ?? 0} data assets</span>
                      <span>{(activity.dataSubjects as string[])?.length ?? 0} subject types</span>
                      <span>{(activity.categories as string[])?.length ?? 0} data categories</span>
                      {activity.retentionPeriod && (
                        <span>
                          <Clock className="inline w-3 h-3 mr-1" />
                          {activity.retentionPeriod}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Data Subjects */}
                  <div className="hidden md:block">
                    <p className="text-xs text-muted-foreground mb-1">Data Subjects</p>
                    <div className="flex flex-wrap gap-1">
                      {(activity.dataSubjects as string[])?.slice(0, 3).map((subject) => (
                        <Badge key={subject} variant="outline" className="text-xs">
                          {subject}
                        </Badge>
                      ))}
                      {(activity.dataSubjects as string[])?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(activity.dataSubjects as string[]).length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No processing activities found</p>
            <p className="text-sm mb-4">
              Document your data processing activities for ROPA compliance
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Activity
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ROPA Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About ROPA</CardTitle>
          <CardDescription>
            Record of Processing Activities requirements under GDPR Article 30
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <h4 className="font-medium mb-2">Required Information</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Name and contact details of controller</li>
                <li>Purposes of processing</li>
                <li>Categories of data subjects and personal data</li>
                <li>Categories of recipients</li>
                <li>Transfers to third countries</li>
                <li>Retention periods</li>
                <li>Security measures</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">When ROPA is Required</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Organizations with 250+ employees</li>
                <li>Processing likely to result in risk to rights</li>
                <li>Processing is not occasional</li>
                <li>Processing includes special category data</li>
                <li>Processing includes criminal conviction data</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

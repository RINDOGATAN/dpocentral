"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  Scale,
  Clock,
  Lock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { formatPrice } from "@/lib/currency";
import { formatDateIn } from "@/lib/utils";

const LEGAL_BASES = new Set([
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTERESTS",
  "PUBLIC_TASK",
  "LEGITIMATE_INTERESTS",
]);

const legalBasisColors: Record<string, string> = {
  CONSENT: "border-primary text-primary",
  CONTRACT: "border-primary text-primary",
  LEGAL_OBLIGATION: "border-muted-foreground text-muted-foreground",
  VITAL_INTERESTS: "border-muted-foreground text-muted-foreground",
  PUBLIC_TASK: "border-muted-foreground text-muted-foreground",
  LEGITIMATE_INTERESTS: "border-primary text-primary",
};

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatArray(arr: unknown): string {
  if (Array.isArray(arr)) return arr.join("; ");
  return String(arr ?? "");
}

export default function ProcessingActivitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { organization } = useOrganization();
  const t = useTranslations("pages.processingActivities");
  const tBasis = useTranslations("pages.dataInventory.legalBasis");
  const locale = useLocale();
  const basisLabel = (basis: string) => (LEGAL_BASES.has(basis) ? tBasis(basis) : basis);

  const { data: ropaAccess } = trpc.dataInventory.hasRopaExportAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );
  // The hosted pilot includes the export: no lock or price there.
  const hosted = useHostedPilot();
  const hasRopaAccess = hosted || (ropaAccess?.hasAccess ?? false);

  const { data: activitiesData, isLoading } = trpc.dataInventory.listActivities.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { refetch: fetchROPA } = trpc.dataInventory.exportROPA.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: false }
  );

  const activities = activitiesData?.activities ?? [];

  async function handleExport(format: "csv" | "json") {
    setIsExporting(true);
    try {
      const { data } = await fetchROPA();
      if (!data) return;

      let content: string;
      let mimeType: string;
      const ext = format;

      if (format === "csv") {
        const headers = [
          t("csv.name"), t("csv.description"), t("csv.purpose"), t("csv.legalBasis"),
          t("csv.legalBasisDetail"), t("csv.dataSubjects"), t("csv.dataCategories"),
          t("csv.recipients"), t("csv.retention"), t("csv.systems"),
          t("csv.transfers"), t("csv.lastReviewed"),
        ];
        const rows = data.map((entry) => [
          entry.name,
          entry.description ?? "",
          entry.purpose,
          entry.legalBasis,
          entry.legalBasisDetail ?? "",
          formatArray(entry.dataSubjects),
          formatArray(entry.dataCategories),
          formatArray(entry.recipients),
          entry.retentionPeriod ?? "",
          entry.systems.map((s) => s.name).join("; "),
          entry.transfers.map((t) => `${t.destination} (${t.mechanism})`).join("; "),
          entry.lastReviewed ? formatDateIn(entry.lastReviewed, locale) : "",
        ]);
        content = [
          headers.map(escapeCSV).join(","),
          ...rows.map((row) => row.map(escapeCSV).join(",")),
        ].join("\n");
        mimeType = "text/csv;charset=utf-8;";
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = "application/json;charset=utf-8;";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${t("csv.fileName")}-${organization?.name ?? "export"}-${date}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const filteredActivities = activities.filter(
    (activity) =>
      activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.purpose.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/privacy/data-inventory" className="shrink-0">
            <Button variant="ghost" size="icon" aria-label={t("back")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasRopaAccess ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {t("exportRopa")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.open(`/api/export/ropa?organizationId=${organization?.id}`, "_blank")}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t("downloadPdf")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {t("downloadCsv")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t("downloadJson")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" onClick={() => setUpgradeModalOpen(true)}>
              <Lock className="w-4 h-4 mr-2 text-amber-500" />
              {t("exportRopa")}
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{t("perMonth", { price: formatPrice(9) })}</Badge>
            </Button>
          )}
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {t("addActivity")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{activities.length}</div>
            <p className="text-sm text-muted-foreground">{t("stats.total")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {activities.filter((a) => a.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.active")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {activities.filter((a) => a.legalBasis === "CONSENT").length}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.consent")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {activities.filter((a) => a._count?.transfers && a._count.transfers > 0).length}
            </div>
            <p className="text-sm text-muted-foreground">{t("stats.transfers")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
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
        <div className="flex flex-col gap-4">
          {filteredActivities.map((activity) => (
            <Link key={activity.id} href={`/privacy/data-inventory/activities/${activity.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="hover:border-primary/50 transition-colors">
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
                          {basisLabel(activity.legalBasis)}
                        </Badge>
                        {!activity.isActive && (
                          <Badge variant="secondary">{t("inactive")}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {activity.purpose}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{t("assetsCount", { count: activity.assets?.length ?? 0 })}</span>
                        <span>{t("subjectTypesCount", { count: (activity.dataSubjects as string[])?.length ?? 0 })}</span>
                        <span>{t("categoriesCount", { count: (activity.categories as string[])?.length ?? 0 })}</span>
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
                      <p className="text-xs text-muted-foreground mb-1">{t("dataSubjects")}</p>
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
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("empty.title")}</p>
            <p className="text-sm mb-4">{t("empty.body")}</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t("addActivity")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ROPA Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("about.title")}</CardTitle>
          <CardDescription>{t("about.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <h4 className="font-medium mb-2">{t("about.requiredTitle")}</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{t("about.required.controller")}</li>
                <li>{t("about.required.purposes")}</li>
                <li>{t("about.required.categories")}</li>
                <li>{t("about.required.recipients")}</li>
                <li>{t("about.required.transfers")}</li>
                <li>{t("about.required.retention")}</li>
                <li>{t("about.required.security")}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">{t("about.whenTitle")}</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{t("about.when.employees")}</li>
                <li>{t("about.when.risk")}</li>
                <li>{t("about.when.notOccasional")}</li>
                <li>{t("about.when.specialCategory")}</li>
                <li>{t("about.when.criminal")}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ROPA Export Premium Gating */}
      <EnableFeatureModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        organizationId={organization?.id ?? ""}
        skillPackageId="skill-ropa-export"
        skillName={t("skillName")}
      />
    </div>
  );
}

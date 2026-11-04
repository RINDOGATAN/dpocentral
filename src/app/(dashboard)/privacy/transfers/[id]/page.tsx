"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, CheckCircle2, AlertTriangle, ShieldAlert, Clock, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { DeleteRecordButton } from "@/components/privacy/delete-record-button";
import { toneBorder, toneChip, toneMark, toneTint } from "@/config/status-palette";
import { formatDateIn } from "@/lib/utils";

/** The country's name in `locale` (Intl), or undefined when the runtime has none. */
function regionName(code: string, locale: string): string | undefined {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase());
  } catch {
    return undefined;
  }
}

const statusColors: Record<string, string> = {
  COMPLIANT: "border-primary text-primary bg-primary/5",
  NEEDS_REVIEW: `border-transparent ${toneChip("warning")}`,
  NON_COMPLIANT: `border-transparent ${toneChip("danger")}`,
  PENDING: "border-muted-foreground text-muted-foreground",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  COMPLIANT: CheckCircle2,
  NEEDS_REVIEW: Clock,
  NON_COMPLIANT: ShieldAlert,
  PENDING: Clock,
};

const STATUS_KEYS = ["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT", "PENDING"] as const;

export default function TransferDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const tMech = useTranslations("pages.dataInventory.mechanism");
  const t = useTranslations("pages.transfers.detail");
  const tStatus = useTranslations("pages.transfers.status_option");
  const tToasts = useTranslations("toasts");
  const tTransfers = useTranslations("pages.transfers.adequacy");
  const router = useRouter();
  const locale = useLocale();

  const utils = trpc.useUtils();
  const tConfirm = useTranslations("confirms");
  const deleteTransfer = trpc.dataInventory.deleteTransfer.useMutation({
    onSuccess: () => {
      toast.success(tToasts("transfer.deleted"));
      utils.dataInventory.listTransfers.invalidate();
      router.push("/privacy/transfers");
    },
    onError: (error) => toast.error(error.message || tToasts("generic.somethingWentWrong")),
  });

  const { data: checklistData, isLoading: checklistLoading } =
    trpc.dataInventory.getTransferComplianceChecklist.useQuery(
      { organizationId: orgId, transferId: id },
      { enabled: !!orgId && !!id }
    );

  const updateCompliance = trpc.dataInventory.updateTransferCompliance.useMutation({
    onSuccess: () => {
      utils.dataInventory.getTransferComplianceChecklist.invalidate({
        organizationId: orgId,
        transferId: id,
      });
      utils.dataInventory.listTransfers.invalidate();
      utils.dataInventory.getTransferStats.invalidate();
      toast.success(tToasts("transfer.complianceUpdated"));
    },
    onError: (e) => toast.error(e.message),
  });

  if (checklistLoading || !checklistData) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { transfer, isAdequateCountry, adequacyDecision, adequacyCoverage } = checklistData;
  const tAdq = tTransfers;

  // The recorded status; with none, the rules' suggestion, said so (the
  // list and the map do the same). The status controls follow the record.
  const recordedStatus = transfer.complianceStatus || null;
  const status = recordedStatus || transfer.suggestedStatus || "PENDING";
  // A partial adequacy decision (the US under the DPF) only matters to a
  // transfer that rests on it; one on standard clauses or another safeguard
  // is not told about it.
  const onAdequacy = transfer.mechanism === "ADEQUACY_DECISION";
  const StatusIcon = statusIcons[status] || Clock;

  const setStatus = (newStatus: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT" | "PENDING") => {
    updateCompliance.mutate({
      organizationId: orgId,
      id,
      complianceStatus: newStatus,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link href="/privacy/transfers">
            <Button variant="ghost" size="icon" aria-label={t("back")} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{transfer.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="outline">
                → {regionName(transfer.destinationCountry, locale) ?? transfer.destinationCountry} ({transfer.destinationCountry})
                {transfer.vendorName
                  ? ` · ${transfer.vendorName}`
                  : transfer.destinationOrg
                    ? ` · ${transfer.destinationOrg}`
                    : ""}
              </Badge>
              <Badge variant="outline">{tMech(transfer.mechanism as any)}</Badge>
              <Badge variant="outline" className={statusColors[status] || ""}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {(() => {
                  const label = STATUS_KEYS.includes(status as typeof STATUS_KEYS[number])
                    ? tStatus(status as typeof STATUS_KEYS[number])
                    : status;
                  return recordedStatus ? label : t("suggestedStatus", { status: label });
                })()}
              </Badge>
              {adequacyCoverage === "EEA" ? (
                <Badge variant="outline" className="border-primary text-primary" data-testid="coverage-badge">
                  {t("withinEea")}
                </Badge>
              ) : adequacyCoverage === "FULL" || adequacyCoverage === "PARTIAL_CONFIRMED" ? (
                <Badge variant="outline" className="border-primary text-primary" data-testid="coverage-badge">
                  {t("adequateCountry")}
                </Badge>
              ) : adequacyCoverage === "PARTIAL_UNCONFIRMED" && onAdequacy ? (
                <Badge variant="outline" className={`border-transparent ${toneChip("warning")}`} data-testid="coverage-badge">
                  {t("partialUnconfirmedBadge")}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground" data-testid="transfer-links">
              {transfer.processingActivityId ? (
                <Link href={`/privacy/data-inventory/activities/${transfer.processingActivityId}`} className="hover:underline">
                  {t("activityLink", { name: transfer.processingActivityName ?? "" })}
                </Link>
              ) : (
                t("noActivity")
              )}
              {" · "}
              {transfer.vendorId ? (
                <Link href={`/privacy/vendors/${transfer.vendorId}`} className="hover:underline">
                  {t("vendorLink", { name: transfer.vendorName ?? "" })}
                </Link>
              ) : (
                t("noVendor")
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Link href={`/privacy/transfers/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              {t("edit")}
            </Button>
          </Link>
          <DeleteRecordButton
            title={tConfirm("deleteTransferTitle")}
            description={tConfirm("deleteTransferDesc", { name: transfer.name })}
            pending={deleteTransfer.isPending}
            onConfirm={() => deleteTransfer.mutate({ organizationId: orgId, id })}
            testId="delete-transfer"
          />
        </div>
      </div>

      {/* Partial adequacy not recorded as covering this recipient */}
      {adequacyCoverage === "PARTIAL_UNCONFIRMED" && onAdequacy && adequacyDecision && (
        <Card className={`${toneBorder("warning")} ${toneTint("warning")}`} data-testid="partial-adequacy-notice">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${toneMark("warning")}`} />
            <div className="text-sm">
              <p className="font-medium">
                {tAdq("partialTitle", {
                  country: regionName(adequacyDecision.countryCode, locale) ?? adequacyDecision.country,
                })}
              </p>
              <p className="text-muted-foreground">
                {tAdq(`partialBody.${adequacyDecision.partialScope ?? "DPF"}` as "partialBody.DPF")}{" "}
                {t("partialUnconfirmedBody")}
              </p>
              <Link href={`/privacy/transfers/${id}/edit`} className="mt-1 inline-block underline">
                {t("recordScope")}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adequacy notice */}
      {isAdequateCountry && adequacyDecision && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t("adequacyTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("adequacyBody", {
                  country: regionName(adequacyDecision.countryCode, locale) ?? adequacyDecision.country,
                  date: formatDateIn(new Date(adequacyDecision.decisionDate), locale),
                })}
                {adequacyDecision.isPartial && (
                  <span className="block mt-1" data-testid="scope-recorded">
                    {tAdq(`scopeRecorded.${adequacyDecision.partialScope ?? "DPF"}` as "scopeRecorded.DPF")}
                    {transfer.adequacyScopeCheckedAt
                      ? ` ${t("scopeCheckedOn", { date: formatDateIn(new Date(transfer.adequacyScopeCheckedAt), locale) })}`
                      : ""}
                    {transfer.adequacyScopeReference ? ` ${t("scopeReference", { reference: transfer.adequacyScopeReference })}` : ""}
                  </span>
                )}
                {adequacyDecision.notes && (
                  <span className="block mt-1 italic">
                    {t.has(`adequacyNotes.${adequacyDecision.countryCode}`)
                      ? t(`adequacyNotes.${adequacyDecision.countryCode}` as "adequacyNotes.US")
                      : adequacyDecision.notes}
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance status controls */}
      <Card>
        <CardHeader>
          <CardTitle>{t("complianceStatus")}</CardTitle>
          <CardDescription>
            {recordedStatus && recordedStatus !== checklistData.transfer.suggestedStatus &&
              checklistData.transfer.suggestedStatus && (
                <span className="text-foreground">
                  {t.rich("suggestedFromData", {
                    status: tStatus(checklistData.transfer.suggestedStatus as typeof STATUS_KEYS[number]),
                    b: (chunks) => <strong>{chunks}</strong>,
                  })}
                </span>
              )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STATUS_KEYS.map((s) => (
            <Button
              key={s}
              variant={recordedStatus === s ? "default" : "outline"}
              size="sm"
              disabled={updateCompliance.isPending}
              onClick={() => setStatus(s)}
            >
              {tStatus(s)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* SCC expiry warning */}
      {transfer.sccExpiryDate && (
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 ${toneMark("warning")}`} />
            <div className="text-sm">
              <span className="font-medium">
                {t("sccExpires", {
                  date: formatDateIn(new Date(transfer.sccExpiryDate), locale),
                })}
              </span>{" "}
              {(() => {
                const days = Math.ceil(
                  (new Date(transfer.sccExpiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                );
                if (days <= 0) return t("sccExpired");
                if (days <= 30) return t("sccExpiringSoon", { count: days });
                return t("sccRemaining", { count: days });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

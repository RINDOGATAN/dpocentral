"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Globe,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Edit,
  ExternalLink,
  ArrowRight,
  Loader2,
  ClipboardCheck,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useOrgRole } from "@/lib/use-org-role";
import { DeleteRecordButton } from "@/components/privacy/delete-record-button";
import { toneBorder, toneChip, toneMark, toneTint } from "@/config/status-palette";
import { formatDateIn } from "@/lib/utils";
import {
  CHECKLIST_STATES,
  checklistSection,
  checklistTarget,
  pendingChecklistItems,
  type ChecklistAnswers,
  type ChecklistState,
} from "@/lib/transfer-checklist";

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
  const tInv = useTranslations("pages.dataInventory");
  const tTransfers = useTranslations("pages.transfers.adequacy");
  const router = useRouter();
  const { canWrite } = useOrgRole();
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

  const createTia = trpc.assessment.createForTransfer.useMutation({
    onSuccess: (assessment) => router.push(`/privacy/assessments/${assessment.id}`),
    onError: (e) => toast.error(e.message),
  });

  const updateChecklistItem = trpc.dataInventory.updateTransferChecklistItem.useMutation({
    onSuccess: () => {
      utils.dataInventory.getTransferComplianceChecklist.invalidate({
        organizationId: orgId,
        transferId: id,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const [openChecklistItem, setOpenChecklistItem] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  if (checklistLoading || !checklistData) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { transfer, isAdequateCountry, adequacyDecision, adequacyCoverage, checklist, supplementaryMeasures } =
    checklistData;
  const checklistAnswers = (checklistData.checklistAnswers ?? {}) as ChecklistAnswers;
  const pendingItems = pendingChecklistItems(
    checklist.map((item) => item.id),
    checklistAnswers
  );
  const tAdq = tTransfers;

  // The texts of a checklist item or measure in the reader's language; the
  // English of the rules file only when a translation is missing.
  const itemQuestion = (item: { id: string; question: string }) =>
    t.has(`checklistItems.${item.id}.question` as "checklistItems.s2_1_map_transfers.question")
      ? t(`checklistItems.${item.id}.question` as "checklistItems.s2_1_map_transfers.question")
      : item.question;
  const itemHelp = (item: { id: string; helpText: string }) =>
    t.has(`checklistItems.${item.id}.help` as "checklistItems.s2_1_map_transfers.help")
      ? t(`checklistItems.${item.id}.help` as "checklistItems.s2_1_map_transfers.help")
      : item.helpText;
  const measureName = (m: { id: string; name: string }) =>
    t.has(`measures.${m.id}.name` as "measures.tech_encryption_transit.name")
      ? t(`measures.${m.id}.name` as "measures.tech_encryption_transit.name")
      : m.name;
  const measureDescription = (m: { id: string; description: string }) =>
    t.has(`measures.${m.id}.description` as "measures.tech_encryption_transit.description")
      ? t(`measures.${m.id}.description` as "measures.tech_encryption_transit.description")
      : m.description;

  const answerItem = (itemId: string, state: ChecklistState, note?: string) => {
    updateChecklistItem.mutate({
      organizationId: orgId,
      id,
      itemId,
      state,
      ...(note !== undefined ? { note } : checklistAnswers[itemId]?.note ? { note: checklistAnswers[itemId].note } : {}),
    });
  };

  const tiaHref = transfer.tia
    ? `/privacy/assessments/${transfer.tia.id}`
    : `/privacy/assessments/new?type=TIA&transferId=${id}`;
  const targetHref: Record<string, string> = {
    transfers: "/privacy/transfers",
    edit: `/privacy/transfers/${id}/edit`,
    measures: "#supplementary-measures",
    tia: tiaHref,
  };

  const supplementaryMeasuresObj = (transfer.supplementaryMeasures as Record<string, boolean> | null) ?? {};
  const enabledMeasures = Object.keys(supplementaryMeasuresObj).filter(
    (k) => supplementaryMeasuresObj[k]
  );
  const status = transfer.complianceStatus || "PENDING";
  const StatusIcon = statusIcons[status] || Clock;

  const toggleMeasure = (measureId: string) => {
    const next = { ...supplementaryMeasuresObj, [measureId]: !supplementaryMeasuresObj[measureId] };
    updateCompliance.mutate({
      organizationId: orgId,
      id,
      supplementaryMeasures: next,
    });
  };

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
                {STATUS_KEYS.includes(status as typeof STATUS_KEYS[number])
                  ? tStatus(status as typeof STATUS_KEYS[number])
                  : status}
              </Badge>
              {adequacyCoverage === "EEA" ? (
                <Badge variant="outline" className="border-primary text-primary" data-testid="coverage-badge">
                  {t("withinEea")}
                </Badge>
              ) : adequacyCoverage === "FULL" || adequacyCoverage === "PARTIAL_CONFIRMED" ? (
                <Badge variant="outline" className="border-primary text-primary" data-testid="coverage-badge">
                  {t("adequateCountry")}
                </Badge>
              ) : adequacyCoverage === "PARTIAL_UNCONFIRMED" ? (
                <Badge variant="outline" className={`border-transparent ${toneChip("warning")}`} data-testid="coverage-badge">
                  {t("partialUnconfirmedBadge")}
                </Badge>
              ) : null}
              {transfer.tiaCompleted ? (
                <Badge variant="outline" className="border-primary text-primary">
                  <ClipboardCheck className="w-3 h-3 mr-1" />
                  {t("tiaDone")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {t("tiaPending")}
                </Badge>
              )}
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
          {/* The transfer impact assessment: start it here, or open it. */}
          {transfer.tia ? (
            <Link href={`/privacy/assessments/${transfer.tia.id}`}>
              <Button variant="outline" size="sm" data-testid="transfer-tia">
                <Shield className="w-4 h-4 mr-2" />
                {transfer.tia.status === "APPROVED" ? tInv("transfer.viewTia") : tInv("transfer.continueTia")}
              </Button>
            </Link>
          ) : canWrite ? (
            <Button
              variant="outline"
              size="sm"
              data-testid="transfer-tia"
              disabled={createTia.isPending}
              onClick={() => createTia.mutate({ organizationId: orgId, dataTransferId: id })}
            >
              {createTia.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              {tInv("transfer.startTia")}
            </Button>
          ) : null}
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
      {adequacyCoverage === "PARTIAL_UNCONFIRMED" && adequacyDecision && (
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
            {status !== checklistData.transfer.suggestedStatus &&
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
              variant={status === s ? "default" : "outline"}
              size="sm"
              disabled={updateCompliance.isPending}
              onClick={() => setStatus(s)}
            >
              {tStatus(s)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Schrems II checklist */}
      {!isAdequateCountry && checklist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("schremsTitle")}</CardTitle>
            <CardDescription>{t("schremsSubtitle")}</CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-2" data-testid="checklist-summary">
              <p className="text-sm text-foreground">
                {t("checklistSummary", { pending: pendingItems.length, total: checklist.length })}
              </p>
              <Link href={tiaHref} className="ml-auto">
                <Button size="sm" variant="outline">
                  <Shield className="w-4 h-4 mr-2" />
                  {t("checklistGo.tia")}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((item) => {
              const isOpen = openChecklistItem === item.id;
              const answer = checklistAnswers[item.id];
              const state: ChecklistState = answer?.state ?? "PENDING";
              const section = checklistSection(item.id);
              const target = checklistTarget(item.id);
              const noteDraft = noteDrafts[item.id] ?? answer?.note ?? "";
              return (
                <div key={item.id} className="border rounded-md" data-testid={`checklist-item-${item.id}`}>
                  <div className="p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenChecklistItem(isOpen ? null : item.id)}
                      className="flex-1 min-w-0 text-left"
                      aria-expanded={isOpen}
                    >
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {t(`checklistCategories.${section}` as "checklistCategories.know")}
                        {item.required ? ` · ${t("required")}` : ""}
                      </p>
                      <p className="font-medium text-sm">
                        {state === "DONE" && <CheckCircle2 className="inline w-4 h-4 mr-1 text-primary align-text-bottom" />}
                        {itemQuestion(item)}
                      </p>
                      {answer?.note && !isOpen && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{answer.note}</p>
                      )}
                    </button>
                    <div className="flex shrink-0 gap-1" role="group" aria-label={itemQuestion(item)}>
                      {CHECKLIST_STATES.map((s) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          variant={state === s && (answer || s !== "PENDING") ? "default" : "outline"}
                          disabled={!canWrite || updateChecklistItem.isPending}
                          onClick={() => answerItem(item.id, s)}
                          data-testid={`checklist-${item.id}-${s}`}
                        >
                          {t(`checklistState.${s}` as "checklistState.DONE")}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 text-sm">
                      <p className="text-muted-foreground">{itemHelp(item)}</p>
                      <Link href={targetHref[target]} className="inline-flex items-center text-primary hover:underline">
                        {t(`checklistGo.${target}` as "checklistGo.tia")}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                      {canWrite && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                            placeholder={t("checklistNote")}
                            aria-label={t("checklistNote")}
                            value={noteDraft}
                            maxLength={1000}
                            onChange={(e) => setNoteDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={updateChecklistItem.isPending || noteDraft === (answer?.note ?? "")}
                            onClick={() => answerItem(item.id, state, noteDraft)}
                          >
                            {t("checklistNoteSave")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Supplementary measures */}
      {!isAdequateCountry && supplementaryMeasures.length > 0 && (
        <Card id="supplementary-measures" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>{t("supplementaryTitle")}</CardTitle>
            <CardDescription>{t("supplementarySubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["technical", "contractual", "organizational"] as const).map((category) => {
              const items = supplementaryMeasures.filter((m) => m.category === category);
              if (items.length === 0) return null;
              const categoryLabel =
                category === "technical"
                  ? t("category_technical")
                  : category === "contractual"
                    ? t("category_contractual")
                    : t("category_organizational");
              return (
                <div key={category}>
                  <p className="text-sm font-medium mb-2">{categoryLabel}</p>
                  <div className="space-y-2">
                    {items.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-start gap-3 p-2 border rounded-md hover:bg-muted/40 cursor-pointer"
                      >
                        <Checkbox
                          checked={!!supplementaryMeasuresObj[m.id]}
                          onCheckedChange={() => toggleMeasure(m.id)}
                          disabled={updateCompliance.isPending}
                        />
                        <div>
                          <p className="font-medium text-sm">{measureName(m)}</p>
                          <p className="text-xs text-muted-foreground">{measureDescription(m)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {enabledMeasures.length > 0 && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                {t("measuresActive", { count: enabledMeasures.length })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Linked TIA hint */}
      {!transfer.tiaCompleted && (
        <Card className={`${toneBorder("warning")} ${toneTint("warning")}`}>
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ClipboardCheck className={`w-5 h-5 shrink-0 ${toneMark("warning")}`} />
              <div className="text-sm">
                <p className="font-medium">{t("tiaPendingTitle")}</p>
                <p className="text-muted-foreground">{t("tiaPendingBody")}</p>
              </div>
            </div>
            <Link href={tiaHref} className="shrink-0">
              <Button size="sm">
                {t("startTia")} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

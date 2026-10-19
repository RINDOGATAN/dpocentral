"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { TransferAdequacyFields } from "@/components/privacy/transfer-adequacy-fields";
import { getAdequacyDecision } from "@/config/transfer-compliance-rules";

/** "None" in the optional selects (Radix Select has no empty value). */
const NONE = "__none__";

const MECHANISM_KEYS = [
  "ADEQUACY_DECISION", "STANDARD_CONTRACTUAL_CLAUSES", "BINDING_CORPORATE_RULES",
  "DEROGATION", "CERTIFICATION", "CODE_OF_CONDUCT", "OTHER",
] as const;

const STATUS_KEYS = ["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT", "PENDING"] as const;

export default function EditTransferPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const tMech = useTranslations("pages.dataInventory.mechanism");
  const tCommon = useTranslations("common");
  const t = useTranslations("pages.transfers.edit");
  const tStatus = useTranslations("pages.transfers.status_option");
  const tToasts = useTranslations("toasts");
  const tDialog = useTranslations("pages.dataInventory.transferDialog");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const [formData, setFormData] = useState({
    safeguards: "",
    tiaCompleted: false,
    tiaDate: "",
    sccExpiryDate: "",
    complianceStatus: "PENDING" as string,
    processingActivityId: "",
    vendorId: "",
    adequacyScopeConfirmed: null as boolean | null,
    adequacyScopeReference: "",
  });

  // Note: createTransfer / updateTransfer don't share an updater for the basic
  // fields (name, mechanism etc.) — those flow through createTransfer. For now
  // the edit page covers the compliance side of the record (the main gap from
  // the audit). Renaming/redirecting is rare; we expose it via the API later
  // if needed.

  const { data: checklistData, isLoading } = trpc.dataInventory.getTransferComplianceChecklist.useQuery(
    { organizationId: orgId, transferId: id },
    { enabled: !!orgId && !!id }
  );

  useEffect(() => {
    if (checklistData?.transfer && !initializedRef.current) {
      initializedRef.current = true;
      const t = checklistData.transfer;
      setFormData({
        safeguards: t.safeguards ?? "",
        tiaCompleted: t.tiaCompleted ?? false,
        tiaDate: "",
        sccExpiryDate: t.sccExpiryDate
          ? new Date(t.sccExpiryDate).toISOString().split("T")[0]!
          : "",
        complianceStatus: t.complianceStatus || "PENDING",
        processingActivityId: t.processingActivityId ?? "",
        vendorId: t.vendorId ?? "",
        adequacyScopeConfirmed: t.adequacyScopeConfirmed ?? null,
        adequacyScopeReference: t.adequacyScopeReference ?? "",
      });
    }
  }, [checklistData]);

  const { data: options } = trpc.dataInventory.transferFormOptions.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const utils = trpc.useUtils();
  const updateCompliance = trpc.dataInventory.updateTransferCompliance.useMutation({
    onSuccess: () => {
      toast.success(tToasts("transfer.updated"));
      // Lists, counters, this record, the record of processing and the map.
      utils.dataInventory.invalidate();
      router.push(`/privacy/transfers/${id}`);
    },
    onError: () => {
      toast.error(tToasts("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setIsSubmitting(true);
    const partial =
      !!checklistData?.transfer &&
      getAdequacyDecision(checklistData.transfer.destinationCountry)?.isPartial === true;
    updateCompliance.mutate({
      organizationId: orgId,
      id,
      complianceStatus: formData.complianceStatus as any,
      tiaCompleted: formData.tiaCompleted,
      tiaDate: formData.tiaDate ? new Date(formData.tiaDate) : null,
      sccExpiryDate: formData.sccExpiryDate ? new Date(formData.sccExpiryDate) : null,
      safeguards: formData.safeguards,
      processingActivityId: formData.processingActivityId || null,
      vendorId: formData.vendorId || null,
      ...(partial
        ? {
            adequacyScopeConfirmed: formData.adequacyScopeConfirmed,
            adequacyScopeReference: formData.adequacyScopeConfirmed
              ? formData.adequacyScopeReference || null
              : null,
          }
        : {}),
    });
  };

  if (isLoading || !checklistData?.transfer) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const transfer = checklistData.transfer;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/privacy/transfers/${id}`}>
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {transfer.name} → {transfer.destinationCountry}
            {" · "}
            {tMech(transfer.mechanism as any)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("links")}</CardTitle>
            <CardDescription>{t("linksSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-activity">{tDialog("activityLabel")}</Label>
              <Select
                value={formData.processingActivityId || NONE}
                onValueChange={(v) => setFormData({ ...formData, processingActivityId: v === NONE ? "" : v })}
              >
                <SelectTrigger id="edit-activity" data-testid="transfer-activity">
                  <SelectValue placeholder={tDialog("activityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tDialog("noneOption")}</SelectItem>
                  {(options?.activities ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{tDialog("activityHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vendor">{tDialog("vendorLabel")}</Label>
              <Select
                value={formData.vendorId || NONE}
                onValueChange={(v) => setFormData({ ...formData, vendorId: v === NONE ? "" : v })}
              >
                <SelectTrigger id="edit-vendor" data-testid="transfer-vendor">
                  <SelectValue placeholder={tDialog("vendorPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tDialog("noneOption")}</SelectItem>
                  {(options?.vendors ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {getAdequacyDecision(transfer.destinationCountry)?.isPartial && (
          <Card>
            <CardHeader>
              <CardTitle>{t("adequacyScope")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TransferAdequacyFields
                country={transfer.destinationCountry}
                value={{
                  adequacyScopeConfirmed: formData.adequacyScopeConfirmed,
                  adequacyScopeReference: formData.adequacyScopeReference,
                }}
                onChange={(v) => setFormData({ ...formData, ...v })}
                idPrefix="edit-transfer"
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("complianceStatus")}</CardTitle>
            <CardDescription>{t("complianceStatusSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("status")}</Label>
              <Select
                value={formData.complianceStatus}
                onValueChange={(v) => setFormData({ ...formData, complianceStatus: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_KEYS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tStatus(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("tia")}</CardTitle>
            <CardDescription>{t("tiaSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="tiaCompleted"
                checked={formData.tiaCompleted}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, tiaCompleted: checked })
                }
              />
              <Label htmlFor="tiaCompleted">{t("tiaCompleted")}</Label>
            </div>
            {formData.tiaCompleted && (
              <div className="space-y-2">
                <Label htmlFor="tiaDate">{t("tiaDate")}</Label>
                <Input
                  id="tiaDate"
                  type="date"
                  value={formData.tiaDate}
                  onChange={(e) => setFormData({ ...formData, tiaDate: e.target.value })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sccAndSafeguards")}</CardTitle>
            <CardDescription>{t("sccAndSafeguardsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sccExpiryDate">{t("sccExpiry")}</Label>
              <Input
                id="sccExpiryDate"
                type="date"
                value={formData.sccExpiryDate}
                onChange={(e) => setFormData({ ...formData, sccExpiryDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("sccExpiryHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="safeguards">{t("safeguards")}</Label>
              <Textarea
                id="safeguards"
                rows={3}
                placeholder={t("safeguardsPlaceholder")}
                value={formData.safeguards}
                onChange={(e) => setFormData({ ...formData, safeguards: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {updateCompliance.error && (
          <div className="text-sm text-destructive">{t("errorPrefix", { message: updateCompliance.error.message })}</div>
        )}

        <div className="flex justify-end gap-4">
          <Link href={`/privacy/transfers/${id}`}>
            <Button variant="outline" type="button">{tCommon("cancel")}</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

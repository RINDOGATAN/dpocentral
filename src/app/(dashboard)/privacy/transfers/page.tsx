"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useSubmitLock } from "@/lib/use-submit-lock";
import { useOrganization } from "@/lib/organization-context";
import { SortControl } from "@/components/privacy/sort-control";
import { sortByListSort, DEFAULT_LIST_SORT, type ListSort } from "@/lib/list-sort";
import { PageHeader } from "@/components/privacy/page-header";
import { toneBorder, toneChip, toneMark, toneTint } from "@/config/status-palette";

import { formatDateIn } from "@/lib/utils";
import { countryName, isIsoCountryCode } from "@/lib/country-code";
import { CountryPicker } from "@/components/privacy/country-picker";
import { TransferAdequacyFields } from "@/components/privacy/transfer-adequacy-fields";
import { getAdequacyDecision } from "@/config/transfer-compliance-rules";

/** "None" in the optional selects (Radix Select has no empty value). */
const NONE = "__none__";
const MECHANISM_KEYS = [
  "ADEQUACY_DECISION", "STANDARD_CONTRACTUAL_CLAUSES", "BINDING_CORPORATE_RULES",
  "DEROGATION", "CERTIFICATION", "CODE_OF_CONDUCT", "OTHER",
] as const;

const statusColors: Record<string, string> = {
  COMPLIANT: "border-primary text-primary bg-primary/5",
  NEEDS_REVIEW: `border-transparent ${toneChip("warning")}`,
  NON_COMPLIANT: `border-transparent ${toneChip("danger")}`,
  PENDING: "border-muted-foreground text-muted-foreground",
};

const STATUS_KEYS = ["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT", "PENDING"] as const;

export default function TransfersListPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const t = useTranslations("pages.dataInventory.transferDialog");
  const locale = useLocale();
  const tMech = useTranslations("pages.dataInventory.mechanism");
  const tCommon = useTranslations("common");
  const tList = useTranslations("pages.transfers.list");
  const tStatus = useTranslations("pages.transfers.status_option");
  const tToasts = useTranslations("toasts");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sort, setSort] = useState<ListSort>(DEFAULT_LIST_SORT);
  const emptyForm = {
    name: "",
    destinationCountry: "",
    destinationOrg: "",
    mechanism: "",
    safeguards: "",
    description: "",
    processingActivityId: "",
    vendorId: "",
    adequacyScopeConfirmed: null as boolean | null,
    adequacyScopeReference: "",
  };
  const [form, setForm] = useState(emptyForm);

  const utils = trpc.useUtils();

  const { data: transfers, isLoading } = trpc.dataInventory.listTransfers.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );
  const { data: stats } = trpc.dataInventory.getTransferStats.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );
  const { data: options } = trpc.dataInventory.transferFormOptions.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId && dialogOpen }
  );

  const submitLock = useSubmitLock();
  const createTransfer = trpc.dataInventory.createTransfer.useMutation({
    onSuccess: () => {
      toast.success(tToasts("transfer.created"));
      // Lists, counters, the record of processing and the map's markers.
      utils.dataInventory.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error(tToasts("generic.somethingWentWrong")),
  });

  if (!orgId || isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Globe}
        title={tList("title")}
        description={tList("subtitle")}
        actions={
          <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {tList("add")}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{tList("total")}</p>
            <p className="text-3xl font-semibold">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {tList("compliant")}
            </p>
            <p className="text-3xl font-semibold">{stats?.compliant ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className={`w-3.5 h-3.5 ${toneMark("warning")}`} /> {tList("needsReview")}
            </p>
            <p className="text-3xl font-semibold">{stats?.needsReview ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> {tList("nonCompliant")}
            </p>
            <p className="text-3xl font-semibold">{stats?.nonCompliant ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CalendarClock className={`w-3.5 h-3.5 ${toneMark("warning")}`} /> {tList("expiring30d")}
            </p>
            <p className="text-3xl font-semibold">{stats?.expiringSoon ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {stats?.withoutTia ? (
        <Card className={`${toneBorder("warning")} ${toneTint("warning")}`}>
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${toneMark("warning")}`} />
            <div className="text-sm">
              {tList.rich("tiaWarning", {
                count: stats.withoutTia,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Transfer list */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>{tList("all")}</CardTitle>
              <CardDescription>{tList("allSubtitle")}</CardDescription>
            </div>
            {transfers && transfers.length > 0 && (
              <SortControl value={sort} onChange={setSort} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!transfers || transfers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{tList("empty")}</p>
              <p className="text-sm">{tList("emptySubtitle")}</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {tList("addFirst")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortByListSort(transfers, sort, {
                date: (tr) => tr.createdAt,
                name: (tr) => tr.name,
              }).map((transfer) => {
                const status = (transfer.complianceStatus as string | null) || "PENDING";
                return (
                  <Link
                    key={transfer.id}
                    href={`/privacy/transfers/${transfer.id}`}
                    className="block border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{transfer.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          → {countryName(transfer.destinationCountry, locale)} ({transfer.destinationCountry})
                          {transfer.vendor
                            ? ` · ${transfer.vendor.name}`
                            : transfer.destinationOrg
                              ? ` · ${transfer.destinationOrg}`
                              : ""}
                          {transfer.processingActivity
                            ? ` · ${tList("linkedTo", { name: transfer.processingActivity.name })}`
                            : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {tMech(transfer.mechanism as any)}
                          </Badge>
                          <Badge variant="outline" className={statusColors[status] || ""}>
                            {STATUS_KEYS.includes(status as typeof STATUS_KEYS[number])
                              ? tStatus(status as typeof STATUS_KEYS[number])
                              : status}
                          </Badge>
                          {transfer.tiaCompleted ? (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {tList("tiaDone")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {tList("tiaPending")}
                            </Badge>
                          )}
                          {transfer.sccExpiryDate && (
                            <Badge variant="outline" className="text-xs">
                              {tList("sccExpires", {
                                date: formatDateIn(new Date(transfer.sccExpiryDate), locale),
                              })}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name || !isIsoCountryCode(form.destinationCountry) || !form.mechanism) return;
              if (!submitLock.acquire()) return;
              const partial = getAdequacyDecision(form.destinationCountry)?.isPartial === true;
              createTransfer.mutate({
                organizationId: orgId,
                name: form.name,
                destinationCountry: form.destinationCountry,
                destinationOrg: form.destinationOrg || undefined,
                mechanism: form.mechanism as any,
                safeguards: form.safeguards || undefined,
                description: form.description || undefined,
                processingActivityId: form.processingActivityId || undefined,
                vendorId: form.vendorId || undefined,
                adequacyScopeConfirmed: partial ? form.adequacyScopeConfirmed : undefined,
                adequacyScopeReference:
                  partial && form.adequacyScopeConfirmed ? form.adequacyScopeReference || undefined : undefined,
              }, { onSettled: submitLock.release });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("countryLabel")}</Label>
              <CountryPicker
                id="country"
                value={form.destinationCountry}
                onChange={(code) =>
                  setForm({ ...form, destinationCountry: code, adequacyScopeConfirmed: null, adequacyScopeReference: "" })
                }
                placeholder={t("countryPlaceholder")}
                ariaDescribedBy="country-hint"
              />
              <p id="country-hint" className="text-xs text-muted-foreground">{t("countryHint")}</p>
              <TransferAdequacyFields
                country={form.destinationCountry}
                value={{
                  adequacyScopeConfirmed: form.adequacyScopeConfirmed,
                  adequacyScopeReference: form.adequacyScopeReference,
                }}
                onChange={(v) => setForm({ ...form, ...v })}
                idPrefix="new-transfer"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vendor">{t("vendorLabel")}</Label>
                <Select
                  value={form.vendorId || NONE}
                  onValueChange={(v) => {
                    const id = v === NONE ? "" : v;
                    const vendor = options?.vendors.find((x) => x.id === id);
                    setForm({
                      ...form,
                      vendorId: id,
                      // The receiving organisation follows the vendor unless typed.
                      destinationOrg: form.destinationOrg || vendor?.name || "",
                    });
                  }}
                >
                  <SelectTrigger id="vendor" data-testid="transfer-vendor">
                    <SelectValue placeholder={t("vendorPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("noneOption")}</SelectItem>
                    {(options?.vendors ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org">{t("orgLabel")}</Label>
                <Input
                  id="org"
                  placeholder={t("orgPlaceholder")}
                  value={form.destinationOrg}
                  onChange={(e) => setForm({ ...form, destinationOrg: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity">{t("activityLabel")}</Label>
              <Select
                value={form.processingActivityId || NONE}
                onValueChange={(v) => setForm({ ...form, processingActivityId: v === NONE ? "" : v })}
              >
                <SelectTrigger id="activity" data-testid="transfer-activity">
                  <SelectValue placeholder={t("activityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("noneOption")}</SelectItem>
                  {(options?.activities ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("activityHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("mechanismLabel")}</Label>
              <Select
                value={form.mechanism}
                onValueChange={(v) => setForm({ ...form, mechanism: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("mechanismPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {MECHANISM_KEYS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tMech(value as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="safeguards">{t("safeguardsLabel")}</Label>
              <Input
                id="safeguards"
                placeholder={t("safeguardsPlaceholder")}
                value={form.safeguards}
                onChange={(e) => setForm({ ...form, safeguards: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionLabel")}</Label>
              <Textarea
                id="description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  createTransfer.isPending ||
                  !form.name ||
                  !isIsoCountryCode(form.destinationCountry) ||
                  !form.mechanism
                }
              >
                {createTransfer.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t("create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

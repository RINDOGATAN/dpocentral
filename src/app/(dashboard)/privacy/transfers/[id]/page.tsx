"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const statusColors: Record<string, string> = {
  COMPLIANT: "border-primary text-primary bg-primary/5",
  NEEDS_REVIEW: "border-yellow-500 text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-950/30",
  NON_COMPLIANT: "border-destructive text-destructive bg-destructive/5",
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

  const utils = trpc.useUtils();

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

  const [openChecklistItem, setOpenChecklistItem] = useState<string | null>(null);

  if (checklistLoading || !checklistData) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { transfer, isAdequateCountry, adequacyDecision, checklist, supplementaryMeasures } =
    checklistData;

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
                → {transfer.destinationCountry}
                {transfer.destinationOrg ? ` · ${transfer.destinationOrg}` : ""}
              </Badge>
              <Badge variant="outline">{tMech(transfer.mechanism as any)}</Badge>
              <Badge variant="outline" className={statusColors[status] || ""}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {STATUS_KEYS.includes(status as typeof STATUS_KEYS[number])
                  ? tStatus(status as typeof STATUS_KEYS[number])
                  : status}
              </Badge>
              {isAdequateCountry && (
                <Badge variant="outline" className="border-primary text-primary">
                  {t("adequateCountry")}
                </Badge>
              )}
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
          </div>
        </div>
        <Link href={`/privacy/transfers/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            {t("edit")}
          </Button>
        </Link>
      </div>

      {/* Adequacy notice */}
      {isAdequateCountry && adequacyDecision && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t("adequacyTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("adequacyBody", {
                  country: adequacyDecision.country,
                  date: adequacyDecision.decisionDate,
                })}
                {adequacyDecision.isPartial && t("adequacyPartial")}
                {adequacyDecision.notes && (
                  <span className="block mt-1 italic">{adequacyDecision.notes}</span>
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
                <span className="text-yellow-700 dark:text-yellow-400">
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
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((item) => {
              const isOpen = openChecklistItem === item.id;
              return (
                <div key={item.id} className="border rounded-md">
                  <button
                    type="button"
                    onClick={() => setOpenChecklistItem(isOpen ? null : item.id)}
                    className="w-full text-left p-3 flex items-start gap-3 hover:bg-muted/50"
                  >
                    <div className="w-5 h-5 border-2 border-muted-foreground rounded shrink-0 mt-0.5 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">{item.category[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {item.category}
                      </p>
                      <p className="font-medium text-sm">{item.question}</p>
                    </div>
                    {item.required && (
                      <Badge variant="outline" className="text-xs shrink-0">{t("required")}</Badge>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 text-sm text-muted-foreground">
                      {item.helpText}
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
        <Card>
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
                          <p className="font-medium text-sm">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.description}</p>
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
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
            <div className="text-sm">
              <span className="font-medium">
                {t("sccExpires", {
                  date: new Date(transfer.sccExpiryDate).toLocaleDateString(),
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
        <Card className="border-yellow-500/40 bg-yellow-50/40 dark:bg-yellow-950/10">
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ClipboardCheck className="w-5 h-5 text-yellow-600 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">{t("tiaPendingTitle")}</p>
                <p className="text-muted-foreground">{t("tiaPendingBody")}</p>
              </div>
            </div>
            <Link href={`/privacy/assessments/new?type=TIA&transferId=${id}`} className="shrink-0">
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

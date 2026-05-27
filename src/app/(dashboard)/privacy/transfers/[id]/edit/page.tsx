"use client";

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const [formData, setFormData] = useState({
    safeguards: "",
    tiaCompleted: false,
    tiaDate: "",
    sccExpiryDate: "",
    complianceStatus: "PENDING" as string,
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
        safeguards: "",
        tiaCompleted: t.tiaCompleted ?? false,
        tiaDate: "",
        sccExpiryDate: t.sccExpiryDate
          ? new Date(t.sccExpiryDate).toISOString().split("T")[0]!
          : "",
        complianceStatus: t.complianceStatus || "PENDING",
      });
    }
  }, [checklistData]);

  const utils = trpc.useUtils();
  const updateCompliance = trpc.dataInventory.updateTransferCompliance.useMutation({
    onSuccess: () => {
      toast.success("Transfer updated");
      utils.dataInventory.listTransfers.invalidate();
      utils.dataInventory.getTransferStats.invalidate();
      utils.dataInventory.getTransferComplianceChecklist.invalidate({
        organizationId: orgId,
        transferId: id,
      });
      router.push(`/privacy/transfers/${id}`);
    },
    onError: (e) => {
      toast.error(e.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setIsSubmitting(true);
    updateCompliance.mutate({
      organizationId: orgId,
      id,
      complianceStatus: formData.complianceStatus as any,
      tiaCompleted: formData.tiaCompleted,
      tiaDate: formData.tiaDate ? new Date(formData.tiaDate) : null,
      sccExpiryDate: formData.sccExpiryDate ? new Date(formData.sccExpiryDate) : null,
      safeguards: formData.safeguards || undefined,
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
          <h1 className="text-2xl font-semibold">Edit Transfer Compliance</h1>
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
            <CardTitle>Compliance status</CardTitle>
            <CardDescription>Manual override for the transfer's compliance status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
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
                      {value.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transfer Impact Assessment</CardTitle>
            <CardDescription>
              Required for SCC-based transfers to non-adequate jurisdictions (Schrems II).
            </CardDescription>
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
              <Label htmlFor="tiaCompleted">TIA completed</Label>
            </div>
            {formData.tiaCompleted && (
              <div className="space-y-2">
                <Label htmlFor="tiaDate">TIA completion date</Label>
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
            <CardTitle>SCC & Safeguards</CardTitle>
            <CardDescription>SCC validity and any additional safeguards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sccExpiryDate">SCC expiry date</Label>
              <Input
                id="sccExpiryDate"
                type="date"
                value={formData.sccExpiryDate}
                onChange={(e) => setFormData({ ...formData, sccExpiryDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Date the contractual clauses expire. Transfers expiring within 30 days show on the
                compliance dashboard.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="safeguards">Safeguards (description)</Label>
              <Textarea
                id="safeguards"
                rows={3}
                placeholder="e.g., EU SCCs 2021 module 2 + encryption at rest + DPIA"
                value={formData.safeguards}
                onChange={(e) => setFormData({ ...formData, safeguards: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {updateCompliance.error && (
          <div className="text-sm text-destructive">Error: {updateCompliance.error.message}</div>
        )}

        <div className="flex justify-end gap-4">
          <Link href={`/privacy/transfers/${id}`}>
            <Button variant="outline" type="button">{tCommon("cancel")}</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

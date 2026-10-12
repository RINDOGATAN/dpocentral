"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useSubmitLock } from "@/lib/use-submit-lock";
import { useDsarCanAddRequests } from "@/components/privacy/dsar-module-access-note";
import { useOrganization } from "@/lib/organization-context";
import { useDsarAccess } from "@/lib/use-dsar-access";
import { DsarRestrictedNotice } from "@/components/privacy/dsar-restricted-notice";
import { DSARType } from "@prisma/client";

const TYPE_KEYS: DSARType[] = ["ACCESS", "RECTIFICATION", "ERASURE", "PORTABILITY", "OBJECTION", "RESTRICTION"];

/**
 * The California (CCPA) requests, shown when the organisation declared the
 * CCPA. Know, delete and correct are stored as ACCESS, ERASURE and
 * RECTIFICATION and run on the organisation's deadline (45 days for the CCPA
 * alone); opt-out and limit have their own type and 15-business-day clock
 * (src/lib/dsar-deadline.ts, dsarRuleForType).
 */
const CCPA_CARDS = [
  { key: "ccpa-know", type: "ACCESS", text: "know", clock: "clock45" },
  { key: "ccpa-delete", type: "ERASURE", text: "delete", clock: "clock45" },
  { key: "ccpa-correct", type: "RECTIFICATION", text: "correct", clock: "clock45" },
  { key: "ccpa-optout", type: "OPT_OUT_SALE_SHARING", text: "optOut", clock: "clock15" },
  { key: "ccpa-limit", type: "LIMIT_SENSITIVE_PI", text: "limit", clock: "clock15" },
] as const satisfies ReadonlyArray<{ key: string; type: DSARType; text: string; clock: string }>;

const RELATIONSHIP_OPTIONS = [
  "Customer",
  "Employee",
  "Former Employee",
  "Job Applicant",
  "Contractor",
  "Website Visitor",
  "Other",
] as const;

export default function NewDSARRequestPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { canHandle } = useDsarAccess();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newDsar");
  const tCommon = useTranslations("common");
  const tModule = useTranslations("dsarModule");
  const tCcpa = useTranslations("ccpaRequests");
  const [card, setCard] = useState<string>("");
  // The laws the organisation declared decide which requests are offered.
  const { data: applied } = trpc.regulations.listApplied.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );
  const codes = (applied?.jurisdictions ?? []).map((j) => j.code).filter((c) => c !== "EU_AI_ACT");
  const hasCcpa = codes.includes("CCPA");
  const hasOtherLaw = codes.length === 0 || codes.some((c) => c !== "CCPA");
  const canAdd = useDsarCanAddRequests();

  const [form, setForm] = useState({
    type: "" as string,
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    requesterAddress: "",
    relationship: "",
    description: "",
    requestedData: "",
  });

  const createRequest = trpc.dsar.create.useMutation({
    onSuccess: (data) => {
      toast.success(t("dsar.created"));
      router.push(`/privacy/dsar/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const submitLock = useSubmitLock();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !form.type || !form.requesterName || !form.requesterEmail) return;
    if (!submitLock.acquire()) return;

    createRequest.mutate({
      organizationId: organization.id,
      type: form.type as DSARType,
      requesterName: form.requesterName,
      requesterEmail: form.requesterEmail,
      requesterPhone: form.requesterPhone || undefined,
      requesterAddress: form.requesterAddress || undefined,
      relationship: form.relationship || undefined,
      description: form.description || undefined,
      requestedData: form.requestedData || undefined,
    }, { onSettled: submitLock.release });
  };

  const isValid = form.type && form.requesterName && form.requesterEmail;

  if (canHandle === false) return <DsarRestrictedNotice />;

  // The add-on is not on the plan: the note above the page says so (layout);
  // no form the server would refuse.
  if (!canAdd) {
    return (
      <Card data-testid="dsar-new-addon-off">
        <CardContent className="py-8 text-center text-muted-foreground space-y-4">
          <p>{tModule("addOnNoNew")}</p>
          <Link href="/privacy/dsar">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {tModule("backToRequests")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/dsar">
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tp("title")}</h1>
          <p className="text-sm text-muted-foreground">{tp("subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tp("type.title")}</CardTitle>
            <CardDescription>{tp("type.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasCcpa && (
              <div className="space-y-3" data-testid="dsar-ccpa-types">
                <div>
                  <p className="text-sm font-medium">{tCcpa("groupCcpa")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tCcpa("clockNote")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CCPA_CARDS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setCard(c.key);
                        setForm({ ...form, type: c.type });
                      }}
                      aria-pressed={card === c.key}
                      className={`text-left p-4 border transition-colors ${
                        card === c.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{tCcpa(`${c.text}.label`)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{tCcpa(`${c.text}.desc`)}</p>
                      <p className="text-xs mt-2">{tCcpa(c.clock)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hasOtherLaw && (
              <div className={hasCcpa ? "space-y-3 mt-6" : ""}>
                {hasCcpa && <p className="text-sm font-medium">{tCcpa("groupOther")}</p>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {TYPE_KEYS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setCard(value);
                        setForm({ ...form, type: value });
                      }}
                      aria-pressed={card === value}
                      className={`text-left p-4 border transition-colors ${
                        card === value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{tp(`type.${value}` as `type.ACCESS` | `type.RECTIFICATION` | `type.ERASURE` | `type.PORTABILITY` | `type.OBJECTION` | `type.RESTRICTION`)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{tp(`type.${value}_desc` as `type.ACCESS_desc` | `type.RECTIFICATION_desc` | `type.ERASURE_desc` | `type.PORTABILITY_desc` | `type.OBJECTION_desc` | `type.RESTRICTION_desc`)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requester Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tp("requester.title")}</CardTitle>
            <CardDescription>{tp("requester.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requesterName">{tp("requester.name")}</Label>
                <Input
                  id="requesterName"
                  placeholder={tp("requester.namePlaceholder")}
                  value={form.requesterName}
                  onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requesterEmail">{tp("requester.email")}</Label>
                <Input
                  id="requesterEmail"
                  type="email"
                  placeholder={tp("requester.emailPlaceholder")}
                  value={form.requesterEmail}
                  onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requesterPhone">{tp("requester.phone")}</Label>
                <Input
                  id="requesterPhone"
                  placeholder={tp("requester.phonePlaceholder")}
                  value={form.requesterPhone}
                  onChange={(e) => setForm({ ...form, requesterPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">{tp("requester.relationship")}</Label>
                <Select
                  value={form.relationship}
                  onValueChange={(value) => setForm({ ...form, relationship: value })}
                >
                  <SelectTrigger id="relationship">
                    <SelectValue placeholder={tp("requester.relationshipPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map((rel) => (
                      <SelectItem key={rel} value={rel}>{tp(`requester.relationshipOptions.${rel}` as `requester.relationshipOptions.Customer` | `requester.relationshipOptions.Employee` | `requester.relationshipOptions.Former Employee` | `requester.relationshipOptions.Job Applicant` | `requester.relationshipOptions.Contractor` | `requester.relationshipOptions.Website Visitor` | `requester.relationshipOptions.Other`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requesterAddress">{tp("requester.address")}</Label>
              <Input
                id="requesterAddress"
                placeholder={tp("requester.addressPlaceholder")}
                value={form.requesterAddress}
                onChange={(e) => setForm({ ...form, requesterAddress: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tp("details.title")}</CardTitle>
            <CardDescription>{tp("details.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">{tp("details.description")}</Label>
              <Textarea
                id="description"
                placeholder={tp("details.descriptionPlaceholder")}
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestedData">{tp("details.requestedData")}</Label>
              <Textarea
                id="requestedData"
                placeholder={tp("details.requestedDataPlaceholder")}
                rows={2}
                value={form.requestedData}
                onChange={(e) => setForm({ ...form, requestedData: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/privacy/dsar">
            <Button type="button" variant="outline">{tCommon("cancel")}</Button>
          </Link>
          <Button type="submit" disabled={!isValid || createRequest.isPending}>
            {createRequest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tp("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

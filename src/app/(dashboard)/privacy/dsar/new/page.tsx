"use client";

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
import { useOrganization } from "@/lib/organization-context";
import { DSARType } from "@prisma/client";

const TYPE_KEYS: DSARType[] = ["ACCESS", "RECTIFICATION", "ERASURE", "PORTABILITY", "OBJECTION", "RESTRICTION"];

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
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newDsar");
  const tCommon = useTranslations("common");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !form.type || !form.requesterName || !form.requesterEmail) return;

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
    });
  };

  const isValid = form.type && form.requesterName && form.requesterEmail;

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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TYPE_KEYS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, type: value })}
                  className={`text-left p-4 border transition-colors ${
                    form.type === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-sm">{tp(`type.${value}` as `type.ACCESS` | `type.RECTIFICATION` | `type.ERASURE` | `type.PORTABILITY` | `type.OBJECTION` | `type.RESTRICTION`)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tp(`type.${value}_desc` as `type.ACCESS_desc` | `type.RECTIFICATION_desc` | `type.ERASURE_desc` | `type.PORTABILITY_desc` | `type.OBJECTION_desc` | `type.RESTRICTION_desc`)}</p>
                </button>
              ))}
            </div>
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

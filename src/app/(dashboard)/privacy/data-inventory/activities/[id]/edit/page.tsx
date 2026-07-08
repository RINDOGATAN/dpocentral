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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const LEGAL_BASIS_KEYS = [
  "CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTERESTS",
  "PUBLIC_TASK", "LEGITIMATE_INTERESTS",
] as const;

const DATA_CATEGORY_KEYS = [
  "IDENTIFIERS", "DEMOGRAPHICS", "FINANCIAL", "HEALTH", "BIOMETRIC",
  "LOCATION", "BEHAVIORAL", "EMPLOYMENT", "EDUCATION", "POLITICAL",
  "RELIGIOUS", "GENETIC", "SEXUAL_ORIENTATION", "CRIMINAL", "OTHER",
] as const;

export default function EditActivityPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tEdit = useTranslations("pages.editActivity");
  const tExt = useTranslations("pages.editActivityExt");
  const tCommon = useTranslations("common");
  const tLegal = useTranslations("pages.editActivityExt.legalBasis_option");
  const tCat = useTranslations("pages.editActivityExt.category_option");

  const initializedRef = useRef(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    purpose: "",
    legalBasis: "",
    legalBasisDetail: "",
    dataSubjects: [] as string[],
    categories: [] as string[],
    recipients: [] as string[],
    retentionPeriod: "",
    retentionDays: "" as string,
    automatedDecisionMaking: false,
    automatedDecisionDetail: "",
    isActive: true,
  });
  const [newSubject, setNewSubject] = useState("");
  const [newRecipient, setNewRecipient] = useState("");

  const { data: activity, isLoading } = trpc.dataInventory.getActivity.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id && !!id }
  );

  useEffect(() => {
    if (activity && !initializedRef.current) {
      initializedRef.current = true;
      setFormData({
        name: activity.name || "",
        description: activity.description || "",
        purpose: activity.purpose || "",
        legalBasis: activity.legalBasis as string,
        legalBasisDetail: activity.legalBasisDetail || "",
        dataSubjects: (activity.dataSubjects as string[]) || [],
        categories: (activity.categories as string[]) || [],
        recipients: (activity.recipients as string[]) || [],
        retentionPeriod: activity.retentionPeriod || "",
        retentionDays: activity.retentionDays != null ? String(activity.retentionDays) : "",
        automatedDecisionMaking: activity.automatedDecisionMaking ?? false,
        automatedDecisionDetail: activity.automatedDecisionDetail || "",
        isActive: activity.isActive ?? true,
      });
    }
  }, [activity]);

  const utils = trpc.useUtils();

  const updateActivity = trpc.dataInventory.updateActivity.useMutation({
    onSuccess: () => {
      toast.success(t("activity.updated"));
      utils.dataInventory.getActivity.invalidate({ organizationId: organization!.id, id });
      utils.dataInventory.listActivities.invalidate();
      router.push(`/privacy/data-inventory/activities/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name || !formData.purpose || !formData.legalBasis) return;
    setIsSubmitting(true);
    updateActivity.mutate({
      organizationId: organization.id,
      id,
      name: formData.name,
      description: formData.description || null,
      purpose: formData.purpose,
      legalBasis: formData.legalBasis as any,
      legalBasisDetail: formData.legalBasisDetail || null,
      dataSubjects: formData.dataSubjects,
      categories: formData.categories as any,
      recipients: formData.recipients,
      retentionPeriod: formData.retentionPeriod || null,
      retentionDays: formData.retentionDays ? parseInt(formData.retentionDays, 10) : null,
      automatedDecisionMaking: formData.automatedDecisionMaking,
      automatedDecisionDetail: formData.automatedDecisionDetail || null,
      isActive: formData.isActive,
    });
  };

  const toggleCategory = (value: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.includes(value)
        ? formData.categories.filter((c) => c !== value)
        : [...formData.categories, value],
    });
  };

  const addSubject = () => {
    const value = newSubject.trim();
    if (!value || formData.dataSubjects.includes(value)) return;
    setFormData({ ...formData, dataSubjects: [...formData.dataSubjects, value] });
    setNewSubject("");
  };
  const removeSubject = (value: string) => {
    setFormData({ ...formData, dataSubjects: formData.dataSubjects.filter((s) => s !== value) });
  };
  const addRecipient = () => {
    const value = newRecipient.trim();
    if (!value || formData.recipients.includes(value)) return;
    setFormData({ ...formData, recipients: [...formData.recipients, value] });
    setNewRecipient("");
  };
  const removeRecipient = (value: string) => {
    setFormData({ ...formData, recipients: formData.recipients.filter((r) => r !== value) });
  };

  if (isLoading || !activity) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/privacy/data-inventory/activities/${id}`}>
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tEdit("title")}</h1>
          <p className="text-muted-foreground">{tEdit("subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{tExt("basics")}</CardTitle>
            <CardDescription>{tExt("basicsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{tExt("name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalBasis">{tExt("legalBasis")}</Label>
                <Select
                  value={formData.legalBasis}
                  onValueChange={(value) => setFormData({ ...formData, legalBasis: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tExt("legalBasisPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGAL_BASIS_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tLegal(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">{tExt("purpose")}</Label>
              <Textarea
                id="purpose"
                rows={3}
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalBasisDetail">{tExt("legalBasisDetail")}</Label>
              <Textarea
                id="legalBasisDetail"
                rows={2}
                placeholder={tExt("legalBasisDetailPlaceholder")}
                value={formData.legalBasisDetail}
                onChange={(e) => setFormData({ ...formData, legalBasisDetail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{tExt("description")}</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tExt("subjectsAndCategories")}</CardTitle>
            <CardDescription>{tExt("subjectsAndCategoriesSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tExt("dataSubjects")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={tExt("dataSubjectsPlaceholder")}
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSubject())}
                />
                <Button type="button" variant="outline" onClick={addSubject}>{tExt("add")}</Button>
              </div>
              {formData.dataSubjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.dataSubjects.map((subject) => (
                    <Badge key={subject} variant="secondary">
                      {subject}
                      <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeSubject(subject)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tExt("dataCategories")}</Label>
              <div className="flex flex-wrap gap-2">
                {DATA_CATEGORY_KEYS.map((value) => (
                  <Badge
                    key={value}
                    variant={formData.categories.includes(value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(value)}
                  >
                    {tCat(value)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tExt("recipients")}</Label>
              <p className="text-xs text-muted-foreground">{tExt("recipientsHelp")}</p>
              <div className="flex gap-2">
                <Input
                  placeholder={tExt("recipientsPlaceholder")}
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                />
                <Button type="button" variant="outline" onClick={addRecipient}>{tExt("add")}</Button>
              </div>
              {formData.recipients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.recipients.map((recipient) => (
                    <Badge key={recipient} variant="secondary">
                      {recipient}
                      <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeRecipient(recipient)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tExt("retentionAndAutomation")}</CardTitle>
            <CardDescription>{tExt("retentionAndAutomationSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="retentionPeriod">{tExt("retentionPeriod")}</Label>
                <Input
                  id="retentionPeriod"
                  placeholder={tExt("retentionPeriodPlaceholder")}
                  value={formData.retentionPeriod}
                  onChange={(e) => setFormData({ ...formData, retentionPeriod: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retentionDays">{tExt("retentionDays")}</Label>
                <Input
                  id="retentionDays"
                  type="number"
                  min={0}
                  value={formData.retentionDays}
                  onChange={(e) => setFormData({ ...formData, retentionDays: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="automatedDecisionMaking"
                checked={formData.automatedDecisionMaking}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, automatedDecisionMaking: checked })
                }
              />
              <Label htmlFor="automatedDecisionMaking">{tExt("automatedDecisionMaking")}</Label>
            </div>
            {formData.automatedDecisionMaking && (
              <div className="space-y-2">
                <Label htmlFor="automatedDecisionDetail">{tExt("automatedDecisionDetail")}</Label>
                <Textarea
                  id="automatedDecisionDetail"
                  rows={3}
                  placeholder={tExt("automatedDecisionDetailPlaceholder")}
                  value={formData.automatedDecisionDetail}
                  onChange={(e) =>
                    setFormData({ ...formData, automatedDecisionDetail: e.target.value })
                  }
                />
              </div>
            )}
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">{tExt("isActive")}</Label>
            </div>
          </CardContent>
        </Card>

        {updateActivity.error && (
          <div className="text-sm text-destructive">{tExt("errorPrefix", { message: updateActivity.error.message })}</div>
        )}

        <div className="flex justify-end gap-4">
          <Link href={`/privacy/data-inventory/activities/${id}`}>
            <Button variant="outline" type="button">{tCommon("cancel")}</Button>
          </Link>
          <Button
            type="submit"
            disabled={
              isSubmitting || !formData.name || !formData.purpose || !formData.legalBasis
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {tEdit("saving")}
              </>
            ) : (
              tEdit("save")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

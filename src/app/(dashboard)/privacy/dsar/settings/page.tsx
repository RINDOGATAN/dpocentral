"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, ExternalLink, Copy, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const dsarTypeValues = [
  "ACCESS",
  "RECTIFICATION",
  "ERASURE",
  "PORTABILITY",
  "OBJECTION",
  "RESTRICTION",
] as const;

export default function DSARSettingsPage() {
  const { organization } = useOrganization();
  const t = useTranslations("dsarSettings");
  const tTypes = useTranslations("dsarPublic.status.typeLabels");
  const tDesc = useTranslations("dsarSettings.typeDescriptions");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const initializedRef = useRef(false);

  const [formData, setFormData] = useState({
    name: "DSAR Intake Form",
    slug: "request",
    title: "Data Subject Request",
    description: "Submit a request regarding your personal data",
    enabledTypes: ["ACCESS", "RECTIFICATION", "ERASURE", "PORTABILITY"] as string[],
    customCss: "",
    thankYouMessage: "Thank you for your request. We will process it within the legally required timeframe.",
    privacyNoticeUrl: "",
    retentionDays: 90,
    isActive: true,
  });
  const [preservedFields, setPreservedFields] = useState<unknown[]>([]);

  const { data: existingForm, isLoading } = trpc.dsar.getIntakeForm.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const saveSettings = trpc.dsar.upsertIntakeForm.useMutation({
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      console.error("Failed to save settings:", error);
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (existingForm && !initializedRef.current) {
      initializedRef.current = true;
      setFormData({
        name: existingForm.name || "DSAR Intake Form",
        slug: existingForm.slug || "request",
        title: existingForm.title || "Data Subject Request",
        description: existingForm.description || "Submit a request regarding your personal data",
        enabledTypes: (existingForm.enabledTypes as string[]) || ["ACCESS", "RECTIFICATION", "ERASURE", "PORTABILITY"],
        customCss: existingForm.customCss || "",
        thankYouMessage: existingForm.thankYouMessage || "Thank you for your request. We will process it within the legally required timeframe.",
        privacyNoticeUrl: existingForm.privacyNoticeUrl || "",
        retentionDays: existingForm.retentionDays ?? 90,
        isActive: existingForm.isActive ?? true,
      });
      if (Array.isArray(existingForm.fields)) {
        setPreservedFields(existingForm.fields as unknown[]);
      }
    }
  }, [existingForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    setIsSaving(true);

    saveSettings.mutate({
      organizationId: organization.id,
      name: formData.name,
      slug: formData.slug,
      title: formData.title,
      description: formData.description,
      fields: preservedFields,
      enabledTypes: formData.enabledTypes as any[],
      customCss: formData.customCss || undefined,
      thankYouMessage: formData.thankYouMessage || undefined,
      privacyNoticeUrl: formData.privacyNoticeUrl || undefined,
      retentionDays: Number.isFinite(formData.retentionDays) ? formData.retentionDays : 90,
      isActive: formData.isActive,
    });
  };

  const toggleType = (type: string) => {
    setFormData({
      ...formData,
      enabledTypes: formData.enabledTypes.includes(type)
        ? formData.enabledTypes.filter((t) => t !== type)
        : [...formData.enabledTypes, type],
    });
  };

  const portalUrl = organization?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/dsar/${organization.slug}`
    : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/dsar">
          <Button variant="ghost" size="icon" aria-label={t("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Portal URL */}
      <Card>
        <CardHeader>
          <CardTitle>{t("portalCard.title")}</CardTitle>
          <CardDescription>{t("portalCard.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={portalUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copyUrl} aria-label={t("portalCard.copyUrl")}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Link href={portalUrl} target="_blank">
              <Button variant="outline" size="icon" aria-label={t("portalCard.openInNewTab")}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label htmlFor="isActive">{t("portalCard.activeLabel")}</Label>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{t("formCard.title")}</CardTitle>
            <CardDescription>{t("formCard.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t("formCard.name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">{t("formCard.slug")}</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t("formCard.publicTitle")}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("formCard.formDescription")}</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thankYouMessage">{t("formCard.thankYou")}</Label>
              <Textarea
                id="thankYouMessage"
                rows={2}
                value={formData.thankYouMessage}
                onChange={(e) => setFormData({ ...formData, thankYouMessage: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Request Types */}
        <Card>
          <CardHeader>
            <CardTitle>{t("typesCard.title")}</CardTitle>
            <CardDescription>{t("typesCard.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {dsarTypeValues.map((type) => (
                <div
                  key={type}
                  className={`p-4 border cursor-pointer transition-colors ${
                    formData.enabledTypes.includes(type)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleType(type)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tTypes(type)}</span>
                    <Switch
                      checked={formData.enabledTypes.includes(type)}
                      onCheckedChange={() => toggleType(type)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{tDesc(type)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Compliance & Retention */}
        <Card>
          <CardHeader>
            <CardTitle>{t("complianceCard.title")}</CardTitle>
            <CardDescription>{t("complianceCard.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="privacyNoticeUrl">{t("complianceCard.privacyNoticeUrl")}</Label>
              <Input
                id="privacyNoticeUrl"
                type="url"
                placeholder="https://example.com/privacy"
                value={formData.privacyNoticeUrl}
                onChange={(e) => setFormData({ ...formData, privacyNoticeUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("complianceCard.privacyNoticeUrlHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retentionDays">{t("complianceCard.retentionDays")}</Label>
              <Input
                id="retentionDays"
                type="number"
                min={1}
                max={3650}
                value={formData.retentionDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    retentionDays: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">{t("complianceCard.retentionDaysHint")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Custom CSS */}
        <Card>
          <CardHeader>
            <CardTitle>{t("cssCard.title")}</CardTitle>
            <CardDescription>{t("cssCard.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="customCss"
              placeholder=".intake-form { /* your styles */ }"
              rows={4}
              className="font-mono text-sm"
              value={formData.customCss}
              onChange={(e) => setFormData({ ...formData, customCss: e.target.value })}
            />
          </CardContent>
        </Card>

        {saveSettings.error && (
          <div className="text-sm text-destructive">
            {t("actions.errorPrefix", { message: saveSettings.error.message })}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/privacy/dsar">
            <Button variant="outline" type="button">{t("actions.cancel")}</Button>
          </Link>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("actions.saving")}
              </>
            ) : (
              t("actions.save")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

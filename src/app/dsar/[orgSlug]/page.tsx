"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Shield, CheckCircle2, Loader2, AlertTriangle, Copy, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { sanitizeCss } from "@/lib/sanitize";
import { DSARType } from "@prisma/client";

const ALL_TYPES: DSARType[] = [
  "ACCESS",
  "ERASURE",
  "RECTIFICATION",
  "PORTABILITY",
  "OBJECTION",
  "RESTRICTION",
  "AUTOMATED_DECISION",
  "WITHDRAW_CONSENT",
  "OTHER",
];

export default function PublicDSARPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const locale = useLocale();
  const t = useTranslations("dsarPublic.form");

  const { data: formConfig, isLoading: configLoading, error: configError } =
    trpc.dsar.getPublicForm.useQuery({ orgSlug }, { retry: false });

  const submitMutation = trpc.dsar.submitPublic.useMutation();

  const [consentGiven, setConsentGiven] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [formData, setFormData] = useState({
    type: "" as DSARType | "",
    name: "",
    email: "",
    phone: "",
    relationship: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type) return;
    submitMutation.mutate({
      orgSlug,
      type: formData.type,
      requesterName: formData.name,
      requesterEmail: formData.email,
      requesterPhone: formData.phone || undefined,
      relationship: formData.relationship || undefined,
      description: formData.description || undefined,
      locale,
    });
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (configError || !formConfig) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>{t("loadingError.title")}</CardTitle>
            <CardDescription>{t("loadingError.description")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">{t("loadingError.hint")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitMutation.isSuccess && submitMutation.data) {
    const publicId = submitMutation.data.publicId;
    const handleCopyRef = async () => {
      try {
        await navigator.clipboard.writeText(publicId);
        setRefCopied(true);
        setTimeout(() => setRefCopied(false), 2000);
      } catch {
        // clipboard unavailable — silently ignore
      }
    };
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>{t("success.title")}</CardTitle>
            <CardDescription>
              {formConfig.thankYouMessage || t("success.fallbackDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("success.referenceLabel")}</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-lg font-mono font-semibold break-all">{publicId}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyRef}
                  aria-label={refCopied ? t("success.copiedAriaLabel") : t("success.copyAriaLabel")}
                  className="shrink-0"
                >
                  {refCopied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t("success.emailSentLead")}
              <span className="font-medium text-foreground break-all">{formData.email}</span>
              {t("success.emailSentTrail")}
            </p>
            <Button asChild className="w-full">
              <a href={`/dsar/status/${publicId}`}>{t("success.checkStatus")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enabledTypes = formConfig.enabledTypes.length > 0 ? formConfig.enabledTypes : ALL_TYPES;
  const required = t("requiredMark");

  return (
    <div className="intake-form min-h-screen bg-muted/50 py-8 px-4">
      {formConfig.customCss && (
        // sanitizeCss escapes every "<" so the CSS text can never close the
        // <style> element and inject markup; also applied at write time.
        <style dangerouslySetInnerHTML={{ __html: sanitizeCss(formConfig.customCss) }} />
      )}
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-2 text-xs text-muted-foreground">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">{formConfig.title}</h1>
          <p className="text-muted-foreground mt-1">
            {formConfig.description || t("header.fallbackDescription", { orgName: formConfig.orgName })}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("card.title")}</CardTitle>
            <CardDescription>{t("card.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>{t("fields.requestTypeLabel")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as DSARType })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("fields.requestTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        <div>
                          <p className="font-medium">{t(`types.${type}.label`)}</p>
                          <p className="text-xs text-muted-foreground">{t(`types.${type}.description`)}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("fields.name")} {required}</Label>
                  <Input
                    id="name"
                    placeholder={t("fields.namePlaceholder")}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("fields.email")} {required}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("fields.emailPlaceholder")}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("fields.phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t("fields.phonePlaceholder")}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship">{t("fields.relationshipLabel")} {required}</Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) => setFormData({ ...formData, relationship: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("fields.relationshipPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{t("relationship.customer")}</SelectItem>
                      <SelectItem value="employee">{t("relationship.employee")}</SelectItem>
                      <SelectItem value="job_applicant">{t("relationship.jobApplicant")}</SelectItem>
                      <SelectItem value="website_visitor">{t("relationship.websiteVisitor")}</SelectItem>
                      <SelectItem value="other">{t("relationship.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("fields.details")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("fields.detailsPlaceholder")}
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  {t("consent.retention", { days: formConfig.retentionDays })}
                  {formConfig.privacyNoticeUrl && (
                    <>
                      {" "}
                      <a
                        href={formConfig.privacyNoticeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {t("consent.privacyNoticeLink")}
                      </a>
                    </>
                  )}
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                  />
                  <label htmlFor="consent" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                    {t("consent.checkbox")}
                  </label>
                </div>
              </div>

              {submitMutation.error && (
                <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
                  {submitMutation.error.message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending || !consentGiven || !formData.type}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  t("submit")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

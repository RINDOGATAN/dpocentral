"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, ExternalLink, Copy, Check, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { COMING_SOON_SKILL_IDS, SKILL_PACKAGE_IDS } from "@/config/skill-packages";

const dsarTypes = [
  { value: "ACCESS", label: "Access Request", description: "Request to access personal data" },
  { value: "RECTIFICATION", label: "Rectification", description: "Request to correct data" },
  { value: "ERASURE", label: "Erasure (Right to be Forgotten)", description: "Request to delete data" },
  { value: "PORTABILITY", label: "Data Portability", description: "Request to export data" },
  { value: "OBJECTION", label: "Objection", description: "Object to data processing" },
  { value: "RESTRICTION", label: "Restriction", description: "Restrict data processing" },
];

export default function DSARSettingsPage() {
  const { organization } = useOrganization();
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
    isActive: true,
  });

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
        isActive: existingForm.isActive ?? true,
      });
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
      fields: [], // Default empty fields array
      enabledTypes: formData.enabledTypes as any[],
      customCss: formData.customCss || undefined,
      thankYouMessage: formData.thankYouMessage || undefined,
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

  if (COMING_SOON_SKILL_IDS.has(SKILL_PACKAGE_IDS.DSAR_PORTAL)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/privacy/dsar">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">DSAR Intake Settings</h1>
            <p className="text-muted-foreground">
              Configure your public data subject request portal
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              The DSAR Public Portal is currently under development. This feature will allow data subjects
              to submit access, erasure, and other GDPR requests directly through a branded intake form.
            </p>
            <Link href="/privacy/dsar">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to DSAR
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">DSAR Intake Settings</h1>
          <p className="text-muted-foreground">
            Configure your public data subject request portal
          </p>
        </div>
      </div>

      {/* Portal URL */}
      <Card>
        <CardHeader>
          <CardTitle>Public Portal</CardTitle>
          <CardDescription>
            Share this link with data subjects to submit requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={portalUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copyUrl}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Link href={portalUrl} target="_blank">
              <Button variant="outline" size="icon">
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
            <Label htmlFor="isActive">Portal is active and accepting requests</Label>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Form Configuration</CardTitle>
            <CardDescription>
              Customize the intake form appearance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Form Name (Internal)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Form Title (Public)</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Form Description</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thankYouMessage">Thank You Message</Label>
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
            <CardTitle>Enabled Request Types</CardTitle>
            <CardDescription>
              Select which types of requests can be submitted
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {dsarTypes.map((type) => (
                <div
                  key={type.value}
                  className={`p-4 border cursor-pointer transition-colors ${
                    formData.enabledTypes.includes(type.value)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleType(type.value)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{type.label}</span>
                    <Switch
                      checked={formData.enabledTypes.includes(type.value)}
                      onCheckedChange={() => toggleType(type.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom CSS */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Styling</CardTitle>
            <CardDescription>
              Add custom CSS to match your brand (optional)
            </CardDescription>
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
            Error: {saveSettings.error.message}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/privacy/dsar">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

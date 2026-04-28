"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const INCIDENT_TYPE_KEYS = [
  "DATA_BREACH", "UNAUTHORIZED_ACCESS", "DATA_LOSS", "SYSTEM_COMPROMISE",
  "PHISHING", "RANSOMWARE", "INSIDER_THREAT", "PHYSICAL_SECURITY",
  "VENDOR_INCIDENT", "OTHER",
] as const;

const SEVERITY_KEYS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const DATA_CATEGORY_KEYS = [
  "IDENTIFIERS", "DEMOGRAPHICS", "FINANCIAL", "HEALTH", "BIOMETRIC",
  "LOCATION", "BEHAVIORAL", "EMPLOYMENT", "CRIMINAL", "OTHER",
] as const;

const DISCOVERY_METHOD_KEYS = [
  "INTERNAL_MONITORING", "EMPLOYEE_REPORT", "CUSTOMER_REPORT",
  "THIRD_PARTY", "SECURITY_AUDIT", "LAW_ENFORCEMENT", "OTHER",
] as const;

export default function NewIncidentPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newIncident");
  const tCommon = useTranslations("common");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    severity: "",
    discoveredAt: new Date().toISOString().split("T")[0],
    discoveredBy: "",
    discoveryMethod: "",
    affectedRecords: "",
    affectedSubjects: [] as string[],
    dataCategories: [] as string[],
  });

  const utils = trpc.useUtils();

  const { data: jurisdictions } = trpc.organization.listJurisdictions.useQuery();

  const createIncident = trpc.incident.create.useMutation({
    onSuccess: (data) => {
      toast.success(t("incident.created"));
      utils.incident.list.invalidate();
      router.push(`/privacy/incidents/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.title || !formData.type || !formData.severity) return;

    setIsSubmitting(true);

    createIncident.mutate({
      organizationId: organization.id,
      title: formData.title,
      description: formData.description,
      type: formData.type as any,
      severity: formData.severity as any,
      discoveredAt: new Date(formData.discoveredAt),
      discoveredBy: formData.discoveredBy || undefined,
      discoveryMethod: formData.discoveryMethod || undefined,
      affectedRecords: formData.affectedRecords ? parseInt(formData.affectedRecords) : undefined,
      affectedSubjects: formData.affectedSubjects,
      dataCategories: formData.dataCategories as any[],
      jurisdictionId: jurisdictions?.[0]?.id,
    });
  };

  const toggleDataCategory = (value: string) => {
    setFormData({
      ...formData,
      dataCategories: formData.dataCategories.includes(value)
        ? formData.dataCategories.filter((c) => c !== value)
        : [...formData.dataCategories, value],
    });
  };

  const isHighSeverity = formData.severity === "HIGH" || formData.severity === "CRITICAL";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/incidents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tp("title")}</h1>
          <p className="text-muted-foreground">{tp("subtitle")}</p>
        </div>
      </div>

      {isHighSeverity && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <div>
              <p className="font-medium">{tp("highSeverityTitle")}</p>
              <p className="text-sm text-muted-foreground">{tp("highSeverityBody")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{tp("details")}</CardTitle>
            <CardDescription>{tp("detailsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{tp("incidentTitle")}</Label>
              <Input
                id="title"
                placeholder={tp("titlePlaceholder")}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">{tp("type")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tp("typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPE_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tp(`incidentType.${value}` as `incidentType.DATA_BREACH` | `incidentType.UNAUTHORIZED_ACCESS` | `incidentType.DATA_LOSS` | `incidentType.SYSTEM_COMPROMISE` | `incidentType.PHISHING` | `incidentType.RANSOMWARE` | `incidentType.INSIDER_THREAT` | `incidentType.PHYSICAL_SECURITY` | `incidentType.VENDOR_INCIDENT` | `incidentType.OTHER`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">{tp("severity")}</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tp("severityPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        <div>
                          <span className="font-medium">{tp(`severityOption.${value}` as `severityOption.LOW` | `severityOption.MEDIUM` | `severityOption.HIGH` | `severityOption.CRITICAL`)}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{tp(`severityOption.${value}_desc` as `severityOption.LOW_desc` | `severityOption.MEDIUM_desc` | `severityOption.HIGH_desc` | `severityOption.CRITICAL_desc`)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{tp("description")}</Label>
              <Textarea
                id="description"
                placeholder={tp("descriptionPlaceholder")}
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tp("discovery")}</CardTitle>
            <CardDescription>{tp("discoverySubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discoveredAt">{tp("discoveredAt")}</Label>
                <Input
                  id="discoveredAt"
                  type="date"
                  value={formData.discoveredAt}
                  onChange={(e) => setFormData({ ...formData, discoveredAt: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discoveryMethod">{tp("discoveryMethod")}</Label>
                <Select
                  value={formData.discoveryMethod}
                  onValueChange={(value) => setFormData({ ...formData, discoveryMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tp("discoveryMethodPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOVERY_METHOD_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tp(`discoveryMethodOption.${value}` as `discoveryMethodOption.INTERNAL_MONITORING` | `discoveryMethodOption.EMPLOYEE_REPORT` | `discoveryMethodOption.CUSTOMER_REPORT` | `discoveryMethodOption.THIRD_PARTY` | `discoveryMethodOption.SECURITY_AUDIT` | `discoveryMethodOption.LAW_ENFORCEMENT` | `discoveryMethodOption.OTHER`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discoveredBy">{tp("discoveredBy")}</Label>
              <Input
                id="discoveredBy"
                placeholder={tp("discoveredByPlaceholder")}
                value={formData.discoveredBy}
                onChange={(e) => setFormData({ ...formData, discoveredBy: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tp("impact")}</CardTitle>
            <CardDescription>{tp("impactSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="affectedRecords">{tp("affectedRecords")}</Label>
              <Input
                id="affectedRecords"
                type="number"
                placeholder={tp("affectedRecordsPlaceholder")}
                value={formData.affectedRecords}
                onChange={(e) => setFormData({ ...formData, affectedRecords: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{tp("dataCategoriesLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {DATA_CATEGORY_KEYS.map((value) => (
                  <Badge
                    key={value}
                    variant={formData.dataCategories.includes(value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleDataCategory(value)}
                  >
                    {tp(`dataCategory.${value}` as `dataCategory.IDENTIFIERS` | `dataCategory.DEMOGRAPHICS` | `dataCategory.FINANCIAL` | `dataCategory.HEALTH` | `dataCategory.BIOMETRIC` | `dataCategory.LOCATION` | `dataCategory.BEHAVIORAL` | `dataCategory.EMPLOYMENT` | `dataCategory.CRIMINAL` | `dataCategory.OTHER`)}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {createIncident.error && (
          <div className="text-sm text-destructive">
            {tp("errorPrefix", { message: createIncident.error.message })}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/privacy/incidents">
            <Button variant="outline" type="button">{tCommon("cancel")}</Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting || !formData.title || !formData.type || !formData.severity}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {tp("reporting")}
              </>
            ) : (
              tp("submit")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

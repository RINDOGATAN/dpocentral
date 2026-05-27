"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ArrowLeft, Loader2, X } from "lucide-react";
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

const AFFECTED_SUBJECT_PRESETS = [
  "CUSTOMERS", "EMPLOYEES", "JOB_APPLICANTS", "SUPPLIERS",
  "WEBSITE_VISITORS", "CHILDREN", "PATIENTS", "STUDENTS",
] as const;

export default function EditIncidentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.newIncident");
  const tEdit = useTranslations("pages.editIncident");
  const tCommon = useTranslations("common");

  const initializedRef = useRef(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    severity: "",
    discoveredAt: "",
    discoveredBy: "",
    discoveryMethod: "",
    affectedRecords: "",
    affectedSubjects: [] as string[],
    dataCategories: [] as string[],
    jurisdictionId: "",
    rootCause: "",
    rootCauseCategory: "",
    containmentActions: "",
    resolutionNotes: "",
    lessonsLearned: "",
  });
  const [customSubject, setCustomSubject] = useState("");

  const { data: incident, isLoading } = trpc.incident.getById.useQuery(
    { organizationId: orgId, id },
    { enabled: !!orgId && !!id }
  );

  const { data: jurisdictions } = trpc.organization.listJurisdictions.useQuery();

  useEffect(() => {
    if (incident && !initializedRef.current) {
      initializedRef.current = true;
      setFormData({
        title: incident.title || "",
        description: incident.description || "",
        type: incident.type as string,
        severity: incident.severity as string,
        discoveredAt: incident.discoveredAt
          ? new Date(incident.discoveredAt).toISOString().split("T")[0]!
          : "",
        discoveredBy: incident.discoveredBy || "",
        discoveryMethod: incident.discoveryMethod || "",
        affectedRecords: incident.affectedRecords != null ? String(incident.affectedRecords) : "",
        affectedSubjects: (incident.affectedSubjects as string[]) || [],
        dataCategories: (incident.dataCategories as string[]) || [],
        jurisdictionId: incident.jurisdictionId || "",
        rootCause: incident.rootCause || "",
        rootCauseCategory: incident.rootCauseCategory || "",
        containmentActions: incident.containmentActions || "",
        resolutionNotes: incident.resolutionNotes || "",
        lessonsLearned: incident.lessonsLearned || "",
      });
    }
  }, [incident]);

  const utils = trpc.useUtils();

  const updateIncident = trpc.incident.update.useMutation({
    onSuccess: () => {
      toast.success(t("incident.updated"));
      utils.incident.getById.invalidate({ organizationId: orgId, id });
      utils.incident.list.invalidate();
      router.push(`/privacy/incidents/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !formData.title || !formData.type || !formData.severity) return;
    setIsSubmitting(true);
    updateIncident.mutate({
      organizationId: orgId,
      id,
      title: formData.title,
      description: formData.description,
      type: formData.type as any,
      severity: formData.severity as any,
      discoveredAt: formData.discoveredAt ? new Date(formData.discoveredAt) : undefined,
      discoveredBy: formData.discoveredBy || null,
      discoveryMethod: formData.discoveryMethod || null,
      jurisdictionId: formData.jurisdictionId || null,
      affectedRecords: formData.affectedRecords ? parseInt(formData.affectedRecords, 10) : null,
      affectedSubjects: formData.affectedSubjects,
      dataCategories: formData.dataCategories as any,
      rootCause: formData.rootCause || null,
      rootCauseCategory: formData.rootCauseCategory || null,
      containmentActions: formData.containmentActions || null,
      resolutionNotes: formData.resolutionNotes || null,
      lessonsLearned: formData.lessonsLearned || null,
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

  const toggleSubject = (value: string) => {
    setFormData({
      ...formData,
      affectedSubjects: formData.affectedSubjects.includes(value)
        ? formData.affectedSubjects.filter((s) => s !== value)
        : [...formData.affectedSubjects, value],
    });
  };
  const addCustomSubject = () => {
    const value = customSubject.trim();
    if (!value || formData.affectedSubjects.includes(value)) return;
    setFormData({ ...formData, affectedSubjects: [...formData.affectedSubjects, value] });
    setCustomSubject("");
  };
  const removeSubject = (value: string) => {
    setFormData({
      ...formData,
      affectedSubjects: formData.affectedSubjects.filter((s) => s !== value),
    });
  };

  if (isLoading || !incident) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/privacy/incidents/${id}`}>
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
            <CardTitle>{tp("details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{tp("incidentTitle")}</Label>
              <Input
                id="title"
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
                >
                  <SelectTrigger>
                    <SelectValue />
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
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_KEYS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tp(`severityOption.${value}` as `severityOption.LOW` | `severityOption.MEDIUM` | `severityOption.HIGH` | `severityOption.CRITICAL`)}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discoveryMethod">{tp("discoveryMethod")}</Label>
                <Select
                  value={formData.discoveryMethod || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, discoveryMethod: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tp("discoveryMethodPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
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
                value={formData.discoveredBy}
                onChange={(e) => setFormData({ ...formData, discoveredBy: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tp("impact")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="affectedRecords">{tp("affectedRecords")}</Label>
              <Input
                id="affectedRecords"
                type="number"
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

            <div className="space-y-2">
              <Label>{tp("affectedSubjectsLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {AFFECTED_SUBJECT_PRESETS.map((value) => (
                  <Badge
                    key={value}
                    variant={formData.affectedSubjects.includes(value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSubject(value)}
                  >
                    {tp(`affectedSubject.${value}` as `affectedSubject.CUSTOMERS` | `affectedSubject.EMPLOYEES` | `affectedSubject.JOB_APPLICANTS` | `affectedSubject.SUPPLIERS` | `affectedSubject.WEBSITE_VISITORS` | `affectedSubject.CHILDREN` | `affectedSubject.PATIENTS` | `affectedSubject.STUDENTS`)}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={tp("affectedSubjectsCustomPlaceholder")}
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSubject())}
                />
                <Button type="button" variant="outline" onClick={addCustomSubject}>
                  {tp("affectedSubjectsAdd")}
                </Button>
              </div>
              {formData.affectedSubjects.some((s) => !AFFECTED_SUBJECT_PRESETS.includes(s as typeof AFFECTED_SUBJECT_PRESETS[number])) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.affectedSubjects
                    .filter((s) => !AFFECTED_SUBJECT_PRESETS.includes(s as typeof AFFECTED_SUBJECT_PRESETS[number]))
                    .map((subject) => (
                      <Badge key={subject} variant="secondary">
                        {subject}
                        <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeSubject(subject)} />
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            {jurisdictions && jurisdictions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="jurisdictionId">{tp("jurisdiction")}</Label>
                <Select
                  value={formData.jurisdictionId || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, jurisdictionId: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tp("jurisdictionPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {jurisdictions.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tEdit("investigation")}</CardTitle>
            <CardDescription>{tEdit("investigationSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rootCauseCategory">{tEdit("rootCauseCategory")}</Label>
                <Input
                  id="rootCauseCategory"
                  placeholder={tEdit("rootCauseCategoryPlaceholder")}
                  value={formData.rootCauseCategory}
                  onChange={(e) => setFormData({ ...formData, rootCauseCategory: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rootCause">{tEdit("rootCause")}</Label>
              <Textarea
                id="rootCause"
                rows={3}
                placeholder={tEdit("rootCausePlaceholder")}
                value={formData.rootCause}
                onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="containmentActions">{tEdit("containmentActions")}</Label>
              <Textarea
                id="containmentActions"
                rows={3}
                placeholder={tEdit("containmentActionsPlaceholder")}
                value={formData.containmentActions}
                onChange={(e) => setFormData({ ...formData, containmentActions: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolutionNotes">{tEdit("resolutionNotes")}</Label>
              <Textarea
                id="resolutionNotes"
                rows={3}
                placeholder={tEdit("resolutionNotesPlaceholder")}
                value={formData.resolutionNotes}
                onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lessonsLearned">{tEdit("lessonsLearned")}</Label>
              <Textarea
                id="lessonsLearned"
                rows={3}
                placeholder={tEdit("lessonsLearnedPlaceholder")}
                value={formData.lessonsLearned}
                onChange={(e) => setFormData({ ...formData, lessonsLearned: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {updateIncident.error && (
          <div className="text-sm text-destructive">{tEdit("errorPrefix", { message: updateIncident.error.message })}</div>
        )}

        <div className="flex justify-end gap-4">
          <Link href={`/privacy/incidents/${id}`}>
            <Button variant="outline" type="button">{tCommon("cancel")}</Button>
          </Link>
          <Button
            type="submit"
            disabled={
              isSubmitting || !formData.title || !formData.type || !formData.severity
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

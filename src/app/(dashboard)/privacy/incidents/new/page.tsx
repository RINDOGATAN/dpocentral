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
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const incidentTypes = [
  { value: "DATA_BREACH", label: "Data Breach" },
  { value: "UNAUTHORIZED_ACCESS", label: "Unauthorized Access" },
  { value: "DATA_LOSS", label: "Data Loss" },
  { value: "SYSTEM_COMPROMISE", label: "System Compromise" },
  { value: "PHISHING", label: "Phishing" },
  { value: "RANSOMWARE", label: "Ransomware" },
  { value: "INSIDER_THREAT", label: "Insider Threat" },
  { value: "PHYSICAL_SECURITY", label: "Physical Security" },
  { value: "VENDOR_INCIDENT", label: "Vendor Incident" },
  { value: "OTHER", label: "Other" },
];

const severities = [
  { value: "LOW", label: "Low", description: "Minimal impact, no data exposed" },
  { value: "MEDIUM", label: "Medium", description: "Limited impact, some data at risk" },
  { value: "HIGH", label: "High", description: "Significant impact, sensitive data exposed" },
  { value: "CRITICAL", label: "Critical", description: "Severe impact, major breach" },
];

const dataCategories = [
  { value: "IDENTIFIERS", label: "Identifiers (Name, Email, ID)" },
  { value: "DEMOGRAPHICS", label: "Demographics" },
  { value: "FINANCIAL", label: "Financial Data" },
  { value: "HEALTH", label: "Health Information" },
  { value: "BIOMETRIC", label: "Biometric Data" },
  { value: "LOCATION", label: "Location Data" },
  { value: "BEHAVIORAL", label: "Behavioral Data" },
  { value: "EMPLOYMENT", label: "Employment Data" },
  { value: "CRIMINAL", label: "Criminal Records" },
  { value: "OTHER", label: "Other" },
];

const discoveryMethods = [
  { value: "INTERNAL_MONITORING", label: "Internal Monitoring" },
  { value: "EMPLOYEE_REPORT", label: "Employee Report" },
  { value: "CUSTOMER_REPORT", label: "Customer Report" },
  { value: "THIRD_PARTY", label: "Third Party Notification" },
  { value: "SECURITY_AUDIT", label: "Security Audit" },
  { value: "LAW_ENFORCEMENT", label: "Law Enforcement" },
  { value: "OTHER", label: "Other" },
];

export default function NewIncidentPage() {
  const router = useRouter();
  const { organization } = useOrganization();
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
      utils.incident.list.invalidate();
      router.push(`/privacy/incidents/${data.id}`);
    },
    onError: (error) => {
      console.error("Failed to create incident:", error);
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
          <h1 className="text-2xl font-semibold">Report Incident</h1>
          <p className="text-muted-foreground">
            Document a security incident or data breach
          </p>
        </div>
      </div>

      {isHighSeverity && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <div>
              <p className="font-medium">High/Critical Severity Selected</p>
              <p className="text-sm text-muted-foreground">
                This incident may require regulatory notification within 72 hours (GDPR) or other timeframes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Incident Details</CardTitle>
            <CardDescription>
              Describe the incident and its discovery
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Incident Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the incident"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Incident Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity *</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severities.map((sev) => (
                      <SelectItem key={sev.value} value={sev.value}>
                        <div>
                          <span className="font-medium">{sev.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{sev.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Full Description</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about what happened..."
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discovery Information</CardTitle>
            <CardDescription>
              When and how was the incident discovered?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discoveredAt">Discovery Date *</Label>
                <Input
                  id="discoveredAt"
                  type="date"
                  value={formData.discoveredAt}
                  onChange={(e) => setFormData({ ...formData, discoveredAt: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discoveryMethod">Discovery Method</Label>
                <Select
                  value={formData.discoveryMethod}
                  onValueChange={(value) => setFormData({ ...formData, discoveryMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="How was it discovered?" />
                  </SelectTrigger>
                  <SelectContent>
                    {discoveryMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discoveredBy">Discovered By</Label>
              <Input
                id="discoveredBy"
                placeholder="Name or role of person/system that discovered the incident"
                value={formData.discoveredBy}
                onChange={(e) => setFormData({ ...formData, discoveredBy: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impact Assessment</CardTitle>
            <CardDescription>
              Estimate the scope and nature of affected data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="affectedRecords">Estimated Affected Records</Label>
              <Input
                id="affectedRecords"
                type="number"
                placeholder="e.g., 1000"
                value={formData.affectedRecords}
                onChange={(e) => setFormData({ ...formData, affectedRecords: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Categories Affected</Label>
              <div className="flex flex-wrap gap-2">
                {dataCategories.map((cat) => (
                  <Badge
                    key={cat.value}
                    variant={formData.dataCategories.includes(cat.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleDataCategory(cat.value)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {createIncident.error && (
          <div className="text-sm text-destructive">
            Error: {createIncident.error.message}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/privacy/incidents">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting || !formData.title || !formData.type || !formData.severity}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reporting...
              </>
            ) : (
              "Report Incident"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

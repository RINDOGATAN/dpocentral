"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Database, Loader2, Server, Workflow } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { DataCategory, DataSensitivity } from "@prisma/client";

const sensitivityColors: Record<string, string> = {
  PUBLIC: "border-primary text-primary",
  INTERNAL: "border-primary text-primary",
  CONFIDENTIAL: "border-muted-foreground text-muted-foreground",
  RESTRICTED: "border-muted-foreground bg-muted-foreground/20 text-foreground",
  SPECIAL_CATEGORY: "border-muted-foreground bg-muted-foreground text-foreground",
};

const categoryLabels: Record<DataCategory, string> = {
  IDENTIFIERS: "Identifiers",
  DEMOGRAPHICS: "Demographics",
  FINANCIAL: "Financial",
  HEALTH: "Health",
  BIOMETRIC: "Biometric",
  LOCATION: "Location",
  BEHAVIORAL: "Behavioral",
  EMPLOYMENT: "Employment",
  EDUCATION: "Education",
  POLITICAL: "Political",
  RELIGIOUS: "Religious",
  GENETIC: "Genetic",
  SEXUAL_ORIENTATION: "Sexual Orientation",
  CRIMINAL: "Criminal",
  OTHER: "Other",
};

const sensitivityLabels: Record<DataSensitivity, string> = {
  PUBLIC: "Public",
  INTERNAL: "Internal",
  CONFIDENTIAL: "Confidential",
  RESTRICTED: "Restricted",
  SPECIAL_CATEGORY: "Special Category",
};

const legalBasisLabels: Record<string, string> = {
  CONSENT: "Consent",
  CONTRACT: "Contract",
  LEGAL_OBLIGATION: "Legal Obligation",
  VITAL_INTERESTS: "Vital Interests",
  PUBLIC_TASK: "Public Task",
  LEGITIMATE_INTERESTS: "Legitimate Interests",
};

export default function DataElementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();

  const { data: element, isLoading } = trpc.dataInventory.getElement.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  if (isLoading || !element) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/privacy/data-inventory/${element.dataAsset.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 flex items-center justify-center">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold font-mono">{element.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{categoryLabels[element.category]}</Badge>
              <Badge variant="outline" className={sensitivityColors[element.sensitivity] || ""}>
                {sensitivityLabels[element.sensitivity]}
              </Badge>
              {element.isPersonalData && <Badge variant="outline">Personal Data</Badge>}
              {element.isSpecialCategory && <Badge variant="destructive">Special Category</Badge>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {element.description || "No description provided"}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Retention</p>
                <p className="font-medium">
                  {element.retentionDays ? `${element.retentionDays} days` : "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Legal Basis</p>
                <p className="font-medium">{element.legalBasis || "Not specified"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parent Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/privacy/data-inventory/${element.dataAsset.id}`}
              className="block border rounded-lg p-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{element.dataAsset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {element.dataAsset.type}
                      {element.dataAsset.vendor ? ` — ${element.dataAsset.vendor}` : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked Processing Activities</CardTitle>
          <CardDescription>
            Activities that explicitly process this data element
          </CardDescription>
        </CardHeader>
        <CardContent>
          {element.linkedActivities.length > 0 ? (
            <div className="space-y-2">
              {element.linkedActivities.map(({ linkId, activity }) => (
                <Link
                  key={linkId}
                  href={`/privacy/data-inventory/activities/${activity.id}`}
                  className="block border rounded-lg p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{activity.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {legalBasisLabels[activity.legalBasis] || activity.legalBasis}
                          {activity.purpose && ` — ${activity.purpose}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!activity.isActive && (
                        <Badge variant="outline" className="text-xs">Inactive</Badge>
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Workflow className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No processing activities linked to this element</p>
              <p className="text-sm">
                Open the parent asset and use &ldquo;Manage Activities&rdquo; to link one
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

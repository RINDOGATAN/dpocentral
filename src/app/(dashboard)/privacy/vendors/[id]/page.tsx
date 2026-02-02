"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Mail,
  User,
  Globe,
  Shield,
  FileText,
  Clock,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const statusColors: Record<string, string> = {
  PROSPECTIVE: "border-muted-foreground text-muted-foreground",
  ACTIVE: "border-primary bg-primary text-primary-foreground",
  UNDER_REVIEW: "border-muted-foreground text-muted-foreground",
  SUSPENDED: "border-destructive text-destructive",
  TERMINATED: "border-muted-foreground text-muted-foreground",
};

const riskColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-destructive/50 bg-destructive/20 text-foreground",
  CRITICAL: "border-destructive bg-destructive text-destructive-foreground",
};

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organization } = useOrganization();

  const { data: vendor, isLoading } = trpc.vendor.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  const deleteVendor = trpc.vendor.delete.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      router.push("/privacy/vendors");
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      deleteVendor.mutate({ organizationId: organization?.id ?? "", id });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Vendor not found</p>
        <Link href="/privacy/vendors">
          <Button variant="outline" className="mt-4">
            Back to Vendors
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/vendors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{vendor.name}</h1>
              <Badge variant="outline" className={statusColors[vendor.status] || ""}>
                {vendor.status.replace("_", " ")}
              </Badge>
              {vendor.riskTier && (
                <Badge variant="outline" className={riskColors[vendor.riskTier] || ""}>
                  {vendor.riskTier} Risk
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {(vendor.categories as string[])?.join(" - ") || "No categories"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={deleteVendor.isPending}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button>Edit Vendor</Button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-sm">Website</span>
            </div>
            {vendor.website ? (
              <a
                href={vendor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {new URL(vendor.website).hostname}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="w-4 h-4" />
              <span className="text-sm">Contact</span>
            </div>
            <p className="font-medium">{vendor.primaryContact || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Mail className="w-4 h-4" />
              <span className="text-sm">Email</span>
            </div>
            {vendor.contactEmail ? (
              <a href={`mailto:${vendor.contactEmail}`} className="text-primary hover:underline">
                {vendor.contactEmail}
              </a>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Added</span>
            </div>
            <p className="font-medium">{new Date(vendor.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Contracts ({vendor.contracts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {vendor.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{vendor.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Processing</CardTitle>
                <CardDescription>Categories of data this vendor processes</CardDescription>
              </CardHeader>
              <CardContent>
                {(vendor.dataProcessed as string[])?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(vendor.dataProcessed as string[]).map((data) => (
                      <Badge key={data} variant="outline">
                        {data.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data categories specified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Countries</CardTitle>
                <CardDescription>Data transfer locations</CardDescription>
              </CardHeader>
              <CardContent>
                {(vendor.countries as string[])?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(vendor.countries as string[]).map((country) => (
                      <Badge key={country} variant="secondary">
                        {country}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No countries specified</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Certifications</CardTitle>
              <CardDescription>Security and compliance certifications</CardDescription>
            </CardHeader>
            <CardContent>
              {(vendor.certifications as string[])?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(vendor.certifications as string[]).map((cert) => (
                    <Badge key={cert} variant="outline">
                      <Shield className="w-3 h-3 mr-1" />
                      {cert}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No certifications recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          {vendor.contracts && vendor.contracts.length > 0 ? (
            <div className="space-y-4">
              {vendor.contracts.map((contract) => (
                <Card key={contract.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="font-medium">{contract.name}</span>
                          <Badge variant="outline">{contract.type}</Badge>
                          <Badge variant="outline">{contract.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {contract.startDate && (
                            <>
                              Start: {new Date(contract.startDate).toLocaleDateString()}
                              {contract.endDate && (
                                <> - End: {new Date(contract.endDate).toLocaleDateString()}</>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No contracts recorded</p>
                <Button className="mt-4">Add Contract</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No vendor assessments completed</p>
              <Link href="/privacy/assessments/new">
                <Button className="mt-4">Start Assessment</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No reviews scheduled</p>
              <Button className="mt-4">Schedule Review</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

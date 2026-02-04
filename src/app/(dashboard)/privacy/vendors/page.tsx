"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Plus,
  Search,
  FileText,
  Shield,
  Clock,
  AlertTriangle,
  Filter,
  Loader2,
  Database,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const statusColors: Record<string, string> = {
  PROSPECTIVE: "border-muted-foreground text-muted-foreground",
  ACTIVE: "border-primary bg-primary text-primary-foreground",
  UNDER_REVIEW: "border-muted-foreground text-muted-foreground",
  SUSPENDED: "border-muted-foreground text-muted-foreground",
  TERMINATED: "border-muted-foreground text-muted-foreground",
};

const riskColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-muted-foreground bg-muted-foreground/20 text-foreground",
  CRITICAL: "border-muted-foreground bg-muted-foreground text-foreground",
};

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();

  const { data: vendorsData, isLoading } = trpc.vendor.list.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: statsData } = trpc.vendor.getStats.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const { data: catalogAccess } = trpc.vendor.hasVendorCatalogAccess.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const hasVendorCatalog = catalogAccess?.hasAccess ?? false;

  const vendors = vendorsData?.vendors ?? [];
  const byStatus = statsData?.byStatus as Record<string, number> | undefined;
  const byRiskTier = statsData?.byRiskTier as Record<string, number> | undefined;
  const stats = {
    total: vendors.length,
    active: byStatus?.ACTIVE ?? 0,
    highRisk: (byRiskTier?.HIGH ?? 0) + (byRiskTier?.CRITICAL ?? 0),
    pendingReview: byStatus?.UNDER_REVIEW ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendor Management</h1>
          <p className="text-muted-foreground">
            Manage third-party vendors and data processors
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/privacy/vendors/questionnaires">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Questionnaires
            </Button>
          </Link>
          <Link href="/privacy/vendors/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Vendors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.active}</div>
            <p className="text-sm text-muted-foreground">Active Vendors</p>
          </CardContent>
        </Card>
        <Card className={stats.highRisk > 0 ? "border-muted-foreground" : ""}>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${stats.highRisk > 0 ? "text-foreground" : "text-primary"}`}>
              {stats.highRisk > 0 && <span className="bg-destructive/20 px-2 py-0.5">{stats.highRisk}</span>}
              {stats.highRisk === 0 && stats.highRisk}
            </div>
            <p className="text-sm text-muted-foreground">High Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.pendingReview}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Catalog Feature Card */}
      {hasVendorCatalog ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
                  <Database className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Vendor Catalog</h3>
                    <Badge className="bg-primary">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Search 400+ pre-audited MarTech, AI, and SaaS vendors
                  </p>
                </div>
              </div>
              <Link href="/privacy/vendors/new?catalog=true">
                <Button>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Add from Catalog
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border-2 border-amber-500 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Vendor Catalog</h3>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      Premium
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get access to 400+ pre-audited vendors with compliance data, certifications, and DPA links
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <a href="mailto:hello@northend.law?subject=DPO%20Central%20Vendor%20Catalog">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Us
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Vendors</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="review">Under Review</TabsTrigger>
          <TabsTrigger value="high-risk">High Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : vendors.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {vendors.map((vendor) => (
                <Link key={vendor.id} href={`/privacy/vendors/${vendor.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className={statusColors[vendor.status] || ""}>
                            {vendor.status.replace("_", " ")}
                          </Badge>
                          {vendor.riskTier && (
                            <Badge variant="outline" className={riskColors[vendor.riskTier] || ""}>
                              {vendor.riskTier} Risk
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardTitle className="mt-3">{vendor.name}</CardTitle>
                      <CardDescription>
                        {(vendor.categories as string[])?.join(" - ") || "No categories"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Data Processed */}
                      {vendor.dataProcessed && (vendor.dataProcessed as string[]).length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Data Processed</p>
                          <div className="flex flex-wrap gap-1">
                            {(vendor.dataProcessed as string[]).slice(0, 3).map((data) => (
                              <Badge key={data} variant="outline" className="text-xs">
                                {data.replace("_", " ")}
                              </Badge>
                            ))}
                            {(vendor.dataProcessed as string[]).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(vendor.dataProcessed as string[]).length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                        <span>
                          <Clock className="inline w-3 h-3 mr-1" />
                          Added: {new Date(vendor.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No vendors yet</p>
                <p className="text-sm mb-4">Add your first vendor to track third-party risk</p>
                <Link href="/privacy/vendors/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vendor
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          <p className="text-muted-foreground">Active vendors will be filtered here</p>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <p className="text-muted-foreground">Vendors under review will be filtered here</p>
        </TabsContent>

        <TabsContent value="high-risk" className="mt-4">
          <p className="text-muted-foreground">High risk vendors will be filtered here</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

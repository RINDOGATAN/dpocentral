"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Plus,
  Search,
  Server,
  Cloud,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  Filter,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const assetTypeIcons: Record<string, any> = {
  DATABASE: Server,
  APPLICATION: Database,
  CLOUD_SERVICE: Cloud,
  THIRD_PARTY: Building2,
  FILE_SYSTEM: FileSpreadsheet,
};

export default function DataInventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();

  const { data: assetsData, isLoading: assetsLoading } = trpc.dataInventory.listAssets.useQuery(
    { organizationId: organization?.id ?? "", search: searchQuery || undefined },
    { enabled: !!organization?.id }
  );

  const { data: activitiesData, isLoading: activitiesLoading } = trpc.dataInventory.listActivities.useQuery(
    { organizationId: organization?.id ?? "", search: searchQuery || undefined },
    { enabled: !!organization?.id }
  );

  const dataAssets = assetsData?.assets ?? [];
  const processingActivities = activitiesData?.activities ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Data Inventory</h1>
          <p className="text-muted-foreground">
            Manage your data assets and processing activities
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/privacy/data-inventory/processing-activities">
            <Button variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export ROPA
            </Button>
          </Link>
          <Link href="/privacy/data-inventory/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Asset
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets or activities..."
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
      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Data Assets ({dataAssets.length})</TabsTrigger>
          <TabsTrigger value="activities">Processing Activities ({processingActivities.length})</TabsTrigger>
          <TabsTrigger value="flows">Data Flows</TabsTrigger>
          <TabsTrigger value="transfers">Cross-Border Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-4">
          {assetsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : dataAssets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dataAssets.map((asset) => {
                const Icon = assetTypeIcons[asset.type] || Database;
                return (
                  <Link key={asset.id} href={`/privacy/data-inventory/${asset.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <Badge variant="outline">{asset.type.replace("_", " ")}</Badge>
                        </div>
                        <CardTitle className="mt-3">{asset.name}</CardTitle>
                        <CardDescription>{asset.owner || "No owner"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {asset._count?.dataElements ?? 0} data elements
                          </span>
                          <span className="text-muted-foreground">
                            {asset._count?.processingActivityAssets ?? 0} activities
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {asset.location || "No location specified"}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No data assets yet</p>
                <p className="text-sm mb-4">Start by adding your first data asset</p>
                <Link href="/privacy/data-inventory/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Asset
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : processingActivities.length > 0 ? (
            <div className="space-y-4">
              {processingActivities.map((activity) => (
                <Card key={activity.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{activity.name}</CardTitle>
                        <CardDescription>{activity.purpose}</CardDescription>
                      </div>
                      <Badge>{activity.legalBasis?.replace("_", " ") || "No basis"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{activity.assets?.length ?? 0} assets</span>
                        <span>{(activity.dataSubjects as string[])?.join(", ") || "No subjects"}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No processing activities yet</p>
                <p className="text-sm">Document your data processing activities for ROPA compliance</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="flows" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Data flow visualization coming soon</p>
              <p className="text-sm">Track how data moves between your systems</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Cross-border transfer records</p>
              <p className="text-sm">Document international data transfers and safeguards</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

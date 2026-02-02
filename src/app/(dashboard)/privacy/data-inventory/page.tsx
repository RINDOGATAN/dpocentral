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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Data Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Manage data assets and processing activities
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/privacy/data-inventory/processing-activities" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto">
              <FileSpreadsheet className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export ROPA</span>
            </Button>
          </Link>
          <Link href="/privacy/data-inventory/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Asset</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0 sm:hidden">
          <Filter className="w-4 h-4" />
        </Button>
        <Button variant="outline" className="shrink-0 hidden sm:flex">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assets">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="assets" className="text-xs sm:text-sm">
            Assets ({dataAssets.length})
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs sm:text-sm">
            Activities ({processingActivities.length})
          </TabsTrigger>
          <TabsTrigger value="flows" className="text-xs sm:text-sm hidden sm:inline-flex">
            Data Flows
          </TabsTrigger>
          <TabsTrigger value="transfers" className="text-xs sm:text-sm hidden sm:inline-flex">
            Transfers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-4">
          {assetsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : dataAssets.length > 0 ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {dataAssets.map((asset) => {
                const Icon = assetTypeIcons[asset.type] || Database;
                return (
                  <Link key={asset.id} href={`/privacy/data-inventory/${asset.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                      <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {asset.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <CardTitle className="mt-3 text-base sm:text-lg line-clamp-1">{asset.name}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">{asset.owner || "No owner"}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">
                            {asset._count?.dataElements ?? 0} elements
                          </span>
                          <span className="text-muted-foreground">
                            {asset._count?.processingActivityAssets ?? 0} activities
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 truncate">
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
            <div className="space-y-3">
              {processingActivities.map((activity) => (
                <Card key={activity.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    {/* Mobile Layout */}
                    <div className="flex flex-col gap-3 sm:hidden">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base line-clamp-1">{activity.name}</CardTitle>
                        <Badge className="shrink-0 text-xs">{activity.legalBasis?.replace("_", " ") || "No basis"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{activity.purpose}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{activity.assets?.length ?? 0} assets</span>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          Details <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                      <CardHeader className="p-0 pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{activity.name}</CardTitle>
                            <CardDescription className="line-clamp-1">{activity.purpose}</CardDescription>
                          </div>
                          <Badge>{activity.legalBasis?.replace("_", " ") || "No basis"}</Badge>
                        </div>
                      </CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{activity.assets?.length ?? 0} assets</span>
                          <span>{(activity.dataSubjects as string[])?.join(", ") || "No subjects"}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Details <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
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

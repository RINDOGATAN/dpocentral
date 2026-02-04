"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  Store,
  ExternalLink,
  CheckCircle2,
  Globe,
  Shield,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function VendorCatalogPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("");

  const { data: stats } = trpc.vendorCatalog.getStats.useQuery();

  const { data: categories } = trpc.vendorCatalog.listCategories.useQuery();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.vendorCatalog.list.useInfiniteQuery(
      {
        search: search || undefined,
        category: category || undefined,
        isVerified:
          verifiedFilter === "verified"
            ? true
            : verifiedFilter === "unverified"
            ? false
            : undefined,
        limit: 50,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const vendors = data?.pages.flatMap((page) => page.vendors) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Vendor Catalog</h1>
        <p className="text-muted-foreground">
          Shared vendor reference database for all DPO Central customers
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Store className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalVendors}</p>
                  <p className="text-sm text-muted-foreground">Total Vendors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.verifiedVendors}</p>
                  <p className="text-sm text-muted-foreground">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.unverifiedVendors}</p>
                  <p className="text-sm text-muted-foreground">Unverified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Globe className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {stats.topCategories?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Categories</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {categories?.map((cat: string) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vendor List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : vendors.length > 0 ? (
        <>
          <div className="grid gap-3">
            {vendors.map((vendor) => (
              <Card key={vendor.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{vendor.name}</h3>
                        {vendor.isVerified && (
                          <Badge
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                        <Badge variant="outline">{vendor.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {vendor.slug}
                      </p>
                      {vendor.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {vendor.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {vendor.website && (
                          <a
                            href={vendor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Globe className="w-3 h-3" />
                            Website
                          </a>
                        )}
                        {vendor.privacyPolicyUrl && (
                          <a
                            href={vendor.privacyPolicyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Shield className="w-3 h-3" />
                            Privacy Policy
                          </a>
                        )}
                        {vendor.certifications.length > 0 && (
                          <div className="flex gap-1">
                            {vendor.certifications.slice(0, 3).map((cert: string) => (
                              <Badge
                                key={cert}
                                variant="secondary"
                                className="text-xs"
                              >
                                {cert}
                              </Badge>
                            ))}
                            {vendor.certifications.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{vendor.certifications.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Link href={`/admin/vendor-catalog/${vendor.slug}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium">No vendors found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search || category || verifiedFilter
                ? "Try adjusting your filters"
                : "Run the seed script to populate the vendor catalog"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top Categories */}
      {stats && stats.topCategories && stats.topCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Categories</CardTitle>
            <CardDescription>
              Most common vendor categories in the catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topCategories.map((cat: { category: string; count: number }) => (
                <Button
                  key={cat.category}
                  variant="outline"
                  size="sm"
                  onClick={() => setCategory(cat.category)}
                  className={category === cat.category ? "border-primary" : ""}
                >
                  {cat.category}
                  <Badge variant="secondary" className="ml-2">
                    {cat.count}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

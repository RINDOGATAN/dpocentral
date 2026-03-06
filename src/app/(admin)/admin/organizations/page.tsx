"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Building2,
  Users,
  ExternalLink,
  Box,
  Store,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.platformAdmin.listOrganizations.useQuery({
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-muted-foreground">
          Browse and manage all organizations on the platform
        </p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data?.organizations && data.organizations.length > 0 ? (
        <div className="grid gap-4">
          {data.organizations.map((org) => (
            <Card key={org.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{org.name}</h3>
                      <Badge variant="outline">{org.slug}</Badge>
                      {org.domain && (
                        <Badge variant="secondary">{org.domain}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {org._count.members} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Box className="w-4 h-4" />
                        {org._count.dataAssets} assets
                      </span>
                      <span className="flex items-center gap-1">
                        <Store className="w-4 h-4" />
                        {org._count.vendors} vendors
                      </span>
                    </div>
                    {org.customerLinks.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Customer:</span>
                        {org.customerLinks.map((link) => (
                          <Link
                            key={link.customer.id}
                            href={`/admin/customers/${link.customer.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {link.customer.name}
                          </Link>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(org.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link href={`/admin/organizations/${org.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium">No organizations found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try adjusting your search" : "No organizations exist yet"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

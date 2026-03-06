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
  UserCircle,
  Building2,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function UsersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.platformAdmin.listUsers.useQuery({
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-muted-foreground">
          Browse and manage all users on the platform
        </p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
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
      ) : data?.users && data.users.length > 0 ? (
        <div className="grid gap-4">
          {data.users.map((user) => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {user.name || "Unnamed User"}
                      </h3>
                      {user.userType && (
                        <Badge variant="secondary">{user.userType}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {user._count.organizationMemberships} organizations
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link href={`/admin/users/${user.id}`}>
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
            <UserCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium">No users found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try adjusting your search" : "No users exist yet"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

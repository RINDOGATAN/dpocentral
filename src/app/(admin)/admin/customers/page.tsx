"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus,
  Search,
  Building2,
  Key,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CustomerType } from "@prisma/client";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    type: "SAAS" as CustomerType,
  });

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.platformAdmin.listCustomers.useQuery({
    search: search || undefined,
  });

  const createCustomer = trpc.platformAdmin.createCustomer.useMutation({
    onSuccess: () => {
      utils.platformAdmin.listCustomers.invalidate();
      utils.platformAdmin.getDashboardStats.invalidate();
      setShowCreateForm(false);
      setNewCustomer({ name: "", email: "", type: "SAAS" });
    },
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomer.mutate(newCustomer);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-muted-foreground">
            Manage customer accounts and their entitlements
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Customer
        </Button>
      </div>

      {/* Create Customer Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Customer</CardTitle>
            <CardDescription>
              Add a new customer to the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="Company name"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="billing@company.com"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={newCustomer.type}
                    onValueChange={(value) =>
                      setNewCustomer({
                        ...newCustomer,
                        type: value as CustomerType,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAAS">SaaS</SelectItem>
                      <SelectItem value="SELF_HOSTED">Self-Hosted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {createCustomer.error && (
                <p className="text-sm text-destructive">
                  {createCustomer.error.message}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createCustomer.isPending}
                >
                  {createCustomer.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Customer"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data?.customers && data.customers.length > 0 ? (
        <div className="grid gap-4">
          {data.customers.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{customer.name}</h3>
                      <Badge variant="outline">{customer.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {customer.email}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {customer._count.organizations} organizations
                      </span>
                      <span className="flex items-center gap-1">
                        <Key className="w-4 h-4" />
                        {customer._count.entitlements} entitlements
                      </span>
                    </div>
                  </div>
                  <Link href={`/admin/customers/${customer.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  </Link>
                </div>

                {/* Show entitlements summary */}
                {customer.entitlements.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      Active Skills:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {customer.entitlements
                        .filter((e) => e.status === "ACTIVE")
                        .map((entitlement) => (
                          <Badge key={entitlement.id} variant="secondary">
                            {entitlement.skillPackage.displayName}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium">No customers found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? "Try adjusting your search"
                : "Create your first customer to get started"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

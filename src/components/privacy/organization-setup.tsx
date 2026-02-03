"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

export function OrganizationSetup() {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setOrganization, refetchOrganizations } = useOrganization();

  const createOrg = trpc.organization.create.useMutation({
    onSuccess: (org) => {
      setOrganization(org);
      refetchOrganizations();
    },
  });

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const slug = generateSlug(name);
      await createOrg.mutateAsync({ name: name.trim(), slug });
    } catch (error) {
      console.error("Failed to create organization:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Image src="/logo.png" alt="DPO Central" width={48} height={48} className="w-12 h-12" />
          </div>
          <CardTitle>Welcome to DPO Central</CardTitle>
          <CardDescription>
            Create your organization to get started with privacy management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="e.g., Acme Corporation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Organization"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

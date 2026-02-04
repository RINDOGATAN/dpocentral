"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function SkillPackagesPage() {
  const { data: skillPackages, isLoading } = trpc.platformAdmin.listSkillPackages.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Skill Packages</h1>
        <p className="text-muted-foreground">
          Available premium features and assessment types
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {skillPackages?.map((skillPackage) => (
          <Card key={skillPackage.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{skillPackage.displayName}</CardTitle>
                    <CardDescription className="text-xs">
                      {skillPackage.skillId}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">{skillPackage.assessmentType}</Badge>
                {skillPackage.isPremium ? (
                  <Badge>Premium</Badge>
                ) : (
                  <Badge variant="secondary">Free</Badge>
                )}
                {!skillPackage.isActive && (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>
              {skillPackage.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {skillPackage.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                {skillPackage._count.entitlements} active entitlements
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!skillPackages || skillPackages.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium">No skill packages found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Run the seed script to create default skill packages
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

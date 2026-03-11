"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Briefcase } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUserType } from "@/lib/use-user-type";
import { DeploymentExpertCta } from "@/components/privacy/deployment-expert-cta";

const personaLabels = {
  BUSINESS_OWNER: { icon: Building2, title: "Business Owner", description: "Privacy compliance for your organization" },
  PRIVACY_PROFESSIONAL: { icon: Briefcase, title: "Privacy Professional", description: "Advising multiple organizations on privacy" },
} as const;

export default function SettingsPage() {
  const { userType } = useUserType();
  const { data: profile } = trpc.user.getProfile.useQuery();

  const persona = userType ? personaLabels[userType as keyof typeof personaLabels] : null;
  const Icon = persona?.icon;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{profile?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{profile?.email ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Account Type (read-only) */}
      {persona && Icon && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Type</CardTitle>
            <CardDescription>
              Set during registration. Contact support if you need to change this.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-3 rounded-lg border border-primary bg-primary/5">
              <div className="p-2 rounded-lg shrink-0 bg-primary/10 text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{persona.title}</p>
                <p className="text-xs text-muted-foreground">{persona.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <DeploymentExpertCta />
    </div>
  );
}

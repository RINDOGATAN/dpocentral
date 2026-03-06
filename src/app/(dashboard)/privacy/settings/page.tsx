"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Briefcase, Loader2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUserType } from "@/lib/use-user-type";
import { toast } from "sonner";
import type { UserType } from "@prisma/client";

const personas = [
  {
    type: "BUSINESS_OWNER" as UserType,
    icon: Building2,
    title: "Business Owner",
    description: "I need privacy compliance for my organization",
  },
  {
    type: "PRIVACY_PROFESSIONAL" as UserType,
    icon: Briefcase,
    title: "Privacy Professional",
    description: "I advise multiple organizations on privacy",
  },
] as const;

export default function SettingsPage() {
  const { userType, refreshSession } = useUserType();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: profile } = trpc.user.getProfile.useQuery();

  const setUserType = trpc.user.setUserType.useMutation({
    onSuccess: async () => {
      await refreshSession();
    },
  });

  const handleChange = async (type: UserType) => {
    if (type === userType) return;
    setIsSubmitting(true);
    try {
      await setUserType.mutateAsync({ userType: type });
    } catch (error) {
      console.error("Failed to update user type:", error);
      toast.error("Failed to update account type. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

      {/* Account Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Type</CardTitle>
          <CardDescription>
            Choose how you use the platform. This affects your navigation and available features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {personas.map((persona) => {
            const Icon = persona.icon;
            const isSelected = userType === persona.type;
            return (
              <div
                key={persona.type}
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                }`}
                onClick={() => handleChange(persona.type)}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{persona.title}</p>
                  <p className="text-xs text-muted-foreground">{persona.description}</p>
                </div>
                {isSelected && !isSubmitting && (
                  <Check className="w-5 h-5 text-primary shrink-0" />
                )}
                {isSubmitting && !isSelected && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

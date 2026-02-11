"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, Shield } from "lucide-react";

interface Entitlement {
  id: string;
  skillId: string;
  skillName: string;
  licenseType: string;
  expiresAt: Date | null;
  stripeSubscriptionId: string | null;
}

interface SubscriptionStatusCardProps {
  plan: "free" | "premium" | "complete";
  entitlements: Entitlement[];
}

const planLabels: Record<string, string> = {
  free: "Core (Free)",
  premium: "Premium",
  complete: "Complete",
};

export function SubscriptionStatusCard({
  plan,
  entitlements,
}: SubscriptionStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Current Plan
        </CardTitle>
        <CardDescription>
          Your organization&apos;s subscription status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{planLabels[plan] ?? plan}</span>
          {plan !== "free" && (
            <Badge variant="default" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Active
            </Badge>
          )}
        </div>

        {entitlements.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              Active Entitlements
            </p>
            <div className="flex flex-wrap gap-2">
              {entitlements.map((e) => (
                <Badge key={e.id} variant="outline" className="text-sm">
                  {e.skillName}
                  {e.expiresAt && (
                    <span className="ml-1 text-muted-foreground">
                      &middot; expires{" "}
                      {new Date(e.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {plan === "free" && (
          <p className="text-sm text-muted-foreground">
            Upgrade to access premium assessment types, vendor catalog, and
            advanced features.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

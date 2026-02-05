"use client";

/**
 * Upgrade Modal Component
 *
 * Allows users to upgrade to premium features via Stripe Checkout.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { useState } from "react";
import { Loader2, Sparkles, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { brand } from "@/config/brand";
import { features } from "@/config/features";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  skillPackageId: string;
  skillName: string;
  skillDescription?: string;
}

export function UpgradeModal({
  open,
  onClose,
  organizationId,
  skillPackageId,
  skillName,
  skillDescription,
}: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  // If self-service upgrade is not enabled, show contact form
  if (!features.selfServiceUpgrade) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
        <Card className="relative z-50 w-full max-w-md mx-4 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Upgrade to {skillName}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              {skillDescription ||
                `Get access to ${skillName} and advanced privacy assessment tools.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact our sales team to enable this premium feature for your
              organization.
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button asChild>
              <a
                href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(
                  `${brand.name} - ${skillName} Upgrade Request`
                )}&body=${encodeURIComponent(
                  `Hi,\n\nI would like to upgrade to ${skillName} for my organization.\n\nOrganization ID: ${organizationId}\n\nPlease contact me with pricing and next steps.\n\nThank you.`
                )}`}
              >
                Contact Sales
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillPackageId,
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <Card className="relative z-50 w-full max-w-md mx-4 shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Upgrade to {skillName}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {skillDescription ||
              `Get access to ${skillName} and advanced privacy assessment tools.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h4 className="font-medium mb-2">What you'll get:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Full access to {skillName}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Professional assessment templates
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Export reports in multiple formats
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Priority support
              </li>
            </ul>
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              "Upgrade Now"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

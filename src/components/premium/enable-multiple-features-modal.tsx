"use client";

/**
 * Enable Multiple Features Modal Component
 *
 * Allows users to enable multiple add-on features in a single Stripe Checkout session.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { useState } from "react";
import { Loader2, Sparkles, X, Mail } from "lucide-react";
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

interface EnableMultipleFeaturesModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  skills: { id: string; name: string }[];
}

export function EnableMultipleFeaturesModal({
  open,
  onClose,
  organizationId,
  skills,
}: EnableMultipleFeaturesModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !skills.length) return null;

  const total = skills.length * 9;

  // If self-service upgrade is not enabled, show contact form
  if (!features.selfServiceUpgrade) {
    const skillNames = skills.map((s) => s.name).join(", ");
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
                Enable {skills.length} Features
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
              Contact us to enable these features for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {skills.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button asChild>
              <a
                href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(
                  `${brand.name} - Enable ${skills.length} Features`
                )}&body=${encodeURIComponent(
                  `Hi,\n\nI would like to enable the following features for my organization:\n\n${skillNames}\n\nOrganization ID: ${organizationId}\n\nPlease contact me with next steps.\n\nThank you.`
                )}`}
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Us
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillPackageIds: skills.map((s) => s.id),
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

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
              Enable {skills.length} Features
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
            Add these features to your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc list-inside space-y-1 text-sm">
            {skills.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">
              &euro;{total}/month &mdash; cancel anytime
            </p>
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
          <Button onClick={handleEnable} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to payment...
              </>
            ) : (
              `Enable ${skills.length} Features`
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Enable Feature Modal Component
 *
 * Allows users to enable add-on features via Stripe Checkout.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, X, Package, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_URL } from "@/lib/marketplace";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { features } from "@/config/features";
import { formatPrice } from "@/lib/currency";

interface EnableFeatureModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  skillPackageId: string;
  skillName: string;
  skillDescription?: string;
}

export function EnableFeatureModal({
  open,
  onClose,
  organizationId,
  skillPackageId,
  skillName,
  skillDescription,
}: EnableFeatureModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Declared before the early returns below — hooks must not be conditional.
  const t = useTranslations("enableFeature");

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
                {t("title", { skill: skillName })}
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
                t("fallbackDescription", { skill: skillName })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("marketplaceBody", { skill: skillName })}
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button variant="outline" asChild>
              <a href="/privacy/skills">
                <Package className="mr-2 h-4 w-4" />
                {t("installOnSkills")}
              </a>
            </Button>
            <Button asChild>
              <a href={MARKETPLACE_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("getOnMarketplace")}
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
          skillPackageId,
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // data.error is a server string and is not localised; fall back to a
        // translated message when the API doesn't supply one.
        throw new Error(data.error || t("errorCheckout"));
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
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
              {t("title", { skill: skillName })}
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
              t("fallbackDescription", { skill: skillName })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">
              {t("price", { price: formatPrice(9) })}
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
            {t("cancel")}
          </Button>
          <Button onClick={handleEnable} disabled={isLoading} className="whitespace-nowrap">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                {t("redirecting")}
              </>
            ) : (
              t("confirm")
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

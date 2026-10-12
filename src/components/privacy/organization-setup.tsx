"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { brand } from "@/config/brand";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { PILOT_DPA, pilotDpaHref } from "@/config/pilot-dpa";
import { organizationSlug } from "@/lib/organization-slug";


export function OrganizationSetup() {
  const t = useTranslations("organization");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Hosted pilot: the data processing agreement is accepted when the
  // organisation is opened (src/config/pilot-dpa.ts). Never asked on the kit.
  const hosted = useHostedPilot();
  const locale = useLocale();
  const [acceptDpa, setAcceptDpa] = useState(false);
  const { setOrganization, refetchOrganizations } = useOrganization();

  const createOrg = trpc.organization.create.useMutation({
    onSuccess: (org) => {
      setOrganization(org);
      refetchOrganizations();
    },
  });

  const generateSlug = organizationSlug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (hosted && !acceptDpa) return;

    setIsSubmitting(true);
    try {
      const slug = generateSlug(name);
      await createOrg.mutateAsync({ name: name.trim(), slug, acceptDpa: hosted ? acceptDpa : undefined });
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
          <div className="mx-auto mb-4 flex items-center justify-center gap-2">
            <img src="/logo-negative.svg" alt="TODO.LAW" style={{ height: "28px", width: "auto" }} />
            <span className="text-muted-foreground" style={{ fontFamily: "var(--font-jost), 'Jost', sans-serif", fontWeight: 600 }}>{brand.nameUppercase}</span>
          </div>
          <CardTitle>{t("welcome", { brandName: brand.nameUppercase })}</CardTitle>
          <CardDescription>
            {t("createOrg")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">{t("orgName")}</Label>
              <Input
                id="org-name"
                placeholder={t("orgNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {hosted && (
              <div className="flex items-start gap-2" data-testid="pilot-dpa-accept">
                <Checkbox
                  id="accept-dpa"
                  checked={acceptDpa}
                  onCheckedChange={(v) => setAcceptDpa(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="accept-dpa" className="text-sm font-normal leading-snug">
                  {t.rich("dpaAccept", {
                    version: PILOT_DPA.version,
                    link: (chunks) => (
                      <a
                        href={pilotDpaHref(locale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </Label>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !name.trim() || (hosted && !acceptDpa)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                t("createOrganization")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

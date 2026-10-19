"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Briefcase, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUserType } from "@/lib/use-user-type";
import { useOrganization } from "@/lib/organization-context";
import { brand } from "@/config/brand";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { UserType } from "@prisma/client";
import { organizationSlug } from "@/lib/organization-slug";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { DpaAcceptCheckbox } from "@/components/pilot/dpa-accept";
import { cardButton, CARD_BUTTON_FOCUS } from "@/lib/card-button";
import { useRouter } from "next/navigation";
import { AccountLanguageSwitcher } from "@/components/account-locale";

const personas = [
  {
    type: "BUSINESS_OWNER" as UserType,
    icon: Building2,
    titleKey: "businessOwner" as const,
    descKey: "businessOwnerDesc" as const,
  },
  {
    type: "PRIVACY_PROFESSIONAL" as UserType,
    icon: Briefcase,
    titleKey: "privacyProfessional" as const,
    descKey: "privacyProfessionalDesc" as const,
  },
] as const;

export function OnboardingWelcome() {
  const t = useTranslations("onboarding");
  const tToasts = useTranslations("toasts");
  // Preselected: most people set up their own organisation. A privacy
  // professional changes it with one click.
  const [selectedType, setSelectedType] = useState<UserType | null>("BUSINESS_OWNER");
  const router = useRouter();
  const professional = selectedType === "PRIVACY_PROFESSIONAL";
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Hosted pilot: the data processing agreement is accepted when the
  // organisation is opened (src/config/pilot-dpa.ts). Never asked on the kit.
  const hosted = useHostedPilot();
  const [acceptDpa, setAcceptDpa] = useState(false);
  const { refreshSession } = useUserType();
  const { setOrganization, refetchOrganizations } = useOrganization();

  const setUserType = trpc.user.setUserType.useMutation();
  const createOrg = trpc.organization.create.useMutation();

  const generateSlug = organizationSlug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !orgName.trim()) return;
    if (hosted && !acceptDpa) return;

    setIsSubmitting(true);
    try {
      await setUserType.mutateAsync({ userType: selectedType });
      const slug = generateSlug(orgName);
      const org = await createOrg.mutateAsync({ name: orgName.trim(), slug, creatorType: selectedType, acceptDpa: hosted ? acceptDpa : undefined });
      setOrganization(org);
      refetchOrganizations();
      await refreshSession();
      // A privacy professional works across clients: the organisation just
      // created is the first client, and the firm view is where they work.
      if (selectedType === "PRIVACY_PROFESSIONAL") router.push("/privacy/clients");
    } catch (error) {
      console.error("Onboarding failed:", error);
      // The server's message is written for the person (a limit, the
      // agreement); fall back to the generic one only when there is none.
      const message = error instanceof Error && error.message ? error.message : null;
      toast.error(message ?? tToasts("generic.somethingWentWrong"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedType && orgName.trim().length > 0 && !isSubmitting && (!hosted || acceptDpa);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* The first screen after sign-in also offers the language; the
            choice is saved on the account as well as in this browser. */}
        <div className="flex justify-end text-sm text-muted-foreground" data-testid="onboarding-language">
          <AccountLanguageSwitcher />
        </div>
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo-negative.svg" alt="TODO.LAW" style={{ height: "28px", width: "auto" }} />
            <span style={{ fontFamily: "var(--font-jost), 'Jost', sans-serif", fontWeight: 600 }}>{brand.nameUppercase}</span>
          </div>
          <h1 className="text-xl font-semibold">
            {t("welcome", { brandName: brand.nameUppercase })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Persona selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("howWillYouUse", { brandName: brand.nameUppercase })}
            </Label>
            <div className="grid gap-3">
              {personas.map((persona) => {
                const Icon = persona.icon;
                const isSelected = selectedType === persona.type;
                return (
                  <Card
                    key={persona.type}
                    className={`cursor-pointer transition-all ${CARD_BUTTON_FOCUS} ${
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-muted-foreground/50"
                    }`}
                    {...cardButton(() => setSelectedType(persona.type), {
                      label: t(persona.titleKey),
                      pressed: isSelected,
                    })}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div
                        className={`p-3 rounded-lg shrink-0 ${
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-medium">{t(persona.titleKey)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(persona.descKey)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Organization name */}
          <div className="space-y-2">
            <Label htmlFor="onboarding-org-name">{professional ? t("clientName") : t("orgName")}</Label>
            <Input
              id="onboarding-org-name"
              placeholder={professional ? t("clientNamePlaceholder") : t("orgNamePlaceholder")}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              aria-describedby={professional ? "onboarding-client-hint" : undefined}
              required
            />
            {professional && (
              <p id="onboarding-client-hint" className="text-xs text-muted-foreground">
                {t("clientNameHint")}
              </p>
            )}
          </div>

          {hosted && (
            <DpaAcceptCheckbox id="onboarding-accept-dpa" checked={acceptDpa} onCheckedChange={setAcceptDpa} />
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("settingUp")}
              </>
            ) : (
              t("getStarted")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, CreditCard, Scale, Shield, Lock } from "lucide-react";
import { useOrganization } from "@/lib/organization-context";
import { useUserType } from "@/lib/use-user-type";
import { OrganizationSetup } from "@/components/privacy/organization-setup";
import { OnboardingWelcome } from "@/components/privacy/onboarding-welcome";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { features } from "@/config/features";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { sellingEnabled } from "@/lib/premium-gate";
import { brand } from "@/config/brand";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { GuidedLayout } from "@/components/guided/guided-layout";

export function DashboardShell({
  children,
  menuCollapsed = false,
}: {
  children: React.ReactNode;
  /** The left menu shows icons only (`dpc_menu` cookie, src/lib/menu-cookie.ts). */
  menuCollapsed?: boolean;
}) {
  const { organization, organizations, isLoading: orgLoading } = useOrganization();
  const { needsOnboarding, isLoading: userTypeLoading } = useUserType();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const tCommon = useTranslations("common");

  if (orgLoading || userTypeLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  // Step 1: Combined onboarding — persona + org in one screen. Only for a
  // person who belongs to no organisation yet: a colleague who was added as a
  // member (or joined by email domain) has no persona of their own and must
  // land in that organisation, never on a screen that creates a second one.
  if (needsOnboarding && organizations.length === 0) {
    return <OnboardingWelcome />;
  }

  // Step 2: Fallback — user has persona but no org (edge case)
  if (!organization && organizations.length === 0) {
    return <OrganizationSetup />;
  }

  // The one layout (Guided; Classic was retired on 9 October 2026): the
  // privacy program path as a left menu, with the footer and the feedback
  // dialog below.
  return (
    <>
      <GuidedLayout
        footer={<DashboardFooter />}
        initialCollapsed={menuCollapsed}
        onFeedback={() => setFeedbackOpen(true)}
      >
        {children}
      </GuidedLayout>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}

/** The dashboard footer: service line, legal links, source offer. */
function DashboardFooter() {
  const tFooter = useTranslations("footer");
  const hosted = useHostedPilot();
  return (
      <footer className="border-t border-border mt-auto py-4">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 text-center text-xs text-muted-foreground space-y-1">
          <p>{tFooter("serviceBy", { brandName: brand.nameUppercase, companyName: brand.companyName })}</p>
          <p>{tFooter("disclaimer")}</p>
          <p>
            DPO Central &middot; AGPL-3.0 &middot; &copy; Rindogatan LLC &middot;{" "}
            <Link href="/licenses" className="underline hover:text-foreground transition-colors">
              {tFooter("sourceAndLicence")}
            </Link>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <Link href="/privacy/docs" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <BookOpen className="w-3.5 h-3.5" />
              {tFooter("userGuide")}
            </Link>
            {sellingEnabled(features.stripeEnabled, hosted) && features.selfServiceUpgrade && (
              <>
                <span aria-hidden className="text-muted-foreground">&middot;</span>
                <Link href="/privacy/billing" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <CreditCard className="w-3.5 h-3.5" />
                  {tFooter("billing")}
                </Link>
              </>
            )}
            <span aria-hidden className="text-muted-foreground">&middot;</span>
            <a href={brand.termsOfUseUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Scale className="w-3.5 h-3.5" />
              {tFooter("termsOfService")}
            </a>
            <span aria-hidden className="text-muted-foreground">&middot;</span>
            <a href={brand.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Shield className="w-3.5 h-3.5" />
              {tFooter("privacyPolicy")}
            </a>
            <span aria-hidden className="text-muted-foreground">&middot;</span>
            <Link href="/security" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Lock className="w-3.5 h-3.5" />
              {tFooter("dataSecurity")}
            </Link>
            <span aria-hidden className="text-muted-foreground">&middot;</span>
            <LanguageSwitcher />
          </div>
        </div>
      </footer>
  );
}

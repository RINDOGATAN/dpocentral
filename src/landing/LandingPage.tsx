"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LazyMotion, domAnimation } from "framer-motion";
import { Database, UserCheck, AlertTriangle, Package } from "lucide-react";
import StartupProductPage from "./components/StartupProductPage";
import StartupsHeader from "./components/StartupsHeader";
import StartupsFooter from "./components/StartupsFooter";
import LandingSections from "./components/LandingSections";
import en from "./i18n/en/dpo-startups.json";
import es from "./i18n/es/dpo-startups.json";
import authEn from "./i18n/en/startups-auth.json";
import authEs from "./i18n/es/startups-auth.json";
import { cleanUpLocaleCookies, writeLocaleCookie } from "@/i18n/locale-cookie";
import { LANDING_SEO } from "@/config/seo";

/**
 * The landing, in the language the server chose (`?lang=`, the cookie, then
 * Accept-Language: src/config/seo.ts). Nothing switches after load, so the first
 * paint is the final text (owner, 10 Oct 2026); only the toggle changes it.
 */
export default function LandingPage({ initialLocale = "en" }: { initialLocale?: "en" | "es" }) {
  const [locale, setLocale] = useState<"en" | "es">(initialLocale);
  // The server's title stands until the visitor toggles.
  const [toggled, setToggled] = useState(false);

  const router = useRouter();

  useEffect(() => {
    cleanUpLocaleCookies();
    // The root layout's <html lang> follows the cookie and Accept-Language, not `?lang=`.
    document.documentElement.lang = initialLocale;
  }, [initialLocale]);

  // The tab title follows the text shown after a toggle.
  useEffect(() => {
    if (toggled) document.title = LANDING_SEO[locale].title;
  }, [locale, toggled]);

  const toggleLocale = useCallback(() => {
    const next = locale === "en" ? "es" : "en";
    writeLocaleCookie(next);
    setLocale(next);
    setToggled(true);
    // The page text and the tab title switch at once; <html lang> now, and
    // the rest of the server metadata with a refresh of the route.
    document.documentElement.lang = next;
    // The choice is now the cookie's; a `?lang=` left in the address would
    // otherwise win again on the refresh (src/app/page.tsx reads it first).
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.delete("lang");
      window.history.replaceState(window.history.state, "", url.toString());
    }
    router.refresh();
  }, [locale, router]);

  const dict = locale === "es" ? es : en;
  const authDict = locale === "es" ? authEs : authEn;
  const t = (key: string) => (dict as Record<string, string>)[key] ?? key;
  const tAuth = (key: string) => (authDict as Record<string, string>)[key] ?? key;

  const features = [
    {
      id: "inv",
      icon: Database,
      title: t("feat.inv.title"),
      headline: t("feat.inv.headline"),
      description: t("feat.inv.desc"),
      highlights: [t("feat.inv.h1"), t("feat.inv.h2"), t("feat.inv.h3"), t("feat.inv.h4")],
    },
    {
      id: "dsar",
      icon: UserCheck,
      title: t("feat.dsar.title"),
      headline: t("feat.dsar.headline"),
      description: t("feat.dsar.desc"),
      highlights: [t("feat.dsar.h1"), t("feat.dsar.h2"), t("feat.dsar.h3"), t("feat.dsar.h4")],
    },
    {
      id: "inc",
      icon: AlertTriangle,
      title: t("feat.inc.title"),
      headline: t("feat.inc.headline"),
      description: t("feat.inc.desc"),
      highlights: [t("feat.inc.h1"), t("feat.inc.h2"), t("feat.inc.h3"), t("feat.inc.h4")],
    },
    {
      id: "vendor",
      icon: Package,
      title: t("feat.vendor.title"),
      headline: t("feat.vendor.headline"),
      description: t("feat.vendor.desc"),
      highlights: [t("feat.vendor.h1"), t("feat.vendor.h2"), t("feat.vendor.h3"), t("feat.vendor.h4")],
    },
  ];

  const workflowSteps = [1, 2, 3, 4].map((n) => ({
    title: t(`workflow.s${n}.title`),
    desc: t(`workflow.s${n}.desc`),
  }));

  const valueProps = [1, 2, 3, 4].map((n) => ({
    title: t(`value.v${n}.title`),
    desc: t(`value.v${n}.desc`),
  }));

  const socialProofs = [t("social.s1"), t("social.s2"), t("social.s3")];

  // The lighter framer-motion build (owner's performance review, 10 Oct 2026): `m`
  // components with the DOM animation features only; `strict` fails on a full `motion`.
  return (
    <LazyMotion features={domAnimation} strict>
      <StartupsHeader
        t={t}
        locale={locale}
        onLocaleToggle={toggleLocale}
        onSignup={() => window.location.href = "/sign-in"}
      />
      <StartupProductPage
        t={t}
        tAuth={tAuth}
        features={features}
        workflowSteps={workflowSteps}
        valueProps={valueProps}
        socialProofs={socialProofs}
        heroVideo="/hero-dpo-bg.mp4"
        heroPoster="/hero-dpo-poster.jpg"
        callbackUrl="/privacy"
        middle={<LandingSections t={t} locale={locale} />}
      />
      <StartupsFooter t={t} locale={locale} />
    </LazyMotion>
  );
}

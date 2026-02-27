"use client";

import { Database, UserCheck, AlertTriangle, Package } from "lucide-react";
import { signIn } from "next-auth/react";
import { AuthProvider } from "./auth/AuthContext";
import StartupProductPage from "./components/StartupProductPage";
import StartupsHeader from "./components/StartupsHeader";
import StartupsFooter from "./components/StartupsFooter";
import en from "./i18n/en/dpo-startups.json";
import es from "./i18n/es/dpo-startups.json";
import authEn from "./i18n/en/startups-auth.json";
import authEs from "./i18n/es/startups-auth.json";

const locale: string = "en";
const dict = locale === "es" ? es : en;
const authDict = locale === "es" ? authEs : authEn;
const t = (key: string) => (dict as Record<string, string>)[key] ?? key;
const tAuth = (key: string) => (authDict as Record<string, string>)[key] ?? key;

export default function LandingPage() {
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

  return (
    <AuthProvider>
      <StartupsHeader
        t={t}
        locale="en"
        onLocaleToggle={() => {}}
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
        onAuthenticated={() => signIn("google", { callbackUrl: "/privacy" })}
      />
      <StartupsFooter t={t} />
    </AuthProvider>
  );
}

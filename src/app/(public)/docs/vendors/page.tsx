import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.publicVendors");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/docs/vendors" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/docs/vendors",
    },
  };
}

const vendorStatuses = [
  { key: "ACTIVE", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { key: "UNDER_REVIEW", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { key: "SUSPENDED", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { key: "OFFBOARDED", color: "bg-muted text-muted-foreground border-border" },
] as const;

const riskTiers = [
  { tier: "LOW", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { tier: "MEDIUM", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { tier: "HIGH", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { tier: "CRITICAL", color: "bg-red-500/10 text-red-400 border-red-500/20" },
];

const dashboardStats: { key: string; value: string; color: string }[] = [
  { key: "total", value: "24", color: "text-foreground" },
  { key: "active", value: "18", color: "text-green-400" },
  { key: "highRisk", value: "3", color: "text-orange-400" },
  { key: "pendingReview", value: "5", color: "text-amber-400" },
];

export default async function VendorsPage() {
  const t = await getTranslations("docs.publicVendors");

  const contractKeys = ["dpa", "sccs", "sub", "security"] as const;
  const topicKeys = ["scope", "security", "incident", "sub", "retention", "transfers", "training", "certs"] as const;
  const reviewSteps = ["onboarding", "questionnaire", "contract", "approved", "periodic"] as const;
  const howToSteps = [
    { key: "add", actor: "dpo" },
    { key: "send", actor: "dpo" },
    { key: "review", actor: "officer", hasDetails: true },
    { key: "execute", actor: "legal" },
    { key: "approve", actor: "dpo" },
  ] as const;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>

      {/* Vendor Register */}
      <section id="adding" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("register.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("register.intro")}</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {vendorStatuses.map((s) => (
            <div key={s.key} className={`p-4 rounded-lg border ${s.color}`}>
              <p className="text-sm font-semibold">{t(`register.statuses.${s.key}.label`)}</p>
              <p className="text-xs mt-1 opacity-80">{t(`register.statuses.${s.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Risk Tiers */}
      <section id="risk-tiers" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("riskTiers.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("riskTiers.intro")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {riskTiers.map((t2) => (
            <div key={t2.tier} className={`p-3 rounded-lg border text-center ${t2.color}`}>
              <p className="text-sm font-semibold">{t2.tier}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{t("riskTiers.outro")}</p>
      </section>

      {/* Vendor Dashboard */}
      <section id="dashboard" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("dashboard.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("dashboard.intro")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dashboardStats.map((stat) => (
            <div key={stat.key} className="p-4 rounded-lg border border-border bg-card text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{t(`dashboard.stats.${stat.key}`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contracts */}
      <section id="contracts" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("contracts.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("contracts.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("contracts.label")}</p>
          <div className="space-y-2">
            {contractKeys.map((key) => (
              <div key={key} className="flex items-start justify-between p-2 rounded-lg bg-background/50 border border-border/50 gap-3">
                <span className="text-sm font-medium text-foreground">{t(`contracts.items.${key}.doc`)}</span>
                <span className="text-xs text-muted-foreground shrink-0 text-right">{t(`contracts.items.${key}.purpose`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Questionnaires */}
      <section id="questionnaires" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("questionnaires.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("questionnaires.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("questionnaires.label")}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {topicKeys.map((topic) => (
              <div key={topic} className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-primary text-xs">&#9679;</span>
                {t(`questionnaires.topics.${topic}`)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor Review Workflow */}
      <section id="risk-reviews" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("review.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("review.intro")}</p>

        <div className="card-brutal mb-8">
          <FlowDiagram
            steps={reviewSteps.map((k) => ({
              label: t(`review.steps.${k}.label`),
              description: t(`review.steps.${k}.description`),
            }))}
          />
        </div>
      </section>

      {/* Adding a Vendor */}
      <section id="how-to" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">{t("howTo.title")}</h2>
        {howToSteps.map((step, i) => (
          <WorkflowStep
            key={step.key}
            number={i + 1}
            title={t(`howTo.steps.${step.key}.title`)}
            description={t(`howTo.steps.${step.key}.description`)}
            actor={t(`howTo.actors.${step.actor}`)}
            details={
              step.key === "review"
                ? [
                    t("howTo.steps.review.detail1"),
                    t("howTo.steps.review.detail2"),
                    t("howTo.steps.review.detail3"),
                  ]
                : undefined
            }
          />
        ))}
      </section>

      {/* PDF Exports */}
      <section id="exports" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("exports.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("exports.intro")}</p>

        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-sm font-semibold text-foreground mb-2">{t("exports.registerTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("exports.registerDesc")}</p>
        </div>
      </section>
    </div>
  );
}

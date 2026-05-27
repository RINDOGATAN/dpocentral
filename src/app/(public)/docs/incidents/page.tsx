import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.publicIncidents");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/docs/incidents" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/docs/incidents",
    },
  };
}

const severityLevels = [
  { level: "LOW", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { level: "MEDIUM", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { level: "HIGH", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { level: "CRITICAL", color: "bg-red-500/10 text-red-400 border-red-500/20" },
] as const;

const dashboardStats: { key: string; value: string; color: string }[] = [
  { key: "total", value: "12", color: "text-foreground" },
  { key: "open", value: "3", color: "text-amber-400" },
  { key: "critical", value: "1", color: "text-red-400" },
  { key: "pendingDpa", value: "1", color: "text-orange-400" },
];

const timelineEntries: { key: string; time: string; type: string }[] = [
  { key: "reported", time: "09:15", type: "CREATED" },
  { key: "elevated", time: "09:30", type: "UPDATE" },
  { key: "investigation", time: "10:00", type: "ACTION" },
  { key: "rootCause", time: "11:45", type: "UPDATE" },
  { key: "notification", time: "14:00", type: "NOTIFICATION" },
  { key: "resolved", time: "16:30", type: "RESOLVED" },
];

export default async function IncidentsPage() {
  const t = await getTranslations("docs.publicIncidents");

  const lifecycleSteps = ["reported", "investigating", "containment", "notification", "resolved"] as const;
  const workflowSteps = [
    { key: "report", actor: "reporter" },
    { key: "triage", actor: "officer", hasDetails: true },
    { key: "contain", actor: "it" },
    { key: "notify", actor: "dpo" },
    { key: "resolve", actor: "officer" },
  ] as const;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>

      {/* Incident Lifecycle */}
      <section id="lifecycle" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("lifecycle.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("lifecycle.intro")}</p>

        <div className="card-brutal">
          <FlowDiagram
            steps={lifecycleSteps.map((k) => ({
              label: t(`lifecycle.steps.${k}.label`),
              description: t(`lifecycle.steps.${k}.description`),
            }))}
          />
        </div>
      </section>

      {/* Severity Levels */}
      <section id="severity" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("severity.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("severity.intro")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {severityLevels.map((s) => (
            <div key={s.level} className={`p-3 rounded-lg border ${s.color}`}>
              <p className="text-sm font-semibold">{s.level}</p>
              <p className="text-[10px] mt-1 opacity-80">{t(`severity.items.${s.level}`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DPA Notification */}
      <section id="notifications" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("notifications.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("notifications.intro")}</p>

        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 font-semibold text-sm">{t("notifications.ruleLabel")}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("notifications.ruleBody")}</p>
        </div>
      </section>

      {/* Incident Stats */}
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

      {/* Timeline */}
      <section id="timeline" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("timeline.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("timeline.intro")}</p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{t("timeline.exampleLabel")}</p>
          <div className="space-y-3">
            {timelineEntries.map((entry) => (
              <div key={entry.key} className="flex gap-3">
                <span className="text-xs text-muted-foreground shrink-0 w-12 pt-0.5">{entry.time}</span>
                <div className="flex items-start gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      entry.type === "CREATED"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : entry.type === "NOTIFICATION"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : entry.type === "RESOLVED"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {entry.type}
                  </span>
                  <span className="text-sm text-foreground">{t(`timeline.entries.${entry.key}`)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Response Tasks */}
      <section id="tasks" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("tasks.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("tasks.intro")}</p>
      </section>

      {/* Reporting Workflow */}
      <section id="reporting" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">{t("workflow.title")}</h2>
        {workflowSteps.map((step, i) => (
          <WorkflowStep
            key={step.key}
            number={i + 1}
            title={t(`workflow.steps.${step.key}.title`)}
            description={t(`workflow.steps.${step.key}.description`)}
            actor={t(`workflow.actors.${step.actor}`)}
            details={
              step.key === "triage"
                ? [
                    t("workflow.steps.triage.detail1"),
                    t("workflow.steps.triage.detail2"),
                    t("workflow.steps.triage.detail3"),
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

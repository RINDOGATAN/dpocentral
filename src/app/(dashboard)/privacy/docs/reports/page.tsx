import {
  BarChart3,
  Database,
  Users,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  TrendingUp,
  FileDown,
  Camera,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import { PremiumBadge } from "@/components/docs/premium-badge";

export default function DocsReportsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Reports</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your organization&apos;s privacy compliance posture with a single score, module-level breakdowns,
          and actionable risk indicators. Export board-ready reports to demonstrate accountability.
        </p>
      </div>

      <DocSection
        id="compliance-score"
        title="Compliance Posture Score"
        description="A weighted 0-100 score that reflects the overall health of your privacy program across all modules."
      >
        <FeatureMockup title="Module Weights">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {[
              { label: "ROPA", value: "25%", icon: Database },
              { label: "DSAR SLA", value: "25%", icon: Users },
              { label: "Assessments", value: "20%", icon: ClipboardCheck },
              { label: "Incidents", value: "15%", icon: AlertTriangle },
              { label: "Vendors", value: "15%", icon: Building2 },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{stat.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">weight</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Each module contributes a weighted percentage to the overall compliance posture score.
            The final score is calculated on a 0&ndash;100 scale with the following color coding:
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-transparent">
              80&ndash;100: Strong
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-800 border-transparent">
              60&ndash;79: Needs Attention
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-red-100 text-red-800 border-transparent">
              0&ndash;59: At Risk
            </Badge>
          </div>
        </div>
      </DocSection>

      <DocSection
        id="module-breakdown"
        title="Module Breakdown"
        description="Each module is scored independently based on the completeness and timeliness of your records."
      >
        <FeatureMockup title="Module Scores">
          <div className="space-y-3">
            {[
              {
                module: "Data Inventory",
                icon: Database,
                metric: "Assets with linked processing activities",
                example: "85% of assets have at least one activity",
              },
              {
                module: "DSAR",
                icon: Users,
                metric: "On-time completion rate",
                example: "92% of requests completed within SLA",
              },
              {
                module: "Assessments",
                icon: ClipboardCheck,
                metric: "Approved assessment rate",
                example: "78% of assessments approved",
              },
              {
                module: "Incidents",
                icon: AlertTriangle,
                metric: "Timely DPA notification rate",
                example: "100% notified within 72 hours",
              },
              {
                module: "Vendors",
                icon: Building2,
                metric: "Review coverage",
                example: "70% of vendors reviewed within schedule",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.module} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.module}</p>
                    <p className="text-xs text-muted-foreground">{item.metric}</p>
                    <p className="text-xs text-muted-foreground italic mt-0.5">e.g. {item.example}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection
        id="risk-indicators"
        title="Risk Indicators"
        description="Actionable alerts highlight specific compliance gaps that need immediate attention."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Risk indicators surface specific issues rather than abstract scores. They tell you exactly
            what needs fixing and link directly to the affected records:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Overdue DSARs</strong> &mdash; e.g. &ldquo;3 DSARs past their statutory deadline&rdquo;</li>
            <li><strong>Unassessed high-risk vendors</strong> &mdash; e.g. &ldquo;2 HIGH-risk vendors without a completed assessment&rdquo;</li>
            <li><strong>Expired contracts</strong> &mdash; e.g. &ldquo;1 vendor DPA expired without renewal&rdquo;</li>
            <li><strong>Stale ROPA entries</strong> &mdash; e.g. &ldquo;5 processing activities not updated in 12+ months&rdquo;</li>
            <li><strong>Open critical incidents</strong> &mdash; e.g. &ldquo;1 CRITICAL incident open for more than 48 hours&rdquo;</li>
          </ul>
        </div>
        <InfoCallout type="warning" title="Critical indicators">
          Indicators flagged as critical (overdue DSARs, open critical incidents, expired contracts)
          appear at the top of the compliance dashboard with a red badge. Address these first to
          avoid regulatory exposure.
        </InfoCallout>
      </DocSection>

      <DocSection
        id="snapshots"
        title="Trend Tracking"
        description="Save monthly snapshots of your compliance score to track progress over time."
      >
        <FeatureMockup title="Trend History">
          <div className="space-y-2">
            {[
              { month: "March 2026", score: 82, change: "+4", color: "bg-green-100 text-green-800 border-transparent" },
              { month: "February 2026", score: 78, change: "+2", color: "bg-green-100 text-green-800 border-transparent" },
              { month: "January 2026", score: 76, change: "-3", color: "bg-red-100 text-red-800 border-transparent" },
              { month: "December 2025", score: 79, change: "+5", color: "bg-green-100 text-green-800 border-transparent" },
              { month: "November 2025", score: 74, change: "+1", color: "bg-green-100 text-green-800 border-transparent" },
            ].map((item) => (
              <div key={item.month} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{item.month}</p>
                    <p className="text-xs text-muted-foreground">Score: {item.score}/100</p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${item.color}`}>
                  {item.change}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title="Save snapshots regularly">
          Take a monthly snapshot of your compliance score to build a trend history for board reporting.
          Snapshots capture the score, module breakdown, and active risk indicators at that point in time,
          making it easy to demonstrate progress to management and auditors.
        </InfoCallout>
      </DocSection>

      <DocSection
        id="board-reports"
        title="Board Report Export"
        description="Generate professional PDF reports for management and board presentations."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            <span className="font-medium">PDF Export</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Board report includes:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              <li>Executive summary with overall compliance posture score</li>
              <li>Module-by-module breakdown with individual scores</li>
              <li>Trend chart showing score history over the selected period</li>
              <li>Active risk indicators and recommended actions</li>
              <li>DSAR statistics: total received, completed on time, average resolution time</li>
              <li>Incident summary: count by severity, notification compliance rate</li>
              <li>Vendor overview: risk tier distribution, contract status summary</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">All eight PDF reports:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              <li><strong>Data Inventory</strong> — assets, elements, transfers, and a rendered Data Flow Map</li>
              <li><strong>ROPA</strong> (premium) — GDPR Article 30 record with per-activity flow clusters</li>
              <li><strong>Vendor Register</strong> — vendor list with risk tiers and contract status</li>
              <li><strong>Breach Register</strong> — incident summaries, timelines, and DPA notifications</li>
              <li><strong>DSAR Performance</strong> — request volumes, SLA compliance, monthly trends</li>
              <li><strong>Assessment Portfolio</strong> — DPIA/PIA/TIA/LIA rollups across the program</li>
              <li><strong>Assessment (individual)</strong> — full questionnaire with responses and risk scoring</li>
              <li><strong>Regulatory Landscape</strong> — applied jurisdictions and compliance posture</li>
            </ul>
          </div>
        </div>

        <InfoCallout type="tip" title="Data Flow Map in PDFs">
          The Data Inventory and ROPA PDFs render a beautiful auto-laid-out diagram of how data
          moves between your assets, with nodes colour-coded by asset type and edges labelled with
          the data categories and frequency. The ROPA version groups assets into bordered clusters
          per processing activity. No drawing required — it&apos;s generated from your activity-asset
          links.
        </InfoCallout>

        <InfoCallout type="info" title="Premium feature (ROPA only)">
          The ROPA PDF export is gated on a premium subscription. Every other PDF report is
          available to all users.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Expert Help & Personas", href: "/privacy/docs/experts" }}
        next={{ title: "DPIA Auto-Fill", href: "/privacy/docs/dpia-auto-fill" }}
      />
    </div>
  );
}

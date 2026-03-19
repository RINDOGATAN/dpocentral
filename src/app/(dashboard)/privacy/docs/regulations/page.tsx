import { Scale, Shield, Bot, Globe, Clock, AlertTriangle, Settings, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const jurisdictions = [
  { name: "GDPR", region: "European Union", regionColor: "bg-blue-100 text-blue-800 border-transparent", dsar: "30 days", breach: "72 hours" },
  { name: "CPRA", region: "California", regionColor: "bg-yellow-100 text-yellow-800 border-transparent", dsar: "45 days", breach: "Expedient" },
  { name: "LGPD", region: "Brazil", regionColor: "bg-green-100 text-green-800 border-transparent", dsar: "15 days", breach: "Reasonable time" },
  { name: "PIPL", region: "China", regionColor: "bg-red-100 text-red-800 border-transparent", dsar: "15 days", breach: "Immediately" },
  { name: "POPIA", region: "South Africa", regionColor: "bg-purple-100 text-purple-800 border-transparent", dsar: "30 days", breach: "As soon as possible" },
  { name: "EU AI Act", region: "European Union", regionColor: "bg-blue-100 text-blue-800 border-transparent", dsar: "N/A", breach: "72 hours" },
];

export default function DocsRegulationsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Regulatory Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Track which privacy regulations apply to your organization, understand their requirements,
          and let the system automatically configure deadlines and notification windows based on your applicable jurisdictions.
        </p>
      </div>

      <DocSection id="catalog" title="Jurisdiction Catalog" description="Browse 40+ privacy regulations from around the world, organized by region and category.">
        <FeatureMockup title="Jurisdiction Cards">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jurisdictions.map((j) => (
              <div key={j.name} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Scale className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{j.name}</p>
                    <Badge variant="outline" className={`text-[10px] ${j.regionColor}`}>
                      {j.region}
                    </Badge>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      DSAR deadline: <span className="font-medium text-foreground">{j.dsar}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Breach notification: <span className="font-medium text-foreground">{j.breach}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="applicability" title="Applicability Wizard" description="Answer simple questions about your organization to determine which regulations apply.">
        <StepList
          steps={[
            { title: "Answer location questions", description: "Provide details about where your customers, employees, and servers are located. The wizard covers key geographic and operational factors." },
            { title: "Identify applicable jurisdictions", description: "The wizard analyzes your answers and identifies which privacy regulations apply to your organization based on jurisdictional reach." },
            { title: "Review recommendations", description: "Review the list of recommended regulations and choose which ones to apply to your organization. You can add or skip any recommendation." },
            { title: "Auto-configure deadlines", description: "Once applied, the system automatically configures DSAR response deadlines and breach notification windows based on each regulation's requirements." },
          ]}
        />
        <InfoCallout type="tip" title="Re-run when expanding">
          Run the applicability wizard again whenever you expand into new markets, hire employees in new countries,
          or deploy infrastructure in new regions. New jurisdictions may become applicable as your footprint grows.
        </InfoCallout>
      </DocSection>

      <DocSection id="categories" title="Regulation Categories">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Comprehensive</p>
              <p className="text-xs text-muted-foreground">Full privacy frameworks covering all aspects of data protection, such as GDPR, CPRA, LGPD, and POPIA.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Sectoral</p>
              <p className="text-xs text-muted-foreground">Industry-specific regulations targeting particular sectors, such as HIPAA for healthcare and PCI DSS for payment data.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">AI Governance</p>
              <p className="text-xs text-muted-foreground">AI-specific regulations and frameworks, such as the EU AI Act, addressing algorithmic transparency and automated decision-making.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Emerging</p>
              <p className="text-xs text-muted-foreground">Newly enacted or proposed laws that are not yet fully enforced, helping you prepare for upcoming compliance requirements.</p>
            </div>
          </div>
        </div>
      </DocSection>

      <DocSection id="managing" title="Managing Jurisdictions">
        <p className="text-sm text-muted-foreground">
          Once you have identified applicable regulations through the wizard or manual selection, you can manage them from the Regulations dashboard.
          Applying a jurisdiction creates it in your organization&apos;s database and links it to your compliance profile.
        </p>
        <FeatureMockup title="Jurisdiction Management">
          <div className="space-y-2">
            {[
              { name: "GDPR", status: "Applied", primary: true },
              { name: "CPRA", status: "Applied", primary: false },
              { name: "LGPD", status: "Not Applied", primary: false },
            ].map((j) => (
              <div key={j.name} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{j.name}</span>
                  {j.primary && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-transparent">
                      Primary
                    </Badge>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    j.status === "Applied"
                      ? "bg-green-100 text-green-800 border-transparent"
                      : "bg-gray-100 text-gray-800 border-transparent"
                  }`}
                >
                  {j.status}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title="Primary jurisdiction">
          Setting a primary jurisdiction determines the default DSAR response deadline and breach notification window
          used across your organization. Other applied jurisdictions are tracked alongside, and the strictest deadline
          always takes precedence when multiple jurisdictions overlap.
        </InfoCallout>
      </DocSection>

      <DocSection id="impact" title="System Impact" description="Applied jurisdictions directly influence how DPO Central calculates deadlines and monitors compliance across your organization.">
        <FeatureMockup title="Impact Overview">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            {[
              { label: "DSAR Deadlines", value: "Auto-set", icon: Clock, subtitle: "Based on strictest jurisdiction" },
              { label: "Breach Notifications", value: "Auto-set", icon: AlertTriangle, subtitle: "72h, expedient, or custom" },
              { label: "Compliance Monitoring", value: "Active", icon: CheckCircle2, subtitle: "Continuous requirement tracking" },
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
                    <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>
        <InfoCallout type="note" title="Jurisdictions are additive">
          When multiple jurisdictions apply to the same processing activity, the system follows the strictest rule.
          For example, if GDPR requires a 30-day DSAR response and LGPD requires 15 days, the system will enforce
          the 15-day deadline. This ensures you remain compliant with all applicable regulations simultaneously.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Transfer Compliance", href: "/privacy/docs/transfer-compliance" }}
        next={{ title: "AI Governance", href: "/privacy/docs/ai-governance" }}
      />
    </div>
  );
}

import { Bot, AlertTriangle, CheckCircle2, Clock, ShieldCheck, Eye, BookOpen, Users, Database, Building2, ClipboardCheck, Shield, ArrowRightLeft, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const riskLevelConfig: Record<string, { color: string; label: string; description: string }> = {
  UNACCEPTABLE: { color: "bg-red-100 text-red-800 border-transparent", label: "Unacceptable", description: "Prohibited — must be decommissioned" },
  HIGH: { color: "bg-orange-100 text-orange-800 border-transparent", label: "High Risk", description: "Strict compliance obligations" },
  LIMITED: { color: "bg-yellow-100 text-yellow-800 border-transparent", label: "Limited", description: "Transparency requirements" },
  MINIMAL: { color: "bg-green-100 text-green-800 border-transparent", label: "Minimal", description: "No specific obligations" },
};

const riskExamples = [
  { level: "UNACCEPTABLE", examples: "Social scoring by governments, real-time mass biometric surveillance in public spaces" },
  { level: "HIGH", examples: "Recruitment and HR screening AI, credit scoring, student assessment and exam proctoring" },
  { level: "LIMITED", examples: "Customer-facing chatbots, deepfake generation tools, emotion recognition systems" },
  { level: "MINIMAL", examples: "Spam filters, AI-powered video games, inventory management systems" },
];

export default function DocsAiGovernancePage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Governance Register</h1>
        <p className="text-muted-foreground mt-1">
          Classify, document, and monitor all AI systems in your organization. Stay ahead of the EU AI Act
          and other emerging AI regulations with a centralized governance register.
        </p>
      </div>

      <DocSection id="overview" title="Why AI Governance?" description="The EU AI Act introduces mandatory obligations for AI systems by August 2026. The AI Governance Register helps you classify, document, and monitor all AI systems in your organization.">
        <FeatureMockup title="AI Governance Dashboard">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Systems", value: "12", icon: Bot, color: "" },
              { label: "High Risk", value: "3", icon: AlertTriangle, color: "text-orange-600" },
              { label: "Compliant", value: "9", icon: CheckCircle2, color: "text-green-600" },
              { label: "Under Review", value: "2", icon: Clock, color: "text-yellow-600" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{stat.label}</CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color || "text-muted-foreground"}`} />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="risk-levels" title="EU AI Act Risk Classification">
        <FeatureMockup title="Risk Level Badges">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {Object.entries(riskLevelConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant="outline" className={config.color}>{config.label}</Badge>
                  <span className="text-xs text-muted-foreground">{config.description}</span>
                </div>
              ))}
            </div>
          </div>
        </FeatureMockup>

        <FeatureMockup title="Risk Classification Examples">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left font-medium px-4 py-2">Risk Level</th>
                  <th className="text-left font-medium px-4 py-2">Example Use Cases</th>
                </tr>
              </thead>
              <tbody>
                {riskExamples.map((row, i) => (
                  <tr key={row.level} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-[10px] ${riskLevelConfig[row.level].color}`}>
                        {riskLevelConfig[row.level].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="registration" title="Registering AI Systems" description="Add AI systems to the governance register with structured metadata and risk classification.">
        <StepList
          steps={[
            { title: "Enter system details", description: "Provide the AI system name, purpose, provider, model type, and deployment context. Include details about the data it processes and the decisions it influences." },
            { title: "Classify risk level", description: "Select the risk level based on the EU AI Act classification. The system suggests a risk level based on the stated purpose and category, but you make the final determination." },
            { title: "Document compliance measures", description: "Record the compliance measures in place: human oversight mechanisms, transparency disclosures, training data documentation, and accuracy monitoring." },
            { title: "Review and register", description: "Review all details and register the AI system. It enters the governance register and becomes subject to ongoing compliance monitoring." },
          ]}
        />
        <InfoCallout type="tip" title="Link to existing vendors">
          When registering an AI system, you can link it to an existing vendor in your vendor management module.
          This connects the AI governance record to the vendor&apos;s risk profile, contract information, and DPA status.
        </InfoCallout>
      </DocSection>

      <DocSection id="risk-suggestion" title="Automatic Risk Suggestion" description="The system analyzes the AI system's stated purpose and category to suggest an appropriate risk level.">
        <FeatureMockup title="Risk Suggestion Example">
          <div className="space-y-2">
            {[
              { name: "Recruitment Screening Tool", purpose: "Automated CV filtering and candidate ranking", suggested: "HIGH" },
              { name: "Customer Support Chatbot", purpose: "Answer FAQs and route support tickets", suggested: "LIMITED" },
              { name: "Email Spam Filter", purpose: "Classify and filter unwanted emails", suggested: "MINIMAL" },
            ].map((system) => (
              <div key={system.name} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{system.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">{system.purpose}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Suggested:</span>
                  <Badge variant="outline" className={`text-[10px] ${riskLevelConfig[system.suggested].color}`}>
                    {riskLevelConfig[system.suggested].label}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title="Suggestion is a starting point">
          The automatic risk suggestion uses keyword matching against the AI system&apos;s purpose and category fields.
          It is intended as a helpful starting point, not a definitive classification. Human review is always required
          to confirm the risk level, as context and nuance matter significantly in EU AI Act classification.
        </InfoCallout>
      </DocSection>

      <DocSection id="obligations" title="Compliance Obligations" description="Each risk level carries specific compliance obligations under the EU AI Act. The register tracks which obligations apply and their fulfillment status.">
        <FeatureMockup title="High Risk Obligations">
          <div className="space-y-2">
            {[
              { obligation: "Risk Management System", description: "Establish and maintain a continuous risk management process", icon: ShieldCheck },
              { obligation: "Data Governance", description: "Ensure training, validation, and testing datasets meet quality criteria", icon: Database },
              { obligation: "Technical Documentation", description: "Maintain detailed documentation of the system design and development", icon: BookOpen },
              { obligation: "Record-Keeping", description: "Automatically log system events for traceability and auditability", icon: ClipboardCheck },
              { obligation: "Human Oversight", description: "Design the system to allow effective human oversight during operation", icon: Users },
              { obligation: "Accuracy & Robustness", description: "Achieve and maintain appropriate levels of accuracy, robustness, and cybersecurity", icon: Eye },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.obligation} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{item.obligation}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </FeatureMockup>
        <InfoCallout type="note" title="Limited risk transparency">
          AI systems classified as LIMITED risk must clearly disclose to users that they are interacting with an AI system.
          This applies to chatbots, emotion recognition, and deepfake generation tools. The register tracks whether
          this transparency disclosure has been implemented.
        </InfoCallout>
        <InfoCallout type="warning" title="August 2026 deadline">
          The EU AI Act&apos;s obligations for high-risk AI systems become enforceable in August 2026. Organizations
          should begin classifying and documenting their AI systems now to ensure compliance by the deadline.
          Non-compliance can result in fines up to 35 million EUR or 7% of global annual turnover.
        </InfoCallout>
      </DocSection>

      <DocSection id="linking" title="Integration with Other Modules" description="AI governance records connect to other DPO Central modules for a comprehensive compliance view.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Vendors</p>
              <p className="text-xs text-muted-foreground">Link AI systems to their providers for contract tracking, DPA status, and vendor risk monitoring.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Assessments</p>
              <p className="text-xs text-muted-foreground">Trigger AI impact assessments directly from the register. Assessment results link back to the AI system record.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Data Inventory</p>
              <p className="text-xs text-muted-foreground">Map training data sources to your data inventory. Track which data assets feed into each AI system.</p>
            </div>
          </div>
        </div>
      </DocSection>

      <DocSection id="ai-sentinel" title="AI Sentinel Integration" description="DPO Central serves as the lightweight privacy-compliance register for AI systems. For deep AI governance — risk classification history, compliance frameworks, oversight gates, AI incidents, policies — use AI Sentinel.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Vendor Import Creates AI Records</p>
              <p className="text-xs text-muted-foreground">
                When you import AI-capable vendors from the Vendor Catalog during quickstart,
                DPO Central automatically creates AI System records with capabilities,
                techniques, EU AI Act role, and risk classification from the catalog data.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Export to AI Sentinel</p>
              <p className="text-xs text-muted-foreground">
                Send your AI System records to AI Sentinel for deep governance management.
                Exported systems are linked with a deep link back to AI Sentinel for
                seamless navigation between apps.
              </p>
            </div>
          </div>
        </div>

        <FeatureMockup title="Integration Flow">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-sm">
            <div className="rounded-lg border p-3 text-center flex-1">
              <Database className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="font-medium">Vendor.Watch</p>
              <p className="text-xs text-muted-foreground">AI fields in catalog</p>
            </div>
            <span className="text-muted-foreground hidden sm:block">&rarr;</span>
            <span className="text-muted-foreground sm:hidden">&darr;</span>
            <div className="rounded-lg border border-primary/50 bg-primary/5 p-3 text-center flex-1">
              <Bot className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="font-medium">DPO Central</p>
              <p className="text-xs text-muted-foreground">Lightweight AI register</p>
            </div>
            <span className="text-muted-foreground hidden sm:block">&rarr;</span>
            <span className="text-muted-foreground sm:hidden">&darr;</span>
            <div className="rounded-lg border p-3 text-center flex-1">
              <Shield className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <p className="font-medium">AI Sentinel</p>
              <p className="text-xs text-muted-foreground">Deep AI governance</p>
            </div>
          </div>
        </FeatureMockup>

        <InfoCallout type="info" title="Configuration required">
          The AI Sentinel integration requires the AI_SENTINEL_API_URL and AI_SENTINEL_API_KEY
          environment variables. When configured, you&apos;ll see the &quot;Send to AI Sentinel&quot;
          button on the AI Systems list page. Systems that have been exported show a linked
          badge and deep link on their detail page.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Regulations", href: "/privacy/docs/regulations" }}
        next={{ title: "Premium Features", href: "/privacy/docs/premium" }}
      />
    </div>
  );
}

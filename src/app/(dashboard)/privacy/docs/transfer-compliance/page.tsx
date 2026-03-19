import { Globe, FileCheck, Shield, CheckCircle, Lock, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const complianceStatusColors: Record<string, string> = {
  COMPLIANT: "bg-green-100 text-green-800 border-transparent",
  NEEDS_REVIEW: "bg-yellow-100 text-yellow-800 border-transparent",
  NON_COMPLIANT: "bg-red-100 text-red-800 border-transparent",
  PENDING: "bg-gray-100 text-gray-800 border-transparent",
};

const adequacyCountries = [
  { country: "Andorra", year: "2010" },
  { country: "Argentina", year: "2003" },
  { country: "Canada (commercial)", year: "2001" },
  { country: "Israel", year: "2011" },
  { country: "Japan", year: "2019" },
  { country: "New Zealand", year: "2012" },
  { country: "South Korea", year: "2022" },
  { country: "Switzerland", year: "2000" },
  { country: "United Kingdom", year: "2021" },
  { country: "Uruguay", year: "2012" },
  { country: "USA (Data Privacy Framework)", year: "2023" },
];

export default function DocsTransferCompliancePage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transfer Compliance Manager</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage cross-border data transfers with a centralized compliance dashboard.
          Track adequacy decisions, SCCs, and TIA status across all your international data flows.
        </p>
      </div>

      <DocSection id="overview" title="Transfer Compliance Overview" description="Post-Schrems II, international data transfers require careful compliance management. The Transfer Compliance Manager provides a centralized view of all cross-border data flows.">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {[
            { label: "Adequacy Status", value: "11 countries", subtitle: "Active adequacy decisions", icon: Globe },
            { label: "SCC Tracking", value: "Active", subtitle: "Monitored contracts", icon: FileCheck },
            { label: "TIA Status", value: "Up to date", subtitle: "Transfer impact assessments", icon: Shield },
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
      </DocSection>

      <DocSection id="compliance-status" title="Compliance Status" description="Each transfer is assigned a compliance status based on the safeguards in place.">
        <FeatureMockup title="Transfer Compliance Statuses">
          <div className="space-y-3">
            {[
              { status: "COMPLIANT", description: "Transfer has an adequacy decision or valid SCCs with a completed Transfer Impact Assessment. No action required." },
              { status: "NEEDS_REVIEW", description: "SCCs are in place but no TIA has been completed, or supplementary measures may be outdated. Review recommended." },
              { status: "NON_COMPLIANT", description: "SCCs have expired or no valid transfer mechanism is in place. Immediate action required to avoid regulatory risk." },
              { status: "PENDING", description: "Transfer has been registered but not yet assessed. Complete the compliance review to assign a status." },
            ].map((item) => (
              <div key={item.status} className="flex items-start gap-3">
                <Badge variant="outline" className={`text-[10px] mt-0.5 shrink-0 ${complianceStatusColors[item.status]}`}>
                  {item.status.replace("_", " ")}
                </Badge>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="schrems-ii" title="Schrems II Checklist" description="Follow the EDPB-recommended six-step framework for assessing international data transfers.">
        <StepList
          steps={[
            { title: "Know your transfers", description: "Map all international data transfers in your data inventory. Identify the source, destination country, categories of data, and recipients." },
            { title: "Identify transfer tool", description: "Determine the appropriate transfer mechanism: adequacy decision, Standard Contractual Clauses (SCCs), Binding Corporate Rules (BCRs), or a derogation under Article 49." },
            { title: "Assess third country law", description: "Evaluate whether the laws and practices of the destination country provide an essentially equivalent level of protection. Focus on surveillance powers and data access by public authorities." },
            { title: "Apply supplementary measures", description: "If the third country assessment reveals gaps, identify and implement technical, contractual, or organizational supplementary measures to bridge the protection gap." },
            { title: "Complete procedural steps", description: "Finalize required formalities: execute SCCs, obtain authorization where needed, and document your transfer impact assessment (TIA)." },
            { title: "Monitor developments", description: "Continuously monitor legal and political developments in destination countries. Re-evaluate transfers when circumstances change." },
          ]}
        />
        <InfoCallout type="warning" title="SCCs alone may not be sufficient">
          The CJEU ruled in Schrems II that Standard Contractual Clauses must be supplemented with additional
          safeguards where the destination country&apos;s laws do not provide essentially equivalent protection.
          Always complete a Transfer Impact Assessment alongside your SCCs.
        </InfoCallout>
      </DocSection>

      <DocSection id="adequacy" title="Adequacy Decisions" description="The European Commission has recognized certain countries as providing an adequate level of data protection. Transfers to these countries do not require additional safeguards.">
        <FeatureMockup title="Countries with Adequacy Decisions">
          <div className="space-y-2">
            {adequacyCountries.map((item) => (
              <div key={item.country} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{item.country}</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-transparent">
                  Since {item.year}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="supplementary-measures" title="Supplementary Measures" description="When a transfer mechanism alone does not provide sufficient protection, supplementary measures help bridge the gap.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Technical Measures</p>
              <p className="text-xs text-muted-foreground">
                End-to-end encryption, pseudonymization, key management under EU control,
                and strict access controls that prevent third-country authorities from accessing data in the clear.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Contractual Measures</p>
              <p className="text-xs text-muted-foreground">
                Additional contractual clauses requiring the importer to notify of access requests,
                audit rights for the exporter, and commitments to challenge disproportionate requests.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Organizational Measures</p>
              <p className="text-xs text-muted-foreground">
                Internal data protection policies, regular staff training, governance structures
                with clear accountability, and documented procedures for handling government access requests.
              </p>
            </div>
          </div>
        </div>
      </DocSection>

      <DocSection id="scc-tracking" title="SCC Expiry Tracking" description="The Transfer Compliance Manager automatically monitors SCC expiry dates and sends alerts so you never miss a renewal deadline.">
        <FeatureMockup title="SCC Expiry Timeline">
          <div className="space-y-2">
            {[
              { vendor: "CloudHost EU", destination: "US (Virginia)", expires: "2026-06-15", daysLeft: 88, status: "Active" },
              { vendor: "Analytics Corp", destination: "India", expires: "2026-04-20", daysLeft: 32, status: "Expiring Soon" },
              { vendor: "DataSync Ltd", destination: "Brazil", expires: "2026-04-01", daysLeft: 13, status: "Urgent" },
              { vendor: "Legacy Hosting", destination: "Singapore", expires: "2026-02-28", daysLeft: 0, status: "Expired" },
            ].map((scc) => (
              <div key={scc.vendor} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{scc.vendor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                    {scc.destination} — Expires {scc.expires}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    scc.status === "Active"
                      ? "bg-green-100 text-green-800 border-transparent"
                      : scc.status === "Expiring Soon"
                        ? "bg-yellow-100 text-yellow-800 border-transparent"
                        : scc.status === "Urgent"
                          ? "bg-orange-100 text-orange-800 border-transparent"
                          : "bg-red-100 text-red-800 border-transparent"
                  }`}
                >
                  {scc.status === "Expired" ? "Expired" : `${scc.daysLeft}d remaining`}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title="Set expiry dates when creating transfers">
          Always enter the SCC expiry date when registering a cross-border transfer. The system sends
          automatic email notifications at 30 days and 7 days before expiry, giving you time to
          renew or renegotiate with the data importer.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "DPIA Auto-Fill", href: "/privacy/docs/dpia-auto-fill" }}
        next={{ title: "Regulations", href: "/privacy/docs/regulations" }}
      />
    </div>
  );
}

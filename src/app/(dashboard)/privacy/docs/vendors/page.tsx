import { Building2, FileCheck, MessageSquare, ShieldAlert, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const vendorStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 border-transparent",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-800 border-transparent",
  SUSPENDED: "bg-red-100 text-red-800 border-transparent",
};

const riskTierColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  HIGH: "bg-orange-100 text-orange-800 border-transparent",
  CRITICAL: "bg-red-100 text-red-800 border-transparent",
};

export default function DocsVendorsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vendor Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage third-party vendors that process personal data on your behalf. Track contracts,
          conduct due diligence questionnaires, and monitor risk levels across your vendor portfolio.
        </p>
      </div>

      <DocSection id="adding" title="Adding Vendors" description="Register vendors and capture key details about their data processing relationship with your organization.">
        <FeatureMockup title="Vendor Stats">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Vendors", value: "18", icon: Building2 },
              { label: "Active", value: "14", icon: Building2 },
              { label: "High Risk", value: "3", icon: ShieldAlert },
              { label: "Pending Review", value: "2", icon: Clock },
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>

        <FeatureMockup title="Vendor Cards">
          <div className="space-y-2">
            {[
              { name: "Acme Cloud Services", status: "ACTIVE", risk: "LOW", category: "Cloud Infrastructure" },
              { name: "DataTech Analytics", status: "ACTIVE", risk: "HIGH", category: "Analytics" },
              { name: "SecureMail Pro", status: "UNDER_REVIEW", risk: "MEDIUM", category: "Email Service" },
              { name: "Legacy CRM Inc.", status: "SUSPENDED", risk: "CRITICAL", category: "CRM" },
            ].map((vendor) => (
              <div key={vendor.name} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{vendor.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">{vendor.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${riskTierColors[vendor.risk]}`}>
                    {vendor.risk} Risk
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${vendorStatusColors[vendor.status]}`}>
                    {vendor.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>

        <StepList
          steps={[
            { title: "Navigate to Vendors", description: "Click 'Vendors' in the main navigation bar." },
            { title: "Click 'Add Vendor'", description: "Open the vendor creation form." },
            { title: "Enter vendor details", description: "Provide the vendor name, category, description, contact information, and data processing details." },
            { title: "Set risk tier", description: "Assign an initial risk tier (LOW, MEDIUM, HIGH, CRITICAL) based on the type and volume of data they process." },
            { title: "Upload contract", description: "Attach the Data Processing Agreement (DPA) or other relevant contracts." },
            { title: "Send questionnaire", description: "Optionally send a due diligence questionnaire for the vendor to complete." },
          ]}
        />
      </DocSection>

      <DocSection id="contracts" title="Contracts" description="Track Data Processing Agreements (DPAs) and other contracts with each vendor.">
        <FeatureMockup title="Contract Tracking">
          <div className="space-y-2">
            {[
              { vendor: "Acme Cloud Services", type: "DPA", start: "2024-01-01", end: "2025-12-31", status: "Active" },
              { vendor: "DataTech Analytics", type: "DPA + SCC", start: "2024-06-15", end: "2025-06-14", status: "Expiring Soon" },
              { vendor: "SecureMail Pro", type: "DPA", start: "2023-03-01", end: "2024-02-28", status: "Expired" },
            ].map((contract) => (
              <div key={contract.vendor} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{contract.vendor}</p>
                    <p className="text-xs text-muted-foreground">{contract.type} — {contract.start} to {contract.end}</p>
                  </div>
                </div>
                <Badge
                  variant={contract.status === "Active" ? "success" : contract.status === "Expiring Soon" ? "warning" : "destructive"}
                  className="text-[10px]"
                >
                  {contract.status}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="warning" title="Contract expiry alerts">
          The system sends email notifications 90, 60, and 30 days before a contract expires, giving you time to renew or renegotiate terms.
        </InfoCallout>
      </DocSection>

      <DocSection id="questionnaires" title="Questionnaires" description="Send standardized due diligence questionnaires to vendors to assess their privacy and security practices.">
        <FeatureMockup title="Questionnaire Status">
          <div className="space-y-2">
            {[
              { vendor: "Acme Cloud Services", sent: "2024-12-01", status: "Completed", score: "92%" },
              { vendor: "DataTech Analytics", sent: "2025-01-05", status: "In Progress", score: "—" },
              { vendor: "SecureMail Pro", sent: "2025-01-10", status: "Sent", score: "—" },
            ].map((q) => (
              <div key={q.vendor} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{q.vendor}</p>
                    <p className="text-xs text-muted-foreground">Sent {q.sent}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {q.score !== "—" && <span className="text-xs font-medium text-primary">{q.score}</span>}
                  <Badge
                    variant={q.status === "Completed" ? "success" : q.status === "In Progress" ? "info" : "secondary"}
                    className="text-[10px]"
                  >
                    {q.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title="Questionnaire templates">
          You can create reusable questionnaire templates covering topics like data security, breach notification processes,
          subprocessor management, and data retention. Templates can be customized per vendor category.
        </InfoCallout>
      </DocSection>

      <DocSection id="risk-reviews" title="Risk Reviews" description="Periodically review vendor risk levels based on questionnaire results, incident history, and contract compliance.">
        <InfoCallout type="info" title="Review frequency">
          The recommended review frequency depends on the vendor&apos;s risk tier: CRITICAL vendors quarterly,
          HIGH vendors semi-annually, MEDIUM vendors annually, and LOW vendors every two years.
        </InfoCallout>
        <InfoCallout type="note" title="Vendor Risk Assessments">
          For a formal, template-driven vendor risk assessment process, see the
          {" "}<a href="/privacy/docs/premium#vendor-risk" className="text-primary underline">Vendor Risk Assessment</a>{" "}
          premium feature.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Incidents", href: "/privacy/docs/incidents" }}
        next={{ title: "Premium Features", href: "/privacy/docs/premium" }}
      />
    </div>
  );
}

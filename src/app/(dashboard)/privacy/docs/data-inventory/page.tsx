import { Database, Globe, ArrowRightLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

export default function DocsDataInventoryPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Inventory</h1>
        <p className="text-muted-foreground mt-1">
          The Data Inventory module is the foundation of your privacy program. It tracks what personal data you hold,
          where it flows, and how it&apos;s processed — forming the basis for your Record of Processing Activities (ROPA).
        </p>
      </div>

      <DocSection id="assets" title="Data Assets" description="Data assets represent systems, databases, or applications that store personal data.">
        <FeatureMockup title="Asset Cards">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "Customer CRM", type: "DATABASE", elements: 12, activities: 3 },
              { name: "HR Portal", type: "APPLICATION", elements: 8, activities: 2 },
              { name: "Marketing Cloud", type: "CLOUD_SERVICE", elements: 15, activities: 4 },
              { name: "Backup Server", type: "PHYSICAL_STORAGE", elements: 6, activities: 1 },
            ].map((asset) => (
              <Card key={asset.name} className="hover:translate-y-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{asset.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{asset.type.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{asset.elements} data elements</span>
                    <span>{asset.activities} activities</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </FeatureMockup>

        <StepList
          steps={[
            { title: "Navigate to Data Inventory", description: "Click 'Data Inventory' in the main navigation bar." },
            { title: "Click 'Add Asset'", description: "Use the button in the top-right to open the asset creation form." },
            { title: "Fill in details", description: "Enter the asset name, type (Database, Application, Cloud Service, etc.), description, and data owner." },
            { title: "Link data elements", description: "Add the personal data elements this asset stores (see Data Elements section)." },
            { title: "Save the asset", description: "The asset will appear in your inventory and can be linked to processing activities." },
          ]}
        />
      </DocSection>

      <DocSection id="data-elements" title="Data Elements" description="Data elements are the specific types of personal data you process (e.g., email addresses, IP addresses, health records).">
        <FeatureMockup title="Data Element Sensitivity Scale">
          <div className="space-y-2">
            {[
              { name: "Company Name", sensitivity: "PUBLIC", color: "bg-green-100 text-green-800" },
              { name: "Email Address", sensitivity: "INTERNAL", color: "bg-blue-100 text-blue-800" },
              { name: "Home Address", sensitivity: "CONFIDENTIAL", color: "bg-yellow-100 text-yellow-800" },
              { name: "National ID Number", sensitivity: "RESTRICTED", color: "bg-orange-100 text-orange-800" },
              { name: "Health Records", sensitivity: "SPECIAL_CATEGORY", color: "bg-red-100 text-red-800" },
            ].map((el) => (
              <div key={el.name} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{el.name}</span>
                <Badge variant="outline" className={`text-[10px] ${el.color} border-transparent`}>{el.sensitivity.replace("_", " ")}</Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title="GDPR Special Category Data">
          Data classified as SPECIAL_CATEGORY (Article 9 data) requires explicit consent or another specific legal basis. The system flags these elements for additional review in assessments.
        </InfoCallout>
      </DocSection>

      <DocSection id="processing-activities" title="Processing Activities" description="Processing activities describe how and why personal data is used. Each activity links to assets, elements, and a legal basis.">
        <FeatureMockup title="Processing Activity Card">
          <Card className="hover:translate-y-0">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">Customer Support Correspondence</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Processing support tickets and follow-ups</p>
                </div>
                <Badge variant="outline" className="text-[10px]">LEGITIMATE_INTEREST</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Email Address", "Full Name", "Support History"].map((el) => (
                  <Badge key={el} variant="secondary" className="text-[10px]">{el}</Badge>
                ))}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>2 assets</span>
                <span>3 data elements</span>
                <span>Retention: 3 years</span>
              </div>
            </CardContent>
          </Card>
        </FeatureMockup>
        <InfoCallout type="note" title="Legal Basis">
          Each processing activity must have a documented legal basis: Consent, Contract, Legal Obligation, Vital Interest, Public Task, or Legitimate Interest.
        </InfoCallout>
      </DocSection>

      <DocSection id="data-flows" title="Data Flows" description="Data flows visualize how personal data moves between assets, both internally and externally.">
        <FeatureMockup title="Data Flow Diagram">
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3 mb-1">
                <Database className="h-5 w-5 text-primary mx-auto" />
              </div>
              <p className="text-xs font-medium">CRM</p>
            </div>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3 mb-1">
                <Database className="h-5 w-5 text-primary mx-auto" />
              </div>
              <p className="text-xs font-medium">Marketing</p>
            </div>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/5 p-3 mb-1">
                <Globe className="h-5 w-5 text-blue-500 mx-auto" />
              </div>
              <p className="text-xs font-medium">Analytics (EU)</p>
            </div>
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title="Diagram generation">
          Data flows are auto-generated from asset relationships. Link assets together and the system will produce the flow visualization.
        </InfoCallout>
      </DocSection>

      <DocSection id="transfers" title="Cross-Border Transfers" description="Track international data transfers and the safeguards in place for each.">
        <FeatureMockup title="Transfer Records">
          <div className="space-y-2">
            {[
              { from: "EU (Ireland)", to: "US (Virginia)", mechanism: "SCCs", status: "Active" },
              { from: "EU (Germany)", to: "UK", mechanism: "Adequacy Decision", status: "Active" },
              { from: "EU (France)", to: "India", mechanism: "BCRs", status: "Under Review" },
            ].map((t) => (
              <div key={`${t.from}-${t.to}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>{t.from}</span>
                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                  <span>{t.to}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{t.mechanism}</Badge>
                  <Badge variant={t.status === "Active" ? "success" : "warning"} className="text-[10px]">{t.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="warning" title="Schrems II compliance">
          International transfers require a valid transfer mechanism. If your Transfer Impact Assessment (TIA) identifies risks, additional safeguards may be needed. See the Premium Features section for TIA assessments.
        </InfoCallout>
        <InfoCallout type="tip" title="ROPA Export">
          You can export your complete Record of Processing Activities (ROPA) from the Data Inventory list view. The export includes all assets, elements, activities, legal bases, and transfer records.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Getting Started", href: "/privacy/docs" }}
        next={{ title: "DSAR Management", href: "/privacy/docs/dsar" }}
      />
    </div>
  );
}

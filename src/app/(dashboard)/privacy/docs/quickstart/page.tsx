import {
  Zap,
  Building2,
  Sparkles,
  ShoppingCart,
  Cloud,
  Heart,
  Landmark,
  Newspaper,
  Briefcase,
  Database,
  FileText,
  ArrowRightLeft,
  Shield,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocSection } from "@/components/docs/doc-section";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import Link from "next/link";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Cloud,
  Heart,
  Landmark,
  Newspaper,
  Briefcase,
};

const TEMPLATES = [
  {
    id: "ecommerce",
    name: "E-commerce",
    icon: "ShoppingCart",
    description: "Online retail with customer accounts, orders, payments, and marketing",
    assets: [
      { name: "Customer Database", type: "Database", elements: 7 },
      { name: "Order Management System", type: "Application", elements: 4 },
      { name: "Marketing Platform", type: "Cloud Service", elements: 4 },
      { name: "Web Analytics", type: "Cloud Service", elements: 4 },
      { name: "Payment Gateway", type: "Third-Party", elements: 4 },
    ],
    activities: [
      { name: "Customer Account Management", basis: "Contract" },
      { name: "Order Processing & Fulfillment", basis: "Contract" },
      { name: "Marketing & Promotions", basis: "Consent" },
      { name: "Website Analytics & Optimization", basis: "Legitimate Interests" },
    ],
    flows: [
      "Customer to Orders",
      "Orders to Payment",
      "Customer to Marketing",
    ],
  },
  {
    id: "saas",
    name: "SaaS / Technology",
    icon: "Cloud",
    description: "Software-as-a-service platform with user accounts, usage tracking, and support",
    assets: [
      { name: "User Database", type: "Database", elements: 5 },
      { name: "Application Logs", type: "Cloud Service", elements: 4 },
      { name: "Support Ticketing System", type: "Cloud Service", elements: 3 },
      { name: "Billing System", type: "Cloud Service", elements: 4 },
      { name: "Product Analytics", type: "Cloud Service", elements: 3 },
    ],
    activities: [
      { name: "User Account Provisioning", basis: "Contract" },
      { name: "Service Delivery & Processing", basis: "Contract" },
      { name: "Subscription Billing", basis: "Contract" },
      { name: "Customer Support", basis: "Contract" },
      { name: "Product Analytics & Improvement", basis: "Legitimate Interests" },
    ],
    flows: [
      "User Actions to Logs",
      "User to Billing",
      "User to Analytics",
    ],
  },
  {
    id: "healthcare",
    name: "Healthcare",
    icon: "Heart",
    description: "Healthcare provider or health-tech with patient data, EHR, and regulatory compliance",
    assets: [
      { name: "Electronic Health Records (EHR)", type: "Application", elements: 7 },
      { name: "Patient Portal", type: "Application", elements: 4 },
      { name: "Billing & Insurance System", type: "Application", elements: 4 },
      { name: "Staff HR System", type: "Application", elements: 4 },
    ],
    activities: [
      { name: "Patient Care & Treatment", basis: "Vital Interests" },
      { name: "Medical Billing & Insurance", basis: "Legal Obligation" },
      { name: "Staff Employment Management", basis: "Contract" },
    ],
    flows: [
      "EHR to Patient Portal",
      "EHR to Billing",
    ],
  },
  {
    id: "fintech",
    name: "Fintech",
    icon: "Landmark",
    description: "Financial technology with KYC, transaction processing, and regulatory reporting",
    assets: [
      { name: "KYC/Identity Verification System", type: "Application", elements: 5 },
      { name: "Transaction Ledger", type: "Database", elements: 5 },
      { name: "Customer Account System", type: "Application", elements: 4 },
      { name: "Regulatory Reporting System", type: "Application", elements: 3 },
    ],
    activities: [
      { name: "Customer Onboarding & KYC", basis: "Legal Obligation" },
      { name: "Transaction Processing", basis: "Contract" },
      { name: "AML Monitoring & Regulatory Reporting", basis: "Legal Obligation" },
    ],
    flows: [
      "KYC to Account",
      "Transactions to Monitoring",
    ],
  },
  {
    id: "media",
    name: "Media / Publishing",
    icon: "Newspaper",
    description: "Digital media, news, or content platform with subscriptions and advertising",
    assets: [
      { name: "Subscriber Database", type: "Database", elements: 5 },
      { name: "Content Management System", type: "Application", elements: 3 },
      { name: "Ad Tech Platform", type: "Cloud Service", elements: 4 },
      { name: "Newsletter Platform", type: "Cloud Service", elements: 3 },
    ],
    activities: [
      { name: "Subscription Management", basis: "Contract" },
      { name: "Programmatic Advertising", basis: "Consent" },
      { name: "Newsletter Distribution", basis: "Consent" },
      { name: "Content Personalization", basis: "Legitimate Interests" },
    ],
    flows: [
      "Subscribers to Ad Platform",
      "Subscribers to Newsletter",
    ],
  },
  {
    id: "professional_services",
    name: "Professional Services",
    icon: "Briefcase",
    description: "Consulting, legal, accounting, or agency with client data and project management",
    assets: [
      { name: "Client Database", type: "Database", elements: 4 },
      { name: "Project Management System", type: "Cloud Service", elements: 4 },
      { name: "HR & Payroll System", type: "Cloud Service", elements: 5 },
      { name: "Document Management", type: "Cloud Service", elements: 3 },
    ],
    activities: [
      { name: "Client Relationship Management", basis: "Contract" },
      { name: "Service Delivery & Project Work", basis: "Contract" },
      { name: "Employee HR & Payroll", basis: "Contract" },
    ],
    flows: [
      "Client to Projects",
      "Projects to Documents",
    ],
  },
];

export default function DocsQuickstartPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quickstart Wizard</h1>
        <p className="text-muted-foreground mt-1">
          Bootstrap your entire privacy program in minutes. The quickstart wizard creates
          data assets, data elements, processing activities, data flows, and vendor records
          based on your industry and the tools you use.
        </p>
      </div>

      {/* HOW IT WORKS */}
      <DocSection id="how-it-works" title="How It Works" description="The wizard offers two complementary paths that can be used together.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Import from Vendors</p>
              <p className="text-xs text-muted-foreground mt-1">
                Select vendors from the catalog (or import from your Vendor.Watch portfolio).
                For each vendor, the wizard auto-generates a data asset, data elements,
                a processing activity, and cross-border transfer records based on the
                vendor&apos;s known data profile.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Industry Template</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pick your industry and get a pre-built scaffold of data assets, processing
                activities, and data flows. Each template is designed by privacy professionals
                to reflect common data processing patterns for that sector.
              </p>
            </div>
          </div>
        </div>
        <InfoCallout type="info" title="Non-destructive">
          The quickstart only creates new records. It never modifies or deletes existing
          data and automatically skips duplicates. You can run it multiple times safely.
        </InfoCallout>
      </DocSection>

      {/* VENDOR.WATCH PORTFOLIO */}
      <DocSection id="vendor-watch" title="Vendor.Watch Portfolio Import" description="If you have a Vendor.Watch account, the quickstart detects your portfolio automatically.">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            When you navigate to the quickstart wizard, it checks if your account has a
            Vendor.Watch portfolio. If found, your vendors are pre-selected and ready
            to import — no manual searching needed.
          </p>
          <FeatureMockup title="What gets created per vendor">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { icon: Database, label: "Data Asset", desc: "One asset per vendor, typed by category (e.g. Cloud Service, Application)" },
                { icon: FileText, label: "Data Elements", desc: "3\u201310 elements per asset — identifiers, behavioral data, financial data, etc." },
                { icon: Shield, label: "Processing Activity", desc: "One activity per vendor with purpose, legal basis, and data subjects" },
                { icon: ArrowRightLeft, label: "Cross-Border Transfers", desc: "Transfer records for each non-EU data location with SCCs as safeguard" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-2 p-3 rounded-lg border">
                    <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </FeatureMockup>
          <InfoCallout type="tip" title="Free tier: 5 vendors from your portfolio">
            You can import up to 5 vendors from your Vendor.Watch portfolio for free during
            quickstart — no Vendor Catalog subscription needed. This matches Vendor.Watch&apos;s
            own free tier. To import more than 5, subscribe to the Vendor Catalog add-on.
          </InfoCallout>
        </div>
      </DocSection>

      {/* INDUSTRY TEMPLATES */}
      <DocSection id="industry-templates" title="Industry Templates" description="Each template provides a complete privacy program scaffold tailored to your sector.">
        <p className="text-sm text-muted-foreground">
          Select your industry to auto-generate data assets (with data elements), processing
          activities (with legal bases), and data flows between systems. All records can be
          customized after creation.
        </p>

        <div className="space-y-6 mt-2">
          {TEMPLATES.map((template) => {
            const Icon = ICON_MAP[template.icon] ?? Sparkles;
            const totalElements = template.assets.reduce((sum, a) => sum + a.elements, 0);
            return (
              <div key={template.id} id={`template-${template.id}`} className="scroll-mt-20">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-xs">{template.description}</CardDescription>
                      </div>
                      <div className="hidden sm:flex gap-2">
                        <Badge variant="secondary" className="text-xs">{template.assets.length} assets</Badge>
                        <Badge variant="secondary" className="text-xs">{totalElements} elements</Badge>
                        <Badge variant="secondary" className="text-xs">{template.activities.length} activities</Badge>
                        <Badge variant="secondary" className="text-xs">{template.flows.length} flows</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Summary badges on mobile */}
                    <div className="flex flex-wrap gap-2 sm:hidden">
                      <Badge variant="secondary" className="text-xs">{template.assets.length} assets</Badge>
                      <Badge variant="secondary" className="text-xs">{totalElements} elements</Badge>
                      <Badge variant="secondary" className="text-xs">{template.activities.length} activities</Badge>
                      <Badge variant="secondary" className="text-xs">{template.flows.length} flows</Badge>
                    </div>

                    {/* Assets */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5" />
                        Data Assets
                      </p>
                      <div className="grid gap-1.5">
                        {template.assets.map((asset) => (
                          <div key={asset.name} className="flex items-center justify-between text-xs rounded border px-3 py-2">
                            <span className="font-medium">{asset.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-normal">{asset.type}</Badge>
                              <span className="text-muted-foreground">{asset.elements} elements</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activities */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Processing Activities
                      </p>
                      <div className="grid gap-1.5">
                        {template.activities.map((activity) => (
                          <div key={activity.name} className="flex items-center justify-between text-xs rounded border px-3 py-2">
                            <span className="font-medium">{activity.name}</span>
                            <Badge variant="outline" className="text-[10px] font-normal">{activity.basis}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Flows */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Data Flows
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {template.flows.map((flow) => (
                          <Badge key={flow} variant="secondary" className="text-xs font-normal">{flow}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </DocSection>

      {/* AFTER QUICKSTART */}
      <DocSection id="after-quickstart" title="After Quickstart" description="What to do once your privacy program is bootstrapped.">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The quickstart gives you a solid foundation. After running it, you should:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Review data elements", desc: "Verify the auto-generated elements match your actual data processing and adjust retention periods" },
              { label: "Update legal bases", desc: "Confirm that the suggested legal basis for each processing activity is correct for your jurisdiction" },
              { label: "Add missing vendors", desc: "Register any vendors not covered by the catalog or your portfolio" },
              { label: "Run assessments", desc: "Use the assessments module to conduct DPIAs for high-risk processing activities" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2 p-3 rounded-lg border">
                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DocSection>

      <div className="mt-2">
        <Link href="/privacy/quickstart">
          <Button className="gap-2">
            <Zap className="w-4 h-4" />
            Open Quickstart Wizard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <DocNavFooter
        previous={{ title: "Getting Started", href: "/privacy/docs" }}
        next={{ title: "Data Inventory", href: "/privacy/docs/data-inventory" }}
      />
    </div>
  );
}

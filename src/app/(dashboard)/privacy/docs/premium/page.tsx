import Link from "next/link";
import { Lock, Shield, Globe, Building2, Search, Sparkles, Mail, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocSection } from "@/components/docs/doc-section";
import { InfoCallout } from "@/components/docs/info-callout";
import { PremiumBadge } from "@/components/docs/premium-badge";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";
import { features } from "@/config/features";

export default function DocsPremiumPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Premium Features</h1>
        <p className="text-muted-foreground mt-1">
          Premium features extend DPO Central with advanced assessment types, vendor intelligence,
          and specialized compliance tools. They require a commercial license.
        </p>
      </div>

      <Card className="border-dashed border-amber-500/50 bg-amber-500/5 hover:translate-y-0">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg border-2 border-amber-500 p-2.5 shrink-0">
              <Lock className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Premium License Required</h3>
                <PremiumBadge />
              </div>
              <p className="text-sm text-muted-foreground">
                The features on this page require a premium license. They are not included in the open-source core.
                {features.selfServiceUpgrade
                  ? " Upgrade your plan to access advanced privacy tools."
                  : " Contact our team to enable premium features for your organization."}
              </p>
              {features.selfServiceUpgrade ? (
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/privacy/billing">
                    <CreditCard className="h-4 w-4 mr-2" />
                    View Plans & Upgrade
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <a href="mailto:hello@todo.law">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Us
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <DocSection id="dpia" title="DPIA — Data Protection Impact Assessment" description="Required by GDPR Article 35 when processing is likely to result in high risk to individuals.">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-medium">GDPR Article 35 Compliance</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">When is a DPIA required?</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              <li>Systematic and extensive profiling with significant effects</li>
              <li>Large-scale processing of special category data (Article 9)</li>
              <li>Systematic monitoring of publicly accessible areas</li>
              <li>Using new technologies that pose high risk</li>
              <li>Processing that prevents data subjects from exercising rights</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">DPIA Workflow</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              <li>Describe the processing operations and purposes</li>
              <li>Assess necessity and proportionality</li>
              <li>Identify and assess risks to individuals</li>
              <li>Determine measures to mitigate risks</li>
              <li>Document the assessment and seek DPO consultation</li>
              <li>If residual risk is high, consult with the supervisory authority</li>
            </ul>
          </div>
        </div>
        <InfoCallout type="info" title="Enable DPIA">
          {features.selfServiceUpgrade
            ? <>Visit the <Link href="/privacy/billing" className="text-primary underline">billing page</Link> to upgrade and enable DPIA assessments.</>
            : "Contact your account manager or email hello@todo.law to enable DPIA assessments for your organization."}
        </InfoCallout>
      </DocSection>

      <DocSection id="pia" title="PIA — Privacy Impact Assessment" description="A broader privacy assessment framework for evaluating privacy implications beyond GDPR-specific requirements.">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-medium">Privacy Impact Analysis</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">How does PIA differ from DPIA?</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              <li><strong>Broader scope:</strong> PIAs cover privacy concerns beyond GDPR, including CCPA, LGPD, and other frameworks</li>
              <li><strong>Organizational focus:</strong> Evaluates privacy risk to both individuals and the organization</li>
              <li><strong>Flexible templates:</strong> Adaptable to different jurisdictions and regulatory requirements</li>
              <li><strong>Use cases:</strong> New product launches, marketing campaigns, AI/ML systems, M&A due diligence</li>
            </ul>
          </div>
        </div>
        <InfoCallout type="info" title="Enable PIA">
          {features.selfServiceUpgrade
            ? <>Visit the <Link href="/privacy/billing" className="text-primary underline">billing page</Link> to upgrade and enable PIA assessments.</>
            : "Contact your account manager or email hello@todo.law to enable PIA assessments for your organization."}
        </InfoCallout>
      </DocSection>

      <DocSection id="tia" title="TIA — Transfer Impact Assessment" description="Evaluate the risks of international data transfers following the Schrems II ruling.">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-medium">Schrems II Compliance</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">TIA evaluates:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              <li>The legal framework of the recipient country</li>
              <li>Government surveillance and access laws</li>
              <li>Whether supplementary measures are needed beyond SCCs/BCRs</li>
              <li>Technical measures (encryption, pseudonymization) in place</li>
              <li>Organizational measures (access controls, audit rights)</li>
              <li>Contractual measures (enhanced clauses, warranties)</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Common transfer safeguards</p>
            <div className="flex flex-wrap gap-2">
              {["Standard Contractual Clauses (SCCs)", "Binding Corporate Rules (BCRs)", "Adequacy Decisions", "Consent (specific)", "Encryption in transit & at rest"].map((s) => (
                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
        <InfoCallout type="info" title="Enable TIA">
          {features.selfServiceUpgrade
            ? <>Visit the <Link href="/privacy/billing" className="text-primary underline">billing page</Link> to upgrade and enable TIA assessments.</>
            : "Contact your account manager or email hello@todo.law to enable TIA assessments for your organization."}
        </InfoCallout>
      </DocSection>

      <DocSection id="vendor-risk" title="Vendor Risk Assessment" description="A specialized assessment template designed for evaluating vendor-specific privacy and security risks.">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-medium">Vendor-Specific Assessment</span>
            <PremiumBadge />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Assessment covers:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
              <li>Data processing scope and categories</li>
              <li>Security controls and certifications (ISO 27001, SOC 2)</li>
              <li>Sub-processor management</li>
              <li>Incident response and breach notification capabilities</li>
              <li>Data retention and deletion practices</li>
              <li>Cross-border transfer mechanisms</li>
            </ul>
          </div>
        </div>
        <InfoCallout type="tip" title="Combine with questionnaires">
          Use Vendor Risk Assessments alongside vendor questionnaires for a complete picture.
          The assessment provides the formal risk evaluation, while questionnaires gather detailed evidence from the vendor.
        </InfoCallout>
        <InfoCallout type="info" title="Enable Vendor Risk Assessment">
          {features.selfServiceUpgrade
            ? <>Visit the <Link href="/privacy/billing" className="text-primary underline">billing page</Link> to upgrade and enable vendor risk assessments.</>
            : "Contact your account manager or email hello@todo.law to enable vendor risk assessments."}
        </InfoCallout>
      </DocSection>

      <DocSection id="vendor-catalog" title="Vendor Catalog" description="Search and import from a database of 400+ pre-audited MarTech, AI, and SaaS vendors.">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <span className="font-medium">Pre-Audited Vendor Database</span>
            <PremiumBadge />
          </div>

          <Card className="border-primary/50 bg-primary/5 hover:translate-y-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Vendor Catalog</p>
                  <p className="text-xs text-muted-foreground">Search 400+ pre-audited vendors with compliance data</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "Pre-populated vendor profiles",
                  "Compliance certifications",
                  "Data processing details",
                  "Sub-processor lists",
                  "DPA templates",
                  "One-click import to your inventory",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <InfoCallout type="info" title="Enable Vendor Catalog">
          {features.selfServiceUpgrade
            ? <>Visit the <Link href="/privacy/billing" className="text-primary underline">billing page</Link> to upgrade and enable the Vendor Catalog.</>
            : "Contact your account manager or email hello@todo.law to enable the Vendor Catalog for your organization."}
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Vendor Management", href: "/privacy/docs/vendors" }}
      />
    </div>
  );
}

import { ClipboardCheck, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { PremiumBadge } from "@/components/docs/premium-badge";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const typeConfig: Record<string, { label: string; premium: boolean; color: string }> = {
  LIA: { label: "Legitimate Interest", premium: false, color: "bg-green-100 text-green-800 border-transparent" },
  CUSTOM: { label: "Custom", premium: false, color: "bg-gray-100 text-gray-800 border-transparent" },
  DPIA: { label: "Data Protection Impact", premium: true, color: "bg-purple-100 text-purple-800 border-transparent" },
  PIA: { label: "Privacy Impact", premium: true, color: "bg-indigo-100 text-indigo-800 border-transparent" },
  TIA: { label: "Transfer Impact", premium: true, color: "bg-blue-100 text-blue-800 border-transparent" },
  VENDOR: { label: "Vendor Risk", premium: true, color: "bg-orange-100 text-orange-800 border-transparent" },
};

const riskConfig: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  HIGH: "bg-orange-100 text-orange-800 border-transparent",
  CRITICAL: "bg-red-100 text-red-800 border-transparent",
};

export default function DocsAssessmentsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assessments</h1>
        <p className="text-muted-foreground mt-1">
          Assessments help you evaluate privacy risks before launching new projects, processing activities,
          or vendor relationships. DPO Central supports multiple assessment types with template-driven workflows.
        </p>
      </div>

      <DocSection id="templates" title="Assessment Templates" description="Choose from built-in templates or create custom ones. Templates define the questions, scoring criteria, and approval workflow.">
        <FeatureMockup title="Assessment Type Cards">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(typeConfig).map(([key, config]) => (
              <Card key={key} className="hover:translate-y-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>{key}</Badge>
                    {config.premium && <PremiumBadge />}
                  </div>
                  <p className="text-sm font-medium">{config.label} Assessment</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {key === "LIA" && "Evaluate legitimate interest balancing tests"}
                    {key === "CUSTOM" && "Build your own assessment from scratch"}
                    {key === "DPIA" && "GDPR Article 35 data protection impact"}
                    {key === "PIA" && "Broader privacy impact analysis"}
                    {key === "TIA" && "Schrems II transfer impact analysis"}
                    {key === "VENDOR" && "Third-party vendor risk evaluation"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="info" title="Free vs. Premium Assessment Types">
          <strong>Free (Core):</strong> LIA and Custom assessments are available to all users.{" "}
          <strong>Premium:</strong> DPIA, PIA, TIA, and Vendor Risk assessments require a premium license.
          See the <a href="/privacy/docs/premium" className="text-primary underline">Premium Features</a> page for details.
        </InfoCallout>
      </DocSection>

      <DocSection id="creating" title="Creating Assessments" description="Walk through the assessment creation workflow.">
        <StepList
          steps={[
            { title: "Select a template", description: "Choose the assessment type that matches your need (LIA, DPIA, PIA, TIA, Vendor, or Custom)." },
            { title: "Fill in project details", description: "Provide the assessment name, description, related processing activities, and data assets." },
            { title: "Answer assessment questions", description: "Work through the template questions. Each section covers a different risk domain." },
            { title: "Score risks", description: "Rate the likelihood and impact of identified risks. The system calculates the overall risk level." },
            { title: "Add mitigations", description: "For each identified risk, document mitigation measures and residual risk." },
            { title: "Submit for review", description: "Move the assessment to PENDING_REVIEW status for approval by a Privacy Officer or Admin." },
          ]}
        />
      </DocSection>

      <DocSection id="risk-scoring" title="Risk Scoring" description="Each assessment generates a risk score based on the answers provided. Risk levels are calculated automatically.">
        <FeatureMockup title="Risk Level Badges">
          <div className="flex flex-wrap gap-3">
            {Object.entries(riskConfig).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2">
                <Badge variant="outline" className={`${color}`}>{level}</Badge>
                <span className="text-xs text-muted-foreground">
                  {level === "LOW" && "Acceptable risk, proceed"}
                  {level === "MEDIUM" && "Mitigations recommended"}
                  {level === "HIGH" && "Mitigations required"}
                  {level === "CRITICAL" && "Cannot proceed without resolution"}
                </span>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="mitigations" title="Mitigations" description="Document risk mitigation measures for each identified risk.">
        <InfoCallout type="tip" title="Mitigation best practices">
          Link mitigations to specific risks and track their implementation status. Each mitigation should include:
          the measure being taken, the responsible person, the target completion date, and the expected residual risk level after implementation.
        </InfoCallout>
      </DocSection>

      <DocSection id="approvals" title="Approval Workflow" description="Assessments follow a structured approval workflow before they are finalized.">
        <FeatureMockup title="Assessment Status Flow">
          <div className="flex items-center justify-center gap-2 flex-wrap py-2">
            {["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "APPROVED"].map((status, i) => (
              <div key={status} className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    status === "APPROVED"
                      ? "bg-primary text-primary-foreground border-transparent"
                      : status === "IN_PROGRESS"
                        ? "bg-primary/20 text-primary border-transparent"
                        : ""
                  }`}
                >
                  {status.replace("_", " ")}
                </Badge>
                {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="note" title="Rejection">
          If an assessment is rejected, it returns to DRAFT status with reviewer comments.
          The assessor can address the feedback and resubmit for review.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "DSAR Management", href: "/privacy/docs/dsar" }}
        next={{ title: "Incidents", href: "/privacy/docs/incidents" }}
      />
    </div>
  );
}

import { Sparkles, Bot, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const confidenceColors: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  LOW: "bg-orange-100 text-orange-800 border-transparent",
};

const autoFillRows = [
  { section: "Processing Description", question: "Describe the processing operation", source: "Activity purpose & description", confidence: "HIGH" },
  { section: "Legal Basis", question: "What is the legal basis?", source: "activity.legalBasis", confidence: "HIGH" },
  { section: "Data Categories", question: "What categories of data are processed?", source: "Linked data elements", confidence: "HIGH" },
  { section: "Special Categories", question: "Does processing involve special categories?", source: "isSpecialCategory elements", confidence: "HIGH" },
  { section: "Data Subjects", question: "Who are the data subjects?", source: "activity.dataSubjects", confidence: "HIGH" },
  { section: "Retention Period", question: "How long is data retained?", source: "Activity retention policy", confidence: "HIGH" },
  { section: "Security Measures", question: "What security measures are in place?", source: "Vendor certifications", confidence: "MEDIUM" },
  { section: "International Transfers", question: "Are there cross-border transfers?", source: "DataTransfer records", confidence: "MEDIUM" },
  { section: "Risk Assessment", question: "What are the identified risks?", source: "Multi-factor analysis", confidence: "MEDIUM" },
];

export default function DocsDpiaAutoFillPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DPIA Auto-Fill Wizard</h1>
        <p className="text-muted-foreground mt-1">
          Accelerate your Data Protection Impact Assessments by leveraging your existing data inventory.
          The Auto-Fill Wizard pre-populates DPIA responses so you can focus on analysis, not data entry.
        </p>
      </div>

      <DocSection id="overview" title="How It Works" description="The DPIA Auto-Fill Wizard cross-references your data inventory to pre-populate assessment responses, turning hours of manual work into minutes.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Rule-Based Auto-Fill</p>
              <p className="text-xs text-muted-foreground">
                Maps your processing activities, data elements, and transfer records directly to DPIA questions.
                Every answer is traceable back to your data inventory.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Optional AI Narrative</p>
              <p className="text-xs text-muted-foreground">
                When an LLM API key is configured, the wizard can generate natural-language risk narratives
                and mitigation suggestions based on your data context.
              </p>
            </div>
          </div>
        </div>
      </DocSection>

      <DocSection id="wizard-steps" title="Wizard Steps">
        <StepList
          steps={[
            { title: "Select Processing Activity", description: "Choose the processing activity you want to assess. Optionally link a vendor to include their data processing context." },
            { title: "Preview Data Context", description: "Review the aggregated context: linked assets, data element counts, active transfers, and associated vendors. This is the data the wizard will draw from." },
            { title: "Review & Edit Responses", description: "Walk through the auto-filled responses section by section. Each answer shows a confidence badge so you know what to double-check. Edit any response before proceeding." },
            { title: "Create Assessment", description: "Finalize and create a draft DPIA or LIA with all pre-filled responses. The assessment enters DRAFT status, ready for further editing or submission for review." },
          ]}
        />
      </DocSection>

      <DocSection id="auto-fill-sources" title="What Gets Auto-Filled" description="The wizard maps your data inventory to specific DPIA sections. Here is what gets populated and where the data comes from.">
        <FeatureMockup title="Auto-Fill Mapping Table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Section</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Question</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Source Data</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {autoFillRows.map((row) => (
                  <tr key={row.section} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-xs font-medium">{row.section}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{row.question}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{row.source}</td>
                    <td className="py-2">
                      <Badge variant="outline" className={`text-[10px] ${confidenceColors[row.confidence]}`}>
                        {row.confidence}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="confidence-levels" title="Confidence Levels" description="Each auto-filled response includes a confidence indicator so you know how much review it needs.">
        <div className="space-y-3">
          {[
            { level: "HIGH", color: confidenceColors.HIGH, description: "Directly sourced from your data inventory. These values are pulled verbatim from your processing activities, data elements, or transfer records." },
            { level: "MEDIUM", color: confidenceColors.MEDIUM, description: "Inferred from related context. For example, security measures derived from vendor certifications, or transfer risks based on destination country." },
            { level: "LOW", color: confidenceColors.LOW, description: "Template-based suggestions that provide a starting point. These are generic recommendations that should be customized to your specific context." },
          ].map((item) => (
            <div key={item.level} className="flex items-start gap-3">
              <Badge variant="outline" className={`text-[10px] mt-0.5 shrink-0 ${item.color}`}>
                {item.level}
              </Badge>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        <InfoCallout type="tip" title="Review medium and low confidence responses">
          Always review MEDIUM and LOW confidence responses before submitting your assessment. These responses
          may need adjustment to accurately reflect your specific processing context and organizational measures.
        </InfoCallout>
      </DocSection>

      <DocSection id="ai-integration" title="Optional AI Enhancement" description="Enhance auto-filled responses with AI-generated narratives and risk analysis.">
        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Supported Providers</p>
              <p className="text-xs text-muted-foreground">
                Set <code className="rounded bg-muted px-1 py-0.5 text-[11px]">OPENAI_API_KEY</code> or{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">ANTHROPIC_API_KEY</code> in your
                environment variables to enable AI-generated risk narratives, mitigation suggestions, and
                plain-language summaries.
              </p>
            </div>
          </div>
        </div>
        <InfoCallout type="info" title="Graceful fallback">
          When no API key is configured, the wizard operates entirely with rule-based auto-fill. All core
          functionality works without AI — the AI layer is purely additive for generating narrative text.
        </InfoCallout>
        <InfoCallout type="note" title="Data stays under your control">
          No data leaves your environment unless you explicitly configure an API key. When AI is enabled,
          only the minimal context needed for the specific question is sent to the provider. No data inventory
          is shared in bulk.
        </InfoCallout>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Compliance Reports", href: "/privacy/docs/reports" }}
        next={{ title: "Transfer Compliance", href: "/privacy/docs/transfer-compliance" }}
      />
    </div>
  );
}

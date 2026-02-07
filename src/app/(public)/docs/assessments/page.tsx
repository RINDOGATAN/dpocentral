import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export default function AssessmentsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">
          Assessments
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Conduct privacy impact assessments using configurable templates.
          Score risks, document mitigations, and manage approval workflows
          for DPIAs, PIAs, LIAs, TIAs, and vendor risk assessments.
        </p>
      </div>

      {/* Assessment Types */}
      <section id="templates" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Assessment Templates
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choose from built-in templates or create custom assessments. Each
          template includes pre-configured questions, risk criteria, and
          approval workflows.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              type: "LIA",
              name: "Legitimate Interests Assessment",
              desc: "Evaluate whether legitimate interests can be relied upon as a legal basis",
              tier: "Core",
            },
            {
              type: "CUSTOM",
              name: "Custom Assessment",
              desc: "Create your own assessment template with custom questions and criteria",
              tier: "Core",
            },
            {
              type: "DPIA",
              name: "Data Protection Impact Assessment",
              desc: "Required under GDPR Article 35 for high-risk processing activities",
              tier: "Premium",
            },
            {
              type: "PIA",
              name: "Privacy Impact Assessment",
              desc: "Broader privacy analysis for new projects and systems",
              tier: "Premium",
            },
            {
              type: "TIA",
              name: "Transfer Impact Assessment",
              desc: "Evaluate safeguards for international data transfers (Schrems II)",
              tier: "Premium",
            },
            {
              type: "VENDOR",
              name: "Vendor Risk Assessment",
              desc: "Assess privacy risks of third-party vendors and processors",
              tier: "Premium",
            },
          ].map((tmpl) => (
            <div
              key={tmpl.type}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  {tmpl.type}
                </span>
                {tmpl.tier === "Premium" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Premium
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground">
                {tmpl.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tmpl.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Approval Workflow */}
      <section id="approvals" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Approval Workflow
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Assessments move through a structured approval workflow. Each stage
          has clear ownership and the system tracks who approved what and when.
        </p>

        <div className="card-brutal">
          <FlowDiagram
            steps={[
              { label: "Draft", description: "Author creates assessment" },
              { label: "In Progress", description: "Completing questions" },
              { label: "Pending Review", description: "Submitted for approval" },
              { label: "Approved", description: "Assessment signed off" },
            ]}
          />
        </div>
      </section>

      {/* Risk Scoring */}
      <section id="risk-scoring" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Risk Scoring
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Each assessment calculates an overall risk level based on the
          likelihood and impact of identified risks. The system supports four
          risk levels.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { level: "LOW", color: "bg-green-500/10 text-green-400 border-green-500/20" },
            { level: "MEDIUM", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
            { level: "HIGH", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            { level: "CRITICAL", color: "bg-red-500/10 text-red-400 border-red-500/20" },
          ].map((r) => (
            <div
              key={r.level}
              className={`p-3 rounded-lg border text-center ${r.color}`}
            >
              <p className="text-sm font-semibold">{r.level}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Risk scores are calculated from individual question responses and can
          be overridden by the assessor with justification. The overall risk
          level drives review requirements and mitigation priorities.
        </p>
      </section>

      {/* Mitigations */}
      <section id="mitigations" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Risk Mitigations
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Document mitigation measures for each identified risk. Track
          implementation status and assign ownership for follow-up actions.
        </p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Example Mitigations
          </p>
          <div className="space-y-2">
            {[
              { mitigation: "Implement data encryption at rest and in transit", status: "Implemented" },
              { mitigation: "Add access controls and audit logging", status: "Implemented" },
              { mitigation: "Conduct annual vendor security review", status: "Planned" },
              { mitigation: "Deploy data loss prevention (DLP) tools", status: "In Progress" },
            ].map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50"
              >
                <span className="text-sm text-foreground">{m.mitigation}</span>
                <span
                  className={`text-xs shrink-0 ml-3 px-2 py-0.5 rounded-full ${
                    m.status === "Implemented"
                      ? "bg-green-500/10 text-green-400"
                      : m.status === "In Progress"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Creating an Assessment */}
      <section id="creating" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Creating an Assessment
        </h2>
        <WorkflowStep
          number={1}
          title="Select Template"
          description="Choose an assessment template (LIA, DPIA, PIA, TIA, Vendor, or Custom) from the Assessments module."
          actor="DPO"
        />
        <WorkflowStep
          number={2}
          title="Set Scope and Context"
          description="Define the assessment scope, processing activity being evaluated, and relevant data assets."
          actor="DPO"
          details={[
            "Link to specific processing activities from your data inventory",
            "Identify the data elements and data subjects involved",
          ]}
        />
        <WorkflowStep
          number={3}
          title="Complete Questions"
          description="Answer each question in the template. The system calculates risk scores as you progress."
          actor="DPO"
        />
        <WorkflowStep
          number={4}
          title="Document Mitigations"
          description="For each identified risk, document mitigation measures, assign owners, and set deadlines."
          actor="DPO"
        />
        <WorkflowStep
          number={5}
          title="Submit for Review"
          description="Submit the completed assessment for approval. Reviewers can approve, reject, or request changes."
          actor="DPO"
        />
        <WorkflowStep
          number={6}
          title="Final Approval"
          description="Once approved, the assessment is locked and stored as a compliance record."
          actor="Approver"
        />
      </section>
    </div>
  );
}

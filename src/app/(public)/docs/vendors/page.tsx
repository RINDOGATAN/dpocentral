import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export default function VendorsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">
          Vendor Management
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Maintain a complete register of third-party vendors and processors.
          Track contracts, send privacy questionnaires, monitor risk tiers,
          and ensure your supply chain meets your privacy standards.
        </p>
      </div>

      {/* Vendor Register */}
      <section id="adding" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Vendor Register
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your vendor register is the central record of all third parties that
          process personal data on your behalf. Each vendor entry captures
          contact details, processing purposes, contract status, and risk tier.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {[
            {
              status: "ACTIVE",
              color: "bg-green-500/10 text-green-400 border-green-500/20",
              desc: "Vendor is approved and actively processing data",
            },
            {
              status: "UNDER_REVIEW",
              color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              desc: "Vendor is being evaluated or re-assessed",
            },
            {
              status: "SUSPENDED",
              color: "bg-red-500/10 text-red-400 border-red-500/20",
              desc: "Processing suspended pending issue resolution",
            },
            {
              status: "OFFBOARDED",
              color: "bg-muted text-muted-foreground border-border",
              desc: "Vendor relationship terminated, data return/deletion confirmed",
            },
          ].map((s) => (
            <div
              key={s.status}
              className={`p-4 rounded-lg border ${s.color}`}
            >
              <p className="text-sm font-semibold">{s.status.replace(/_/g, " ")}</p>
              <p className="text-xs mt-1 opacity-80">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Risk Tiers */}
      <section id="risk-tiers" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Risk Tiers
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Vendors are classified into risk tiers based on the volume and
          sensitivity of data they process, their security posture, and
          geographic considerations.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { tier: "LOW", color: "bg-green-500/10 text-green-400 border-green-500/20" },
            { tier: "MEDIUM", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
            { tier: "HIGH", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            { tier: "CRITICAL", color: "bg-red-500/10 text-red-400 border-red-500/20" },
          ].map((t) => (
            <div
              key={t.tier}
              className={`p-3 rounded-lg border text-center ${t.color}`}
            >
              <p className="text-sm font-semibold">{t.tier}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Higher-risk vendors require more frequent reviews, stronger
          contractual safeguards, and may trigger a vendor risk assessment.
        </p>
      </section>

      {/* Vendor Dashboard */}
      <section id="dashboard" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Vendor Dashboard
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Get an overview of your vendor landscape at a glance.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Vendors", value: "24", color: "text-foreground" },
            { label: "Active", value: "18", color: "text-green-400" },
            { label: "High Risk", value: "3", color: "text-orange-400" },
            { label: "Pending Review", value: "5", color: "text-amber-400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-lg border border-border bg-card text-center"
            >
              <p className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contracts */}
      <section id="contracts" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Contract Management
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Track Data Processing Agreements (DPAs), Standard Contractual Clauses
          (SCCs), and other contractual documents for each vendor. Set renewal
          reminders and monitor expiration dates.
        </p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Key Contract Documents
          </p>
          <div className="space-y-2">
            {[
              { doc: "Data Processing Agreement (DPA)", purpose: "Defines processing terms under GDPR Article 28" },
              { doc: "Standard Contractual Clauses (SCCs)", purpose: "Safeguards for international data transfers" },
              { doc: "Sub-processor Agreement", purpose: "Terms for the vendor's own sub-processors" },
              { doc: "Security Addendum", purpose: "Technical and organizational measures" },
            ].map((c, i) => (
              <div
                key={i}
                className="flex items-start justify-between p-2 rounded-lg bg-background/50 border border-border/50 gap-3"
              >
                <span className="text-sm font-medium text-foreground">
                  {c.doc}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 text-right">
                  {c.purpose}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Questionnaires */}
      <section id="questionnaires" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Privacy Questionnaires
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Send privacy and security questionnaires to vendors to assess their
          data protection practices. Track responses and flag areas of concern
          for follow-up.
        </p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Questionnaire Topics
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              "Data processing scope",
              "Security measures",
              "Incident response",
              "Sub-processor management",
              "Data retention policies",
              "Cross-border transfers",
              "Employee training",
              "Certification & audits",
            ].map((topic) => (
              <div
                key={topic}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <span className="text-primary text-xs">&#9679;</span>
                {topic}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor Review Workflow */}
      <section id="risk-reviews" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Vendor Review Process
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          The vendor review lifecycle from onboarding to ongoing monitoring.
        </p>

        <div className="card-brutal mb-8">
          <FlowDiagram
            steps={[
              { label: "Onboarding", description: "Initial assessment" },
              { label: "Questionnaire", description: "Privacy review" },
              { label: "Contract", description: "DPA execution" },
              { label: "Approved", description: "Active vendor" },
              { label: "Periodic Review", description: "Annual reassessment" },
            ]}
          />
        </div>
      </section>

      {/* Adding a Vendor */}
      <section id="how-to" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Adding and Reviewing a Vendor
        </h2>
        <WorkflowStep
          number={1}
          title="Add Vendor to Register"
          description="Navigate to the Vendor Management module and click 'Add Vendor'. Enter the vendor name, contact details, and processing purpose."
          actor="DPO"
        />
        <WorkflowStep
          number={2}
          title="Send Questionnaire"
          description="Select a privacy questionnaire template and send it to the vendor contact. The system tracks response status and deadlines."
          actor="DPO"
        />
        <WorkflowStep
          number={3}
          title="Review Responses"
          description="Evaluate the vendor's questionnaire responses. Flag any areas of concern and assign a preliminary risk tier."
          actor="Privacy Officer"
          details={[
            "Check security certifications (ISO 27001, SOC 2, etc.)",
            "Review sub-processor arrangements",
            "Evaluate data transfer mechanisms",
          ]}
        />
        <WorkflowStep
          number={4}
          title="Execute Contracts"
          description="Upload and track the Data Processing Agreement (DPA) and any additional contractual documents."
          actor="Legal"
        />
        <WorkflowStep
          number={5}
          title="Approve and Monitor"
          description="Approve the vendor for active use. Set up periodic review reminders based on the vendor's risk tier."
          actor="DPO"
        />
      </section>
    </div>
  );
}

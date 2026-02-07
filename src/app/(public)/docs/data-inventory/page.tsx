import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export default function DataInventoryPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">
          Data Inventory
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Map your organization&apos;s data landscape. Track every asset, data
          element, processing activity, and cross-border transfer to maintain a
          complete Record of Processing Activities (ROPA).
        </p>
      </div>

      {/* Data Assets */}
      <section id="assets" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Data Assets
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Data assets represent the systems, applications, and databases that
          store or process personal data. Each asset records its type, owner,
          associated data elements, and processing activities.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {[
            {
              type: "DATABASE",
              example: "Customer Database",
              desc: "Relational or NoSQL databases storing personal data",
            },
            {
              type: "APPLICATION",
              example: "CRM System",
              desc: "Software applications that process user data",
            },
            {
              type: "FILE_SYSTEM",
              example: "HR File Share",
              desc: "File storage systems containing personal records",
            },
            {
              type: "CLOUD_SERVICE",
              example: "Analytics Platform",
              desc: "Third-party SaaS tools processing personal data",
            },
            {
              type: "API",
              example: "Payment Gateway",
              desc: "API integrations transferring personal data",
            },
            {
              type: "PHYSICAL",
              example: "Paper Records Archive",
              desc: "Physical storage of personal data documents",
            },
          ].map((asset) => (
            <div
              key={asset.type}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                  {asset.type.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground mt-2">
                {asset.example}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {asset.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Data Elements */}
      <section id="data-elements" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Data Elements
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Data elements describe the specific categories of personal data your
          organization processes. Each element has a sensitivity classification
          ranging from Public to Special Category.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { level: "PUBLIC", color: "bg-green-500/10 text-green-400 border-green-500/20" },
            { level: "INTERNAL", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            { level: "CONFIDENTIAL", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
            { level: "RESTRICTED", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            { level: "SPECIAL_CATEGORY", color: "bg-red-500/10 text-red-400 border-red-500/20" },
          ].map((s) => (
            <span
              key={s.level}
              className={`text-xs px-3 py-1 rounded-full border ${s.color}`}
            >
              {s.level.replace("_", " ")}
            </span>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Examples include full name, email address, IP address, health records,
          biometric data, and financial information. Link elements to assets to
          understand exactly where each type of personal data resides.
        </p>
      </section>

      {/* Processing Activities */}
      <section id="processing-activities" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Processing Activities
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Document every processing activity with its legal basis, purpose,
          data categories, and retention period. This forms the core of your
          ROPA.
        </p>

        <div className="card-brutal mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Legal Bases
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "CONSENT",
              "CONTRACT",
              "LEGAL_OBLIGATION",
              "VITAL_INTERESTS",
              "PUBLIC_TASK",
              "LEGITIMATE_INTERESTS",
            ].map((basis) => (
              <span
                key={basis}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
              >
                {basis.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Each activity records the controller, processor, categories of data
          subjects, and whether automated decision-making is involved. Activities
          link to data assets and elements for full traceability.
        </p>
      </section>

      {/* Data Flows */}
      <section id="data-flows" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Data Flows
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Visualize how personal data moves through your organization using the
          interactive data flow diagram. Map source-to-destination transfers
          between assets, departments, and third parties.
        </p>

        <div className="card-brutal">
          <FlowDiagram
            steps={[
              { label: "Collection", description: "User submits data via web form" },
              { label: "Processing", description: "CRM system stores and indexes" },
              { label: "Analytics", description: "Data warehouse for reporting" },
              { label: "Archival", description: "Long-term encrypted storage" },
            ]}
          />
        </div>
      </section>

      {/* Cross-Border Transfers */}
      <section id="transfers" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Cross-Border Transfers
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Track international data transfers with their legal mechanisms.
          Document Standard Contractual Clauses (SCCs), adequacy decisions,
          Binding Corporate Rules (BCRs), and other safeguards.
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { mechanism: "Adequacy Decision", desc: "EU-approved country-level adequacy" },
            { mechanism: "Standard Contractual Clauses", desc: "EU-approved contractual safeguards" },
            { mechanism: "Binding Corporate Rules", desc: "Intra-group transfer framework" },
          ].map((t) => (
            <div
              key={t.mechanism}
              className="p-3 rounded-lg border border-border bg-card"
            >
              <p className="text-sm font-medium text-foreground">
                {t.mechanism}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to Add a Data Asset */}
      <section id="how-to" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          How to Add a Data Asset
        </h2>
        <WorkflowStep
          number={1}
          title="Navigate to Data Inventory"
          description="Open the Data Inventory module from the main navigation."
          actor="DPO"
        />
        <WorkflowStep
          number={2}
          title="Click Add Asset"
          description="Click the 'Add Asset' button in the top right corner of the assets list."
          actor="DPO"
        />
        <WorkflowStep
          number={3}
          title="Fill in Asset Details"
          description="Enter the asset name, type, owner, description, and associated data elements."
          actor="DPO"
          details={[
            "Select the asset type (Database, Application, Cloud Service, etc.)",
            "Assign a data owner from your organization members",
            "Link relevant data elements to this asset",
          ]}
        />
        <WorkflowStep
          number={4}
          title="Link Processing Activities"
          description="Associate the asset with its processing activities and legal bases."
          actor="DPO"
        />
        <WorkflowStep
          number={5}
          title="Review and Save"
          description="Review all details and save. The asset will appear in your data inventory and data flow diagram."
          actor="DPO"
        />
      </section>
    </div>
  );
}

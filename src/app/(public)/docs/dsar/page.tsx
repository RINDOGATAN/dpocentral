import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export default function DSARPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">
          DSAR Management
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Handle data subject access requests from submission to completion.
          Track SLA deadlines, assign tasks to your team, and provide a public
          portal for data subjects to submit requests.
        </p>
      </div>

      {/* Request Lifecycle */}
      <section id="lifecycle" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Request Lifecycle
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Every DSAR moves through a defined lifecycle with automatic SLA
          tracking. The system monitors deadlines and alerts your team when
          action is needed.
        </p>

        <div className="card-brutal">
          <FlowDiagram
            steps={[
              { label: "Submitted", description: "Request received" },
              { label: "Identity Check", description: "Verify data subject" },
              { label: "In Progress", description: "Processing request" },
              { label: "Review", description: "QA before delivery" },
              { label: "Completed", description: "Response delivered" },
            ]}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { status: "SUBMITTED", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
            { status: "IDENTITY_PENDING", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
            { status: "IN_PROGRESS", color: "bg-primary/10 text-primary border-primary/20" },
            { status: "ON_HOLD", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
            { status: "COMPLETED", color: "bg-green-500/10 text-green-400 border-green-500/20" },
            { status: "REJECTED", color: "bg-red-500/10 text-red-400 border-red-500/20" },
          ].map((s) => (
            <span
              key={s.status}
              className={`text-xs px-3 py-1 rounded-full border ${s.color}`}
            >
              {s.status.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </section>

      {/* Request Types */}
      <section id="request-types" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Request Types
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          DPO Central supports all GDPR data subject rights as request types.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              type: "ACCESS",
              desc: "Right to access personal data held by the organization (Art. 15)",
            },
            {
              type: "ERASURE",
              desc: "Right to be forgotten - deletion of personal data (Art. 17)",
            },
            {
              type: "RECTIFICATION",
              desc: "Right to correct inaccurate personal data (Art. 16)",
            },
            {
              type: "PORTABILITY",
              desc: "Right to receive data in a machine-readable format (Art. 20)",
            },
            {
              type: "OBJECTION",
              desc: "Right to object to processing of personal data (Art. 21)",
            },
            {
              type: "RESTRICTION",
              desc: "Right to restrict processing of personal data (Art. 18)",
            },
          ].map((rt) => (
            <div
              key={rt.type}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                {rt.type}
              </span>
              <p className="text-xs text-muted-foreground mt-2">{rt.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Task Management */}
      <section id="tasks" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Task Management
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Break down each DSAR into actionable tasks and assign them to team
          members. Track progress, add notes, and ensure nothing falls through
          the cracks.
        </p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Example Tasks for an Access Request
          </p>
          <div className="space-y-2">
            {[
              { task: "Verify identity of data subject", assignee: "Privacy Officer" },
              { task: "Search CRM for subject records", assignee: "IT Team" },
              { task: "Search email archives", assignee: "IT Team" },
              { task: "Compile and review data package", assignee: "Privacy Officer" },
              { task: "Redact third-party data", assignee: "Legal" },
              { task: "Deliver response to data subject", assignee: "Privacy Officer" },
            ].map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50"
              >
                <span className="text-sm text-foreground">{t.task}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">
                  {t.assignee}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SLA Tracking */}
      <section id="sla" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          SLA Tracking
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          The system automatically calculates SLA deadlines based on the request
          type and your configured response periods. Visual indicators show
          remaining time and alert you when deadlines approach.
        </p>

        <div className="card-brutal">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">30</p>
              <p className="text-xs text-muted-foreground">days standard</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">60</p>
              <p className="text-xs text-muted-foreground">days extended</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">72h</p>
              <p className="text-xs text-muted-foreground">breach notification</p>
            </div>
          </div>
        </div>
      </section>

      {/* Public Portal */}
      <section id="portal" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Public Portal
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Give data subjects a dedicated portal to submit requests. The portal
          is customizable with your organization&apos;s branding and generates a
          shareable link you can add to your privacy policy.
        </p>

        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs text-primary font-medium mb-2">Portal URL</p>
          <code className="text-sm text-muted-foreground">
            https://dpocentral.todo.law/dsar/your-org-slug
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Share this URL in your privacy policy so data subjects can submit
            requests directly. The portal supports all request types and collects
            identity verification information.
          </p>
        </div>
      </section>

      {/* Intake Configuration */}
      <section id="intake-config" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Intake Form Configuration
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Customize which fields appear on your public DSAR intake form.
          Configure required vs. optional fields, add custom questions, and set
          automatic routing rules based on request type.
        </p>
      </section>

      {/* Processing Workflow */}
      <section id="workflow" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Processing a DSAR Request
        </h2>
        <WorkflowStep
          number={1}
          title="Receive Request"
          description="A data subject submits a request through the public portal or you create one manually in the dashboard."
          actor="System"
        />
        <WorkflowStep
          number={2}
          title="Verify Identity"
          description="Confirm the identity of the data subject. Update the request status to reflect the verification outcome."
          actor="Privacy Officer"
          details={[
            "Request additional ID documents if needed",
            "Mark identity as verified or rejected",
          ]}
        />
        <WorkflowStep
          number={3}
          title="Create and Assign Tasks"
          description="Break the request into tasks and assign them to the relevant team members."
          actor="Privacy Officer"
        />
        <WorkflowStep
          number={4}
          title="Collect and Review Data"
          description="Team members search systems, compile data, and upload findings. The privacy officer reviews for completeness."
          actor="Team"
        />
        <WorkflowStep
          number={5}
          title="Deliver Response"
          description="Send the final response to the data subject and mark the request as completed."
          actor="Privacy Officer"
        />
      </section>
    </div>
  );
}

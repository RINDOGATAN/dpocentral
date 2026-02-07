import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

export default function IncidentsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">
          Incident Management
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Track privacy incidents from initial report through resolution.
          Manage response timelines, coordinate DPA notifications, and maintain
          a complete audit trail of every action taken.
        </p>
      </div>

      {/* Incident Lifecycle */}
      <section id="lifecycle" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Incident Lifecycle
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Every incident follows a defined lifecycle. The system tracks status
          transitions and timestamps every change for compliance evidence.
        </p>

        <div className="card-brutal">
          <FlowDiagram
            steps={[
              { label: "Reported", description: "Incident identified" },
              { label: "Investigating", description: "Gathering facts" },
              { label: "Containment", description: "Stopping the impact" },
              { label: "Notification", description: "Alerting authorities" },
              { label: "Resolved", description: "Incident closed" },
            ]}
          />
        </div>
      </section>

      {/* Severity Levels */}
      <section id="severity" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Severity Levels
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Classify incidents by severity to prioritize response efforts and
          determine notification obligations.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              level: "LOW",
              color: "bg-green-500/10 text-green-400 border-green-500/20",
              desc: "Minor incident, no personal data at risk",
            },
            {
              level: "MEDIUM",
              color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              desc: "Limited exposure, contained quickly",
            },
            {
              level: "HIGH",
              color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
              desc: "Significant data exposure, DPA notification likely",
            },
            {
              level: "CRITICAL",
              color: "bg-red-500/10 text-red-400 border-red-500/20",
              desc: "Large-scale breach, immediate DPA notification required",
            },
          ].map((s) => (
            <div
              key={s.level}
              className={`p-3 rounded-lg border ${s.color}`}
            >
              <p className="text-sm font-semibold">{s.level}</p>
              <p className="text-[10px] mt-1 opacity-80">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DPA Notification */}
      <section id="notifications" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          DPA Notification
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Under GDPR Article 33, personal data breaches must be reported to the
          supervisory authority within 72 hours of becoming aware of the breach.
          DPO Central tracks this deadline automatically.
        </p>

        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 font-semibold text-sm">
              72-Hour Rule
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            When a breach is likely to result in a risk to the rights and
            freedoms of individuals, notify the supervisory authority without
            undue delay and, where feasible, not later than 72 hours after
            becoming aware of it. The system tracks this deadline from the
            moment the incident is reported and displays countdown timers on
            your dashboard.
          </p>
        </div>
      </section>

      {/* Incident Stats */}
      <section id="dashboard" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Incident Dashboard
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          The incidents dashboard gives you an at-a-glance view of your
          organization&apos;s incident status.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Incidents", value: "12", color: "text-foreground" },
            { label: "Open", value: "3", color: "text-amber-400" },
            { label: "Critical", value: "1", color: "text-red-400" },
            { label: "Pending DPA", value: "1", color: "text-orange-400" },
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

      {/* Timeline */}
      <section id="timeline" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Incident Timeline
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Every incident maintains a detailed timeline recording all events,
          status changes, communications, and actions. This provides the audit
          trail needed for regulatory compliance.
        </p>

        <div className="card-brutal">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Example Timeline
          </p>
          <div className="space-y-3">
            {[
              { time: "09:15", event: "Incident reported by IT team", type: "CREATED" },
              { time: "09:30", event: "Severity elevated to HIGH", type: "UPDATE" },
              { time: "10:00", event: "Investigation started, containment measures deployed", type: "ACTION" },
              { time: "11:45", event: "Root cause identified: misconfigured access control", type: "UPDATE" },
              { time: "14:00", event: "DPA notification submitted", type: "NOTIFICATION" },
              { time: "16:30", event: "Incident resolved, post-mortem scheduled", type: "RESOLVED" },
            ].map((entry, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-xs text-muted-foreground shrink-0 w-12 pt-0.5">
                  {entry.time}
                </span>
                <div className="flex items-start gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      entry.type === "CREATED"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : entry.type === "NOTIFICATION"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : entry.type === "RESOLVED"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {entry.type}
                  </span>
                  <span className="text-sm text-foreground">{entry.event}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Response Tasks */}
      <section id="tasks" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Response Tasks
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Assign response tasks to team members to coordinate the incident
          response. Track completion and ensure all remediation steps are
          carried out.
        </p>
      </section>

      {/* Reporting Workflow */}
      <section id="reporting" className="scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Reporting an Incident
        </h2>
        <WorkflowStep
          number={1}
          title="Report the Incident"
          description="Navigate to the Incidents module and click 'Report Incident'. Provide initial details: title, description, severity, and affected systems."
          actor="Reporter"
        />
        <WorkflowStep
          number={2}
          title="Triage and Investigate"
          description="The privacy officer reviews the report, assigns a severity level, and begins the investigation."
          actor="Privacy Officer"
          details={[
            "Determine scope: what data was affected and how many subjects",
            "Identify root cause and attack vector if applicable",
            "Assess whether DPA notification is required",
          ]}
        />
        <WorkflowStep
          number={3}
          title="Contain and Mitigate"
          description="Take immediate action to contain the incident and prevent further data loss."
          actor="IT Team"
        />
        <WorkflowStep
          number={4}
          title="Notify Authorities"
          description="If required, submit DPA notification within 72 hours. Notify affected data subjects if the breach poses a high risk to their rights."
          actor="DPO"
        />
        <WorkflowStep
          number={5}
          title="Resolve and Document"
          description="Once the incident is fully resolved, document lessons learned, update policies, and close the incident record."
          actor="Privacy Officer"
        />
      </section>
    </div>
  );
}

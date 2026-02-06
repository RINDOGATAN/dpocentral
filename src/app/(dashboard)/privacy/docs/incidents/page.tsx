import { AlertTriangle, Clock, Bell, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const severityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-transparent",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-transparent",
  HIGH: "bg-orange-100 text-orange-800 border-transparent",
  CRITICAL: "bg-red-100 text-red-800 border-transparent",
};

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-transparent",
  INVESTIGATING: "bg-yellow-100 text-yellow-800 border-transparent",
  CONTAINED: "bg-orange-100 text-orange-800 border-transparent",
  RESOLVED: "bg-green-100 text-green-800 border-transparent",
  CLOSED: "bg-gray-100 text-gray-800 border-transparent",
};

export default function DocsIncidentsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Incident Management</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage data breaches and security incidents from detection through resolution.
          The incident module helps you meet regulatory notification requirements and maintain a complete audit trail.
        </p>
      </div>

      <DocSection id="reporting" title="Reporting Incidents" description="Log incidents as soon as they are discovered. The system captures key details and starts tracking timelines automatically.">
        <FeatureMockup title="Incident Stats">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Incidents", value: "7", icon: AlertTriangle },
              { label: "Open", value: "2", icon: Clock },
              { label: "Critical", value: "1", icon: AlertTriangle },
              { label: "Pending DPA", value: "1", icon: Bell },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="hover:translate-y-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                    <CardTitle className="text-xs font-medium">{stat.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </FeatureMockup>

        <FeatureMockup title="Incident Cards">
          <div className="space-y-2">
            {[
              { title: "Unauthorized Email Access", severity: "HIGH", status: "INVESTIGATING", date: "2025-01-15" },
              { title: "Customer Data Export Error", severity: "MEDIUM", status: "CONTAINED", date: "2025-01-10" },
              { title: "Third-party API Data Leak", severity: "CRITICAL", status: "OPEN", date: "2025-01-18" },
              { title: "Lost USB Drive", severity: "LOW", status: "RESOLVED", date: "2024-12-20" },
            ].map((incident) => (
              <div key={incident.title} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{incident.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${severityColors[incident.severity]}`}>
                      {incident.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Reported {incident.date}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${statusColors[incident.status]}`}>
                  {incident.status}
                </Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>

        <StepList
          steps={[
            { title: "Report the incident", description: "Navigate to Incidents and click 'Report Incident'. Provide a title, description, severity, and category." },
            { title: "Assess severity", description: "Classify the severity (LOW, MEDIUM, HIGH, CRITICAL) based on data types affected, number of subjects, and potential harm." },
            { title: "Assign the response team", description: "Add team members to the incident and assign response tasks." },
            { title: "Investigate and contain", description: "Document findings in the timeline. Update status as the incident progresses through INVESTIGATING → CONTAINED." },
            { title: "Notify if required", description: "Determine if DPA notification is needed. If so, use the notification workflow (see below)." },
            { title: "Resolve and close", description: "Document root cause, remediation actions, and lessons learned. Move to RESOLVED → CLOSED." },
          ]}
        />
      </DocSection>

      <DocSection id="timeline" title="Incident Timeline" description="Every incident has a chronological timeline that captures all actions, status changes, and communications.">
        <FeatureMockup title="Timeline View">
          <div className="space-y-3 border-l-2 border-primary/30 ml-4 pl-4">
            {[
              { time: "Jan 18, 09:30", event: "Incident reported", user: "admin@acme.com" },
              { time: "Jan 18, 09:45", event: "Severity set to CRITICAL", user: "admin@acme.com" },
              { time: "Jan 18, 10:00", event: "Investigation started", user: "dpo@acme.com" },
              { time: "Jan 18, 11:30", event: "Root cause identified: API misconfiguration", user: "dpo@acme.com" },
              { time: "Jan 18, 14:00", event: "DPA notification initiated", user: "admin@acme.com" },
            ].map((entry, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                <p className="text-xs text-muted-foreground">{entry.time} — {entry.user}</p>
                <p className="text-sm">{entry.event}</p>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection id="notifications" title="DPA Notifications" description="When an incident involves a personal data breach, you may need to notify the Data Protection Authority.">
        <InfoCallout type="warning" title="72-Hour Notification Requirement">
          Under GDPR Article 33, you must notify your supervisory authority within 72 hours of becoming aware of a personal data breach
          (unless the breach is unlikely to result in a risk to individuals&apos; rights and freedoms). The system tracks
          this deadline from the moment the incident is reported.
        </InfoCallout>
        <InfoCallout type="tip" title="Notification workflow">
          When you flag an incident as requiring DPA notification, the system creates a notification task with the 72-hour deadline,
          pre-fills the notification form with incident details, and tracks the submission status.
        </InfoCallout>
      </DocSection>

      <DocSection id="tasks" title="Response Tasks" description="Break down incident response into assignable tasks with deadlines.">
        <FeatureMockup title="Task List">
          <div className="space-y-2">
            {[
              { task: "Identify affected data subjects", assignee: "DPO", done: true },
              { task: "Contain the data leak", assignee: "IT Security", done: true },
              { task: "Prepare DPA notification", assignee: "DPO", done: false },
              { task: "Notify affected individuals", assignee: "Communications", done: false },
              { task: "Document lessons learned", assignee: "DPO", done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className={`h-4 w-4 ${item.done ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.task}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{item.assignee}</Badge>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Assessments", href: "/privacy/docs/assessments" }}
        next={{ title: "Vendor Management", href: "/privacy/docs/vendors" }}
      />
    </div>
  );
}

import { FileText, Clock, ExternalLink, Settings, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const statusColors: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800 border-transparent",
  IDENTITY_PENDING: "bg-yellow-100 text-yellow-800 border-transparent",
  IN_PROGRESS: "bg-primary/20 text-primary border-transparent",
  COMPLETED: "bg-green-100 text-green-800 border-transparent",
};

export default function DocsDsarPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DSAR Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage Data Subject Access Requests (DSARs) end-to-end — from intake through a public portal
          to task assignment, SLA tracking, and fulfillment.
        </p>
      </div>

      <DocSection id="creating" title="Creating Requests" description="DSARs can be created manually by staff or submitted by data subjects through the public portal.">
        <FeatureMockup title="DSAR List View">
          <div className="space-y-2">
            {[
              { id: "DSAR-2025-0042", type: "ACCESS", status: "IN_PROGRESS", subject: "john.doe@example.com", daysLeft: 12 },
              { id: "DSAR-2025-0041", type: "ERASURE", status: "IDENTITY_PENDING", subject: "jane.smith@example.com", daysLeft: 25 },
              { id: "DSAR-2025-0040", type: "PORTABILITY", status: "SUBMITTED", subject: "bob.wilson@example.com", daysLeft: 28 },
              { id: "DSAR-2025-0039", type: "RECTIFICATION", status: "COMPLETED", subject: "alice.jones@example.com", daysLeft: 0 },
            ].map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{req.id}</span>
                      <Badge variant="outline" className="text-[10px]">{req.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{req.subject}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {req.status !== "COMPLETED" && (
                    <span className="text-xs text-muted-foreground">{req.daysLeft}d left</span>
                  )}
                  <Badge variant="outline" className={`text-[10px] ${statusColors[req.status]}`}>
                    {req.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>

        <div className="space-y-2">
          <p className="text-sm font-medium">Request Types</p>
          <div className="flex flex-wrap gap-2">
            {["ACCESS", "ERASURE", "RECTIFICATION", "PORTABILITY", "OBJECTION", "RESTRICTION"].map((type) => (
              <Badge key={type} variant="outline" className="text-xs">{type}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            These correspond to GDPR Articles 15-22 data subject rights.
          </p>
        </div>
      </DocSection>

      <DocSection id="tasks" title="Task Management" description="Each DSAR can have multiple tasks assigned to different team members.">
        <StepList
          steps={[
            { title: "Verify identity", description: "Confirm the data subject's identity before processing. The system tracks identity verification status." },
            { title: "Assess scope", description: "Determine which data assets and processing activities are relevant to the request." },
            { title: "Assign tasks", description: "Create subtasks for each department or system that holds relevant data. Assign team members with deadlines." },
            { title: "Collect data", description: "Each task assignee gathers and prepares their portion of the response." },
            { title: "Review and respond", description: "Review all collected data, compile the response, and send it to the data subject." },
            { title: "Close the request", description: "Mark the DSAR as completed. The system logs the completion date for compliance records." },
          ]}
        />
      </DocSection>

      <DocSection id="sla" title="SLA Tracking" description="DPO Central automatically tracks SLA deadlines and alerts you before they expire.">
        <FeatureMockup title="SLA Progress Indicators">
          <div className="space-y-4">
            {[
              { id: "DSAR-2025-0042", days: 18, total: 30, status: "On track" },
              { id: "DSAR-2025-0041", days: 24, total: 30, status: "Warning" },
              { id: "DSAR-2025-0038", days: 30, total: 30, status: "Overdue" },
            ].map((sla) => (
              <div key={sla.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{sla.id}</span>
                  <span className={`text-xs ${sla.days >= sla.total ? "text-destructive font-medium" : sla.days > 20 ? "text-yellow-600" : "text-muted-foreground"}`}>
                    {sla.days >= sla.total ? "Overdue" : `${sla.total - sla.days} days remaining`}
                  </span>
                </div>
                <Progress value={(sla.days / sla.total) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </FeatureMockup>
        <InfoCallout type="warning" title="SLA Deadlines">
          Under GDPR, you must respond to DSARs within 30 calendar days (extendable to 90 days for complex requests).
          The system sends email notifications at 7 days, 3 days, and 1 day before the deadline.
        </InfoCallout>
      </DocSection>

      <DocSection id="portal" title="Public Portal" description="The DSAR public portal allows data subjects to submit requests without contacting you directly.">
        <FeatureMockup title="Public Portal Intake">
          <Card className="hover:translate-y-0 max-w-md mx-auto">
            <CardHeader className="p-4">
              <CardTitle className="text-base">Submit a Data Request</CardTitle>
              <CardDescription className="text-xs">
                Exercise your data protection rights
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">john.doe@example.com</div>
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">Access My Data</div>
              <div className="rounded-md border px-3 py-2 h-16 text-sm text-muted-foreground">I would like a copy of all personal data...</div>
              <Button className="w-full" size="sm">Submit Request</Button>
            </CardContent>
          </Card>
        </FeatureMockup>
        <InfoCallout type="tip" title="Shareable link">
          Each organization gets a unique public portal URL (e.g., <code className="text-xs bg-muted px-1 rounded">/dsar/your-org-slug</code>). Share this link on your privacy policy page or website footer.
        </InfoCallout>
      </DocSection>

      <DocSection id="intake-config" title="Intake Form Configuration" description="Customize which fields appear on your public DSAR portal and configure auto-acknowledgment emails.">
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Portal Settings</p>
              <p className="text-xs text-muted-foreground">Configure from Privacy &gt; DSAR &gt; Settings tab</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            {[
              { label: "Auto-acknowledgment", desc: "Send confirmation email on submission" },
              { label: "Identity verification", desc: "Require ID upload before processing" },
              { label: "Request types", desc: "Choose which rights to offer" },
              { label: "Custom fields", desc: "Add organization-specific intake fields" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2 rounded-md border p-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-xs">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Data Inventory", href: "/privacy/docs/data-inventory" }}
        next={{ title: "Assessments", href: "/privacy/docs/assessments" }}
      />
    </div>
  );
}

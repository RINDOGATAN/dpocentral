import {
  Bell,
  Mail,
  MessageSquare,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  ShieldCheck,
  Globe,
  Webhook,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocSection } from "@/components/docs/doc-section";
import { StepList } from "@/components/docs/step-list";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

const eventCategoryColors: Record<string, string> = {
  DSAR: "bg-blue-100 text-blue-800 border-transparent",
  Incident: "bg-red-100 text-red-800 border-transparent",
  Vendor: "bg-purple-100 text-purple-800 border-transparent",
  Assessment: "bg-yellow-100 text-yellow-800 border-transparent",
  Transfer: "bg-green-100 text-green-800 border-transparent",
};

export default function DocsNotificationsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications & Alerts</h1>
        <p className="text-muted-foreground mt-1">
          Stay on top of deadlines, escalations, and compliance events with multi-channel notifications.
          DPO Central monitors your privacy program around the clock and alerts you when action is needed.
        </p>
      </div>

      <DocSection
        id="overview"
        title="How It Works"
        description="Notifications are delivered through multiple channels to ensure you never miss a critical event."
      >
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">In-App Bell</p>
              <p className="text-xs text-muted-foreground">
                Real-time notifications appear in the bell icon in the top navigation bar. Unread count is always visible.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Email Alerts</p>
              <p className="text-xs text-muted-foreground">
                Critical and deadline-related events are sent to your registered email address. Digest frequency is configurable.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Slack Webhooks</p>
              <p className="text-xs text-muted-foreground">
                Send alerts to a Slack channel via incoming webhook. Available with the premium add-on.
              </p>
            </div>
          </div>
        </div>
      </DocSection>

      <DocSection
        id="event-types"
        title="Notification Events"
        description="The system generates notifications for these compliance-critical events."
      >
        <FeatureMockup title="Event Types">
          <div className="space-y-2">
            {[
              { event: "DSAR deadline approaching (7d)", category: "DSAR", trigger: "7 days before the statutory response deadline" },
              { event: "DSAR deadline approaching (3d)", category: "DSAR", trigger: "3 days before the statutory response deadline" },
              { event: "DSAR deadline approaching (1d)", category: "DSAR", trigger: "1 day before the statutory response deadline" },
              { event: "DSAR overdue", category: "DSAR", trigger: "Response deadline has passed without completion" },
              { event: "New DSAR submitted", category: "DSAR", trigger: "A subject submits a new request via the public portal" },
              { event: "Incident severity escalation", category: "Incident", trigger: "An incident is escalated to HIGH or CRITICAL severity" },
              { event: "Vendor contract expiring", category: "Vendor", trigger: "DPA or contract expires within 90, 60, or 30 days" },
              { event: "Assessment overdue", category: "Assessment", trigger: "An assessment passes its scheduled completion date" },
              { event: "Assessment auto-created", category: "Assessment", trigger: "A periodic assessment is automatically generated from a schedule" },
              { event: "SCC expiring", category: "Transfer", trigger: "Standard Contractual Clauses approaching expiry date" },
            ].map((item) => (
              <div key={item.event} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.event}</span>
                    <Badge variant="outline" className={`text-[10px] ${eventCategoryColors[item.category]}`}>
                      {item.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.trigger}</p>
                </div>
              </div>
            ))}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocSection
        id="preferences"
        title="Notification Preferences"
        description="Customize which events you receive and how they are delivered."
      >
        <StepList
          steps={[
            {
              title: "Go to notification settings",
              description: "Navigate to Settings > Notifications from the user menu in the top navigation bar.",
            },
            {
              title: "Toggle channels per event type",
              description: "For each event type, enable or disable in-app, email, and Slack delivery independently.",
            },
            {
              title: "Configure Slack webhook URL",
              description: "Paste your Slack incoming webhook URL in the integrations section. Test the connection to confirm delivery.",
            },
          ]}
        />
        <InfoCallout type="tip" title="Email defaults">
          Email notifications are enabled by default for all deadline and escalation events.
          You can disable them individually, but we recommend keeping at least email alerts active
          for DSAR deadlines and incident escalations to avoid missing regulatory obligations.
        </InfoCallout>
      </DocSection>

      <DocSection
        id="deadline-checker"
        title="Automatic Deadline Monitoring"
        description="A background job continuously monitors your compliance deadlines and generates alerts proactively."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The deadline checker runs as a daily cron job and scans across your entire privacy program
            for upcoming and overdue items:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>DSAR deadlines</strong> &mdash; checks statutory response periods and sends reminders at 7, 3, and 1 day thresholds</li>
            <li><strong>Incident notification deadlines</strong> &mdash; monitors the 72-hour DPA notification window for active breaches</li>
            <li><strong>Vendor contract expiry</strong> &mdash; flags DPAs and contracts approaching renewal at 90, 60, and 30 days</li>
            <li><strong>SCC expiry dates</strong> &mdash; tracks Standard Contractual Clauses nearing expiration for international transfers</li>
          </ul>
        </div>
        <InfoCallout type="info" title="Schedule">
          The deadline checker runs daily at 8:00 AM UTC. All notifications generated during the check
          are delivered immediately via your configured channels.
        </InfoCallout>
      </DocSection>

      <DocSection
        id="channels"
        title="Delivery Channels"
        description="Notification channels available in core and premium tiers."
      >
        <FeatureMockup title="Channel Comparison">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channel</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tier</span>
            </div>
            {[
              { channel: "In-App Notifications", icon: Bell, tier: "Core", tierColor: "bg-green-100 text-green-800 border-transparent" },
              { channel: "Email Alerts", icon: Mail, tier: "Core", tierColor: "bg-green-100 text-green-800 border-transparent" },
              { channel: "Slack Webhooks", icon: MessageSquare, tier: "Premium", tierColor: "bg-amber-100 text-amber-800 border-transparent" },
              { channel: "Custom Webhooks", icon: Webhook, tier: "Premium", tierColor: "bg-amber-100 text-amber-800 border-transparent" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.channel} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.channel}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${item.tierColor}`}>
                    {item.tier}
                  </Badge>
                </div>
              );
            })}
          </div>
        </FeatureMockup>
      </DocSection>

      <DocNavFooter
        previous={{ title: "Expert Help & Personas", href: "/privacy/docs/experts" }}
        next={{ title: "Compliance Reports", href: "/privacy/docs/reports" }}
      />
    </div>
  );
}

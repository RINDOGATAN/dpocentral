import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  Shield,
  LayoutDashboard,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocSection } from "@/components/docs/doc-section";
import { FeatureMockup } from "@/components/docs/feature-mockup";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

export default function DocsGettingStartedPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Getting Started</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to DPO Central — your comprehensive privacy management platform.
          This guide covers every feature to help you manage data protection compliance.
        </p>
      </div>

      <DocSection id="dashboard" title="Dashboard Overview" description="The dashboard provides a real-time snapshot of your privacy program.">
        <FeatureMockup title="Dashboard Stats">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">Data Inventory</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">24</div>
                <p className="text-xs text-muted-foreground">8 activities</p>
              </CardContent>
            </Card>
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">Open DSARs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">3</div>
                <p className="text-xs text-muted-foreground">All on track</p>
              </CardContent>
            </Card>
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">Assessments</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">12</div>
                <p className="text-xs text-muted-foreground">2 pending review</p>
              </CardContent>
            </Card>
            <Card className="hover:translate-y-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium">Incidents</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold text-primary">1</div>
                <p className="text-xs text-muted-foreground">0 critical</p>
              </CardContent>
            </Card>
          </div>
        </FeatureMockup>
        <InfoCallout type="tip" title="Stat cards are interactive">
          Click on any stat card to navigate directly to that module&apos;s list view.
        </InfoCallout>
      </DocSection>

      <DocSection id="navigation" title="Navigation" description="The main navigation bar provides access to all modules.">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: LayoutDashboard, label: "Dashboard", desc: "Overview stats, recent activity, quick actions" },
            { icon: Database, label: "Data Inventory", desc: "Assets, data elements, processing activities, flows" },
            { icon: FileText, label: "DSAR", desc: "Subject access requests, SLA tracking, public portal" },
            { icon: ClipboardCheck, label: "Assessments", desc: "DPIA, PIA, TIA, LIA with templates & approvals" },
            { icon: AlertTriangle, label: "Incidents", desc: "Breach tracking, DPA notifications, timelines" },
            { icon: Building2, label: "Vendors", desc: "Contracts, questionnaires, risk tiers" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </DocSection>

      <DocSection id="roles" title="User Roles" description="DPO Central uses a hierarchical role system. Higher roles inherit all permissions of lower roles.">
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left font-medium px-4 py-2">Role</th>
                <th className="text-left font-medium px-4 py-2">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {[
                { role: "OWNER", desc: "Full access including organization settings, billing, and member management" },
                { role: "ADMIN", desc: "Manage all modules, users, and settings. Cannot delete the organization" },
                { role: "PRIVACY_OFFICER", desc: "Full CRUD on all privacy modules. Cannot manage organization settings" },
                { role: "MEMBER", desc: "Create and edit records, submit assessments for review" },
                { role: "VIEWER", desc: "Read-only access to all privacy data" },
              ].map((item, i) => (
                <tr key={item.role} className={i % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="font-mono text-xs">{item.role}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InfoCallout type="info" title="Role inheritance">
          Each role inherits all permissions from the roles below it. For example, an ADMIN has all PRIVACY_OFFICER, MEMBER, and VIEWER permissions.
        </InfoCallout>
      </DocSection>

      <DocSection id="quick-actions" title="Quick Actions" description="The dashboard provides shortcuts to common tasks.">
        <FeatureMockup title="Quick Actions Panel">
          <Card className="hover:translate-y-0">
            <CardHeader className="p-4">
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription className="text-xs">Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2 p-4 pt-0">
              {[
                { icon: Database, label: "Add Data Asset" },
                { icon: FileText, label: "New DSAR" },
                { icon: ClipboardCheck, label: "Start Assessment" },
                { icon: AlertTriangle, label: "Report Incident" },
                { icon: Building2, label: "Add Vendor" },
                { icon: Shield, label: "Run Audit" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Button key={item.label} variant="outline" className="w-full justify-start h-11">
                    <Icon className="w-4 h-4 mr-2 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    <Plus className="w-3 h-3 ml-auto text-muted-foreground" />
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </FeatureMockup>
      </DocSection>

      <DocNavFooter
        next={{ title: "Data Inventory", href: "/privacy/docs/data-inventory" }}
      />
    </div>
  );
}

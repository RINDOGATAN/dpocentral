import { Building2, Briefcase } from "lucide-react";
import { DocSection } from "@/components/docs/doc-section";
import { InfoCallout } from "@/components/docs/info-callout";
import { DocNavFooter } from "@/components/docs/doc-nav-footer";

export default function DocsExpertsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expert Help & Personas</h1>
        <p className="text-muted-foreground mt-1">
          DPO Central supports two types of users with tailored experiences for each.
        </p>
      </div>

      <DocSection
        id="personas"
        title="User Personas"
        description="When you first sign in, you choose how you use the platform."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Business Owner</p>
              <p>
                For users who need privacy compliance for their own organization. You get access
                to the Expert Directory to connect with certified privacy professionals.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Privacy Professional</p>
              <p>
                For lawyers and consultants who advise multiple organizations. You get a
                &ldquo;My Clients&rdquo; dashboard showing all your client organizations with
                summary statistics.
              </p>
            </div>
          </div>
        </div>
        <InfoCallout type="tip">
          You can change your account type at any time from the{" "}
          <strong>Settings</strong> page.
        </InfoCallout>
      </DocSection>

      <DocSection
        id="expert-directory"
        title="Expert Directory"
        description="Find and connect with certified privacy experts."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The Expert Directory (available to Business Owners) lets you search for
            privacy professionals by specialization, country, and language.
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Search by name, firm, or area of expertise</li>
            <li>Filter by specialization (GDPR, DPIA, DSAR, etc.)</li>
            <li>Filter by country and language</li>
            <li>View certifications (CIPP/E, CIPM, etc.)</li>
            <li>Contact experts directly via their profile</li>
          </ul>
        </div>
      </DocSection>

      <DocSection
        id="client-dashboard"
        title="Client Dashboard"
        description="Manage all your client organizations from one view."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The Client Dashboard (available to Privacy Professionals) shows all
            organizations you&apos;re a member of with real-time statistics:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Open DSARs and overdue count per client</li>
            <li>Pending assessments count</li>
            <li>Open incidents count</li>
            <li>Active vendor count</li>
            <li>Last activity timestamp</li>
            <li>Attention indicators for overdue items</li>
          </ul>
          <p>
            Click any client card to switch to that organization&apos;s dashboard.
          </p>
        </div>
      </DocSection>

      <DocSection
        id="settings"
        title="Changing Your Account Type"
        description="Switch between Business Owner and Privacy Professional at any time."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Navigate to <strong>/privacy/settings</strong> to view your profile and change
            your account type. Your navigation and available features will update immediately.
          </p>
        </div>
      </DocSection>

      <DocNavFooter
        previous={{ href: "/privacy/docs/vendors", title: "Vendor Management" }}
        next={{ href: "/privacy/docs/premium", title: "Premium Features" }}
      />
    </div>
  );
}

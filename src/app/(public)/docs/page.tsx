import Link from "next/link";
import {
  Database,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Building2,
  Shield,
  ArrowRight,
} from "lucide-react";

const modules = [
  {
    title: "Data Inventory",
    description:
      "Track data assets, elements, processing activities, and cross-border transfers. Generate your Record of Processing Activities (ROPA) automatically.",
    href: "/docs/data-inventory",
    icon: Database,
  },
  {
    title: "DSAR Management",
    description:
      "Handle data subject access requests end-to-end with SLA tracking, task management, and a public intake portal.",
    href: "/docs/dsar",
    icon: FileText,
  },
  {
    title: "Assessments",
    description:
      "Conduct DPIAs, PIAs, LIAs, TIAs, and vendor risk assessments using configurable templates with approval workflows.",
    href: "/docs/assessments",
    icon: ClipboardCheck,
  },
  {
    title: "Incident Management",
    description:
      "Track privacy incidents, manage response timelines, coordinate DPA notifications, and assign response tasks.",
    href: "/docs/incidents",
    icon: AlertTriangle,
  },
  {
    title: "Vendor Management",
    description:
      "Maintain your vendor register, track contracts, send questionnaires, and monitor third-party risk.",
    href: "/docs/vendors",
    icon: Building2,
  },
];

export default function DocsOverviewPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-display uppercase tracking-wide text-foreground mb-4">
          DPO Central
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          A single source of truth for your privacy management program.
          DPO Central helps organizations manage data inventory, DSARs,
          assessments, incidents, and vendor relationships from one unified
          platform.
        </p>
      </div>

      {/* Quick Start */}
      <div className="card-brutal">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Quick Start
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                1
              </span>
              <div>
                <p className="font-medium text-foreground">Sign in</p>
                <p className="text-muted-foreground">
                  Use your email magic link or Google account
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                2
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Set up your organization
                </p>
                <p className="text-muted-foreground">
                  Create or join an organization and invite your team
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                3
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Build your data inventory
                </p>
                <p className="text-muted-foreground">
                  Register data assets, elements, and processing activities
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                4
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Start managing privacy
                </p>
                <p className="text-muted-foreground">
                  Handle DSARs, run assessments, and track incidents
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Roles */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          User Roles
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          DPO Central uses role-based access control. Each role inherits
          permissions from the roles below it.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              role: "Owner",
              desc: "Full control including billing, team management, and organization settings",
            },
            {
              role: "Admin",
              desc: "Manage users, configure modules, and access all privacy features",
            },
            {
              role: "Privacy Officer",
              desc: "Full access to all privacy modules, run assessments, manage incidents",
            },
            {
              role: "Member",
              desc: "Create and edit records, submit DSARs, report incidents",
            },
            {
              role: "Viewer",
              desc: "Read-only access to dashboards, reports, and records",
            },
          ].map((item) => (
            <div
              key={item.role}
              className="p-3 rounded-lg border border-border bg-card"
            >
              <p className="text-sm font-semibold text-primary">{item.role}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modules */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Modules
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group card-brutal flex flex-col"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    {mod.title}
                  </h3>
                  <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {mod.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Licensing */}
      <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Open Core Licensing
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          DPO Central follows an open core model. The core platform is available
          under AGPL-3.0, while advanced features require a commercial license.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-foreground mb-2">
              Core (Open Source)
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>&#8226; Data Inventory &amp; ROPA</li>
              <li>&#8226; DSAR management &amp; public portal</li>
              <li>&#8226; Incident tracking</li>
              <li>&#8226; Basic assessments (LIA, Custom)</li>
              <li>&#8226; Vendor management (basic)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground mb-2">
              Premium (Commercial License)
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>&#8226; DPIA, PIA, TIA assessments</li>
              <li>&#8226; Vendor risk assessments</li>
              <li>&#8226; Vendor Catalog (400+ vendors)</li>
              <li>&#8226; Advanced audit features</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

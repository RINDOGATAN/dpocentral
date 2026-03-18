import {
  Shield,
  Lock,
  KeyRound,
  Users,
  FileCheck,
  Globe,
  Eye,
  Server,
  CreditCard,
  ScrollText,
} from "lucide-react";

const sections = [
  {
    icon: Lock,
    title: "Authentication",
    items: [
      "Multi-provider sign-in via Google OAuth and email magic links",
      "Stateless JWT sessions — no server-side session state to compromise",
      "OAuth tokens are never persisted to the database",
      "Account isolation — each sign-in method is kept separate",
      "Cross-app SSO via secure, scoped session cookies",
    ],
  },
  {
    icon: Users,
    title: "Authorization & Access Control",
    items: [
      "Strict multi-tenancy — every query is scoped to your organization",
      "Five-tier role hierarchy: Owner, Admin, Privacy Officer, Member, Viewer",
      "Role-based enforcement on all create, update, and delete operations",
      "Destructive actions restricted to Admins and Owners only",
      "No raw SQL — all access via parameterized ORM queries",
    ],
  },
  {
    icon: FileCheck,
    title: "Input Validation & Sanitization",
    items: [
      "Schema validation on every API endpoint",
      "HTML sanitization on all public-facing inputs",
      "Parameterized database queries prevent SQL injection",
      "Validation error details hidden in production",
    ],
  },
  {
    icon: Globe,
    title: "Transport & Browser Security",
    items: [
      "HSTS with 2-year duration, subdomains, and preload",
      "Content Security Policy with per-request nonces",
      "Clickjacking protection via X-Frame-Options: DENY",
      "MIME sniffing prevention and strict referrer policy",
      "Camera, microphone, and geolocation disabled by policy",
    ],
  },
  {
    icon: Shield,
    title: "Rate Limiting & Abuse Prevention",
    items: [
      "Authentication endpoints throttled against credential stuffing",
      "Checkout and billing routes protected against payment fraud",
      "Public submission endpoints throttled to prevent spam",
      "Proper 429 responses with Retry-After headers",
    ],
  },
  {
    icon: KeyRound,
    title: "API Security",
    items: [
      "Timing-safe API key verification on administrative endpoints",
      "Payload size validation on batch operations",
      "Token expiry enforcement on all vendor questionnaire operations",
      "Public DSAR portal validates active configuration before accepting submissions",
    ],
  },
  {
    icon: ScrollText,
    title: "Audit Trail",
    items: [
      "Comprehensive logging for all create, update, and delete operations",
      "Administrative actions logged with full metadata",
      "Structured production logging with no stack traces or sensitive context",
    ],
  },
  {
    icon: Eye,
    title: "Data Minimization",
    items: [
      "API responses return only the fields needed by the interface",
      "Sensitive keys are masked in administrative views",
      "Public email domains blocked from automatic organization membership",
    ],
  },
  {
    icon: CreditCard,
    title: "Payment Security",
    items: [
      "Stripe webhook signature verification via HMAC-SHA256",
      "Server-side checkout prevents client-side price manipulation",
      "Entitlements automatically suspended on payment failure",
    ],
  },
  {
    icon: Server,
    title: "Infrastructure",
    items: [
      "Hosted on Vercel with automatic TLS and global edge network",
      "PostgreSQL database with encrypted connections",
      "Environment secrets excluded from client bundles",
      "Development-only endpoints gated by runtime environment checks",
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-display uppercase tracking-wide text-foreground">
            Data Security
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl">
          DPO Central is built with defense-in-depth across every layer.
          As a privacy management platform handling assessment results, incident
          records, vendor contracts, and data subject requests, security is a
          foundational requirement — not an afterthought.
        </p>
      </div>

      {/* Sections grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="card-brutal">
            <div className="flex items-center gap-3 mb-4">
              <section.icon className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold text-foreground">
                {section.title}
              </h2>
            </div>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm text-muted-foreground"
                >
                  <span className="text-primary mt-1 shrink-0">&#8226;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Responsible disclosure */}
      <div className="card-brutal border-primary/30">
        <div className="flex items-center gap-3 mb-3">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Responsible Disclosure
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          If you discover a security vulnerability, please report it responsibly.
          Do not open a public issue. Contact us directly at the email address
          listed in the repository.
        </p>
      </div>
    </div>
  );
}

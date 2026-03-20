"use client";

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
  CheckCircle,
  Layers,
  ShieldCheck,
  Fingerprint,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface SecuritySection {
  id: string;
  icon: React.ElementType;
  title: string;
  badge?: { label: string; className: string };
  items: string[];
  highlight?: { text: string; type: "tip" | "info" };
}

const categories: {
  title: string;
  description: string;
  icon: React.ElementType;
  sections: SecuritySection[];
}[] = [
  {
    title: "Identity & Access",
    description: "Authentication, authorization, and session management",
    icon: Fingerprint,
    sections: [
      {
        id: "authentication",
        icon: Lock,
        title: "Authentication",
        badge: { label: "Zero-knowledge", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-transparent" },
        items: [
          "Multi-provider sign-in via Google OAuth and email magic links",
          "Stateless JWT sessions — no server-side session state to compromise",
          "OAuth tokens are never persisted to the database",
          "Account isolation — each sign-in method is kept separate",
          "Cross-app SSO via secure, scoped session cookies",
        ],
        highlight: { text: "No passwords are stored. Authentication is delegated to trusted identity providers or cryptographically signed magic links.", type: "tip" },
      },
      {
        id: "authorization",
        icon: Users,
        title: "Authorization & Access Control",
        badge: { label: "5-tier RBAC", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-transparent" },
        items: [
          "Strict multi-tenancy — every query is scoped to your organization",
          "Five-tier role hierarchy: Owner, Admin, Privacy Officer, Member, Viewer",
          "Role-based enforcement on all create, update, and delete operations",
          "Destructive actions restricted to Admins and Owners only",
          "No raw SQL — all access via parameterized ORM queries",
        ],
        highlight: { text: "All database access uses parameterized ORM queries. SQL injection is structurally prevented, not just mitigated.", type: "info" },
      },
    ],
  },
  {
    title: "Application Security",
    description: "Input handling, API protection, and abuse prevention",
    icon: ShieldCheck,
    sections: [
      {
        id: "input-validation",
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
        id: "api-security",
        icon: KeyRound,
        title: "API Security",
        items: [
          "Timing-safe API key verification on administrative endpoints",
          "Payload size validation on batch operations",
          "Token expiry enforcement on all vendor questionnaire operations",
          "Public DSAR portal validates active configuration before accepting submissions",
        ],
        highlight: { text: "API key comparisons use constant-time algorithms to prevent timing attacks on administrative endpoints.", type: "info" },
      },
      {
        id: "rate-limiting",
        icon: Shield,
        title: "Rate Limiting & Abuse Prevention",
        badge: { label: "Per-endpoint", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-transparent" },
        items: [
          "Authentication endpoints throttled against credential stuffing",
          "Checkout and billing routes protected against payment fraud",
          "Public submission endpoints throttled to prevent spam",
          "Proper 429 responses with Retry-After headers",
        ],
      },
    ],
  },
  {
    title: "Data Protection",
    description: "Transport security, audit logging, minimization, and payment handling",
    icon: Lock,
    sections: [
      {
        id: "transport",
        icon: Globe,
        title: "Transport & Browser Security",
        badge: { label: "6 headers", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-transparent" },
        items: [
          "HSTS with 2-year duration, subdomains, and preload",
          "Content Security Policy with per-request nonces",
          "Clickjacking protection via X-Frame-Options: DENY",
          "MIME sniffing prevention and strict referrer policy",
          "Camera, microphone, and geolocation disabled by policy",
        ],
        highlight: { text: "CSP nonces are generated per request, preventing inline script injection even if an attacker finds an XSS vector.", type: "tip" },
      },
      {
        id: "audit",
        icon: ScrollText,
        title: "Audit Trail",
        items: [
          "Comprehensive logging for all create, update, and delete operations",
          "Administrative actions logged with full metadata",
          "Structured production logging with no stack traces or sensitive context",
        ],
      },
      {
        id: "minimization",
        icon: Eye,
        title: "Data Minimization",
        items: [
          "API responses return only the fields needed by the interface",
          "Sensitive keys are masked in administrative views",
          "Public email domains blocked from automatic organization membership",
        ],
      },
      {
        id: "payment",
        icon: CreditCard,
        title: "Payment Security",
        badge: { label: "Stripe verified", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 border-transparent" },
        items: [
          "Stripe webhook signature verification via HMAC-SHA256",
          "Server-side checkout prevents client-side price manipulation",
          "Entitlements automatically suspended on payment failure",
        ],
      },
    ],
  },
  {
    title: "Infrastructure",
    description: "Hosting, encryption, and environment isolation",
    icon: Server,
    sections: [
      {
        id: "infrastructure",
        icon: Server,
        title: "Hosting & Environment",
        badge: { label: "Edge network", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-transparent" },
        items: [
          "Hosted on Vercel with automatic TLS and global edge network",
          "PostgreSQL database with encrypted connections",
          "Environment secrets excluded from client bundles",
          "Development-only endpoints gated by runtime environment checks",
        ],
      },
    ],
  },
];

const stats = [
  { label: "Security Layers", value: "10", icon: Layers },
  { label: "HTTP Headers", value: "6", icon: Globe },
  { label: "Role Tiers", value: "5", icon: Users },
  { label: "HSTS Max-Age", value: "2 yr", icon: ShieldCheck },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SecurityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/15 border border-primary/20">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-transparent">
              Defense in Depth
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Data Security
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base leading-relaxed">
            DPO Central is built with defense-in-depth across every layer. As a privacy
            management platform handling assessment results, incident records, vendor
            contracts, and data subject requests, security is a foundational
            requirement — not an afterthought.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => {
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
      </div>

      {/* ── Categories ──────────────────────────────────────────────── */}
      {categories.map((category) => {
        const CatIcon = category.icon;
        return (
          <section key={category.title} className="space-y-4">
            {/* Category header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                <CatIcon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{category.title}</h2>
                <p className="text-xs text-muted-foreground">{category.description}</p>
              </div>
            </div>

            {/* Accordion sections */}
            <div className="rounded-xl border bg-background overflow-hidden">
              {/* Mockup-style header bar */}
              <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/30">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Security Controls</span>
                <span className="text-xs text-muted-foreground">—</span>
                <span className="text-xs text-muted-foreground">{category.title}</span>
              </div>

              <div className="px-4">
                <Accordion type="multiple" defaultValue={category.sections.map((s) => s.id)}>
                  {category.sections.map((section) => {
                    const SectionIcon = section.icon;
                    return (
                      <AccordionItem key={section.id} value={section.id} className="last:border-b-0">
                        <AccordionTrigger className="hover:no-underline gap-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <SectionIcon className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-medium">{section.title}</span>
                            {section.badge && (
                              <Badge variant="outline" className={`text-[10px] ${section.badge.className}`}>
                                {section.badge.label}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-7">
                          <ul className="space-y-2 mb-3">
                            {section.items.map((item) => (
                              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                {item}
                              </li>
                            ))}
                          </ul>
                          {section.highlight && (
                            <div
                              className={`border-l-4 rounded-r-lg p-3 mt-2 ${
                                section.highlight.type === "tip"
                                  ? "border-primary bg-primary/5"
                                  : "border-blue-500 bg-blue-500/5"
                              }`}
                            >
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {section.highlight.text}
                              </p>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── Responsible Disclosure ────────────────────────────────── */}
      <div className="border-l-4 border-primary bg-primary/5 rounded-r-lg p-5">
        <div className="flex gap-3">
          <Mail className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
          <div className="space-y-1.5">
            <p className="font-medium text-sm">Responsible Disclosure</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you discover a security vulnerability, please report it responsibly.
              Do not open a public issue. Contact us directly at the email address
              listed in the repository.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

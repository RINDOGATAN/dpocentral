"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useUserType } from "@/lib/use-user-type";
import { features } from "@/config/features";

type CtaContext =
  | "quickstart"
  | "assessment"
  | "incident"
  | "empty-state"
  | "general"
  | "vendor"
  | "dsar"
  | "high-risk"
  | "transfer";

const ctaCopy: Record<CtaContext, { heading: string; body: string; filter?: string }> = {
  quickstart: {
    heading: "Need help setting up your privacy program?",
    body: "Connect with a certified privacy expert who can guide you through GDPR compliance and help tailor your program.",
  },
  assessment: {
    heading: "Need help with your assessment?",
    body: "Privacy experts can help you conduct DPIAs, PIAs, and other assessments to ensure thorough compliance.",
  },
  incident: {
    heading: "Need expert guidance on incident response?",
    body: "A privacy professional can help you manage breach notifications, DPA communications, and remediation.",
    filter: "Incident Response",
  },
  "empty-state": {
    heading: "Not sure where to start?",
    body: "A privacy expert can help you build your data inventory and establish compliant processes from day one.",
  },
  general: {
    heading: "Get expert privacy advice",
    body: "Connect with certified privacy professionals who can help with GDPR compliance, assessments, and more.",
  },
  vendor: {
    heading: "Need help with vendor due diligence?",
    body: "A privacy expert can review your vendor contracts, DPAs, and help assess third-party data processing risks.",
    filter: "Vendor Management",
  },
  dsar: {
    heading: "Need help managing subject access requests?",
    body: "Privacy professionals can help you establish efficient DSAR workflows and ensure timely, compliant responses.",
    filter: "DSAR / Subject Rights",
  },
  "high-risk": {
    heading: "High-risk processing detected",
    body: "Your selection includes vendors that process sensitive data. A DPIA specialist can help you assess and mitigate these risks.",
    filter: "DPIA / Impact Assessments",
  },
  transfer: {
    heading: "International transfers detected",
    body: "Data leaving the EEA requires appropriate safeguards. A transfer specialist can help with TIAs and SCCs.",
    filter: "Cross-Border Transfers",
  },
};

export function ExpertHelpCta({ context }: { context: CtaContext }) {
  const { isBusinessOwner } = useUserType();

  if (!isBusinessOwner || !features.expertDirectoryEnabled) return null;

  const copy = ctaCopy[context];
  const href = copy.filter
    ? `/privacy/experts?specialization=${encodeURIComponent(copy.filter)}`
    : "/privacy/experts";

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <Search className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{copy.heading}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{copy.body}</p>
        </div>
        <Link href={href}>
          <Button variant="outline" size="sm" className="shrink-0 gap-2">
            <Search className="w-3.5 h-3.5" />
            Find Expert
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

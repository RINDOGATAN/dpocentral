"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useUserType } from "@/lib/use-user-type";
import { features } from "@/config/features";

type CtaContext = "quickstart" | "assessment" | "incident" | "empty-state" | "general";

const ctaCopy: Record<CtaContext, { heading: string; body: string }> = {
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
  },
  "empty-state": {
    heading: "Not sure where to start?",
    body: "A privacy expert can help you build your data inventory and establish compliant processes from day one.",
  },
  general: {
    heading: "Get expert privacy advice",
    body: "Connect with certified privacy professionals who can help with GDPR compliance, assessments, and more.",
  },
};

export function ExpertHelpCta({ context }: { context: CtaContext }) {
  const { isBusinessOwner } = useUserType();

  if (!isBusinessOwner || !features.expertDirectoryEnabled) return null;

  const copy = ctaCopy[context];

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
        <Link href="/privacy/experts">
          <Button variant="outline" size="sm" className="shrink-0 gap-2">
            <Search className="w-3.5 h-3.5" />
            Find Expert
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

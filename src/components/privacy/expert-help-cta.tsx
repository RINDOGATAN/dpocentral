"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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

// Map context keys to message keys (JSON uses camelCase, not kebab-case)
const contextToKey: Record<CtaContext, string> = {
  quickstart: "quickstart",
  assessment: "assessment",
  incident: "incident",
  "empty-state": "emptyState",
  general: "general",
  vendor: "vendor",
  dsar: "dsar",
  "high-risk": "highRisk",
  transfer: "transfer",
};

// Filters are not translatable — they map to API specialization values
const contextFilters: Partial<Record<CtaContext, string>> = {
  incident: "Incident Response",
  vendor: "Vendor Management",
  dsar: "DSAR / Subject Rights",
  "high-risk": "DPIA / Impact Assessments",
  transfer: "Cross-Border Transfers",
};

export function ExpertHelpCta({ context }: { context: CtaContext }) {
  const { isBusinessOwner } = useUserType();
  const t = useTranslations("expertCta");

  if (!isBusinessOwner || !features.expertDirectoryEnabled) return null;

  const key = contextToKey[context];
  const filter = contextFilters[context];
  const href = filter
    ? `/privacy/experts?specialization=${encodeURIComponent(filter)}`
    : "/privacy/experts";

  return (
    <Card className="border border-primary">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <Search className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{t(`${key}.heading`)}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t(`${key}.body`)}</p>
        </div>
        <Link href={href}>
          <Button variant="outline" size="sm" className="shrink-0 gap-2">
            <Search className="w-3.5 h-3.5" />
            {t("findExpert")}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

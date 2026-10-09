"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Needs action": everything waiting for a person, in one short list — reviews
 * due, rights requests near or past their deadline, breaches to notify, and
 * assessments waiting to be approved. A privacy lead should not have to open
 * five modules to learn whether there is anything to do. The list is
 * department-scoped for a limited member, and can be narrowed to a department by
 * anyone through the ?dept= parameter (the "for my department" switch).
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";
import type { NeedsActionKind } from "@/lib/needs-action";

const ICON: Record<NeedsActionKind, React.ElementType> = {
  "review-due": CalendarClock,
  "dsar-due": AlarmClock,
  "breach-window": AlertTriangle,
  "breach-decision": AlertTriangle,
  "assessment-approval": ClipboardCheck,
};

export default function NeedsActionPage() {
  const t = useTranslations("views");
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const dept = useSearchParams().get("dept") ?? undefined;

  const { data, isLoading } = trpc.views.needsAction.useQuery(
    { organizationId: orgId, businessUnitId: dept },
    { enabled: !!orgId },
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-primary" aria-hidden="true" />
          {t("needsAction.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("needsAction.subtitle")}</p>
      </div>

      {isLoading ? (
        <ListPageSkeleton count={2} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-60" aria-hidden="true" />
            <p>{t("needsAction.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.items.map((item) => {
            const Icon = ICON[item.kind];
            return (
              <li key={item.kind}>
                <Link href={item.href}>
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 bg-primary/10 flex items-center justify-center shrink-0 rounded">
                        <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t(`needsAction.kind.${item.kind}`)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(`needsAction.hint.${item.kind}`)}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {item.count}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {data?.departmentScoped && (
        <p className="text-xs text-muted-foreground">{t("needsAction.deptNote")}</p>
      )}
    </div>
  );
}

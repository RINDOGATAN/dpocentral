"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Incomplete": processing records whose entry is missing a field a record of
 * processing needs (Art. 30), with exactly what is missing and a link to fill
 * it. The rule for "what is missing" is the one in
 * src/lib/record-completeness.ts, so the list and the record page never
 * disagree.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";

export default function IncompletePage() {
  const t = useTranslations("views");
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const dept = useSearchParams().get("dept") ?? undefined;

  const { data, isLoading } = trpc.views.incomplete.useQuery(
    { organizationId: orgId, businessUnitId: dept },
    { enabled: !!orgId },
  );
  const records = data?.records ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" aria-hidden="true" />
          {t("incomplete.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("incomplete.subtitle")}</p>
      </div>

      {isLoading ? (
        <ListPageSkeleton count={3} />
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-60" aria-hidden="true" />
            <p>{t("incomplete.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li key={r.id}>
              <Link href={`/privacy/data-inventory/activities/${r.id}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t("incomplete.missingCount", { count: r.missing.length })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {r.missing.map((field) => (
                          <Badge key={field} variant="outline" className="text-xs">
                            {t(`field.${field}`)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" aria-hidden="true" />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

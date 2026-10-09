"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Review and confirm": every record the quick start, a template or another
 * client's copy drafted for this organisation and nobody has confirmed yet.
 * They count towards the programme once a person confirms them (owner's
 * decision d2, 9 October 2026; as AI Sentinel's review queue).
 *
 * Each row opens the record (to check or correct it; editing confirms it too)
 * and has its own Confirm button; "Select all" and "Confirm selected" confirm
 * several at once. Only the owner, the admins and the privacy officers may
 * confirm; everyone else sees the list and a line saying who can.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useCanConfirmDrafts, type DraftKind } from "@/components/privacy/draft-confirm";

const KINDS: DraftKind[] = ["dataAsset", "processingActivity", "vendor"];

function recordHref(kind: DraftKind, id: string): string {
  if (kind === "dataAsset") return `/privacy/data-inventory/${id}`;
  if (kind === "processingActivity") return `/privacy/data-inventory/activities/${id}`;
  return `/privacy/vendors/${id}`;
}

const keyOf = (kind: DraftKind, id: string) => `${kind}:${id}`;

export default function ReviewDraftsPage() {
  const t = useTranslations("drafts");
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const canConfirm = useCanConfirmDrafts();
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: items, isLoading } = trpc.drafts.list.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  );

  const confirm = trpc.drafts.confirm.useMutation({
    onSuccess: async (result) => {
      toast.success(t("confirmedMany", { count: result.confirmed }));
      setSelected(new Set());
      await utils.invalidate();
    },
    onError: (error) => toast.error(error.message || t("confirmFailed")),
  });

  const groups = useMemo(
    () => KINDS.map((kind) => ({ kind, rows: (items ?? []).filter((i) => i.kind === kind) })).filter((g) => g.rows.length > 0),
    [items],
  );
  const total = items?.length ?? 0;
  const allKeys = (items ?? []).map((i) => keyOf(i.kind, i.id));
  const allSelected = total > 0 && selected.size === total;

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confirmItems = (list: { kind: DraftKind; id: string }[]) => {
    if (!orgId || list.length === 0) return;
    confirm.mutate({ organizationId: orgId, items: list });
  };

  const confirmSelected = () =>
    confirmItems(
      (items ?? []).filter((i) => selected.has(keyOf(i.kind, i.id))).map((i) => ({ kind: i.kind, id: i.id })),
    );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-primary shrink-0" aria-hidden="true" />
          {t("reviewTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("reviewSubtitle")}</p>
      </div>

      {isLoading ? (
        <ListPageSkeleton count={2} />
      ) : total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground" data-testid="review-empty">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-60" aria-hidden="true" />
            <p>{t("reviewEmpty")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {canConfirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(allSelected ? new Set() : new Set(allKeys))}
              >
                {allSelected ? t("clearSelection") : t("selectAll")}
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={selected.size === 0 || confirm.isPending}
                onClick={confirmSelected}
                data-testid="confirm-selected"
              >
                {confirm.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                )}
                {t("confirmSelected", { count: selected.size })}
              </Button>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {t("waiting", { count: total })}
              </span>
            </div>
          ) : (
            canConfirm === false && (
              <p className="text-sm text-muted-foreground" data-testid="review-approver-only">
                {t("approverOnly")}
              </p>
            )
          )}

          {groups.map((group) => (
            <Card key={group.kind}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t(`kind.${group.kind}`)} · {group.rows.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="divide-y divide-border">
                  {group.rows.map((row) => {
                    const key = keyOf(row.kind, row.id);
                    return (
                      <li key={key} className="flex items-center gap-3 py-2.5 min-h-11">
                        {canConfirm && (
                          <Checkbox
                            checked={selected.has(key)}
                            onCheckedChange={() => toggle(key)}
                            aria-label={t("selectOne", { name: row.name })}
                          />
                        )}
                        <Link
                          href={recordHref(row.kind, row.id)}
                          className="flex-1 min-w-0 break-words text-sm font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        >
                          {row.name}
                        </Link>
                        {canConfirm && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={confirm.isPending}
                            onClick={() => confirmItems([{ kind: row.kind, id: row.id }])}
                          >
                            {t("confirm")}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

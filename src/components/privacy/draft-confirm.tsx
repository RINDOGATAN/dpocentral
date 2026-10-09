"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Drafts count once confirmed (owner's decision d2, 9 October 2026).
 *
 * - `DraftBadge`: "To confirm" on a record the quick start, a template or
 *   another client's copy drafted and nobody has confirmed yet.
 * - `ConfirmDraftButton`: the Confirm action on that record's own page.
 * - `DraftsNotice`: on a list, how many drafts wait and the way to "Review and
 *   confirm" them together.
 *
 * The rule and the confirmation itself are on the server
 * (src/server/services/template-items/drafts.ts); editing a draft confirms it
 * too.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, CircleDashed, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { canConfirmDrafts, isDraftRecord } from "@/lib/drafts";

export type DraftKind = "dataAsset" | "processingActivity" | "vendor";

/** The review page: every draft of the organisation, confirmed one by one or together. */
export const REVIEW_DRAFTS_HREF = "/privacy/review";

/**
 * Whether the signed-in member may confirm drafts in the current organisation
 * (owner, admin, privacy officer). Null while the list of organisations loads.
 */
export function useCanConfirmDrafts(): boolean | null {
  const { organization, organizations, isLoading } = useOrganization();
  if (!organization) return isLoading ? null : false;
  const role = (organizations.find((o) => o.id === organization.id) as { role?: string } | undefined)?.role;
  if (role === undefined) return isLoading ? null : false;
  return canConfirmDrafts(role);
}

type DraftRecord = { provenance?: string | null; confirmedAt?: Date | string | null };

export function DraftBadge({ record, className }: { record: DraftRecord; className?: string }) {
  const t = useTranslations("drafts");
  if (!isDraftRecord(record)) return null;
  return (
    <Badge
      variant="outline"
      className={`gap-1 border-amber-500/60 text-amber-800 dark:text-amber-300 font-normal ${className ?? ""}`}
      title={t("badgeHint")}
      data-testid="draft-badge"
    >
      <CircleDashed className="w-3 h-3" aria-hidden="true" />
      {t("badge")}
    </Badge>
  );
}

export function ConfirmDraftButton({
  kind,
  id,
  record,
  className,
}: {
  kind: DraftKind;
  id: string;
  record: DraftRecord;
  className?: string;
}) {
  const t = useTranslations("drafts");
  const { organization } = useOrganization();
  const canConfirm = useCanConfirmDrafts();
  const utils = trpc.useUtils();
  const confirm = trpc.drafts.confirm.useMutation({
    onSuccess: async () => {
      toast.success(t("confirmedOne"));
      await utils.invalidate();
    },
    onError: (error) => toast.error(error.message || t("confirmFailed")),
  });
  if (!isDraftRecord(record) || !canConfirm || !organization?.id) return null;
  return (
    <Button
      size="sm"
      className={`gap-2 ${className ?? ""}`}
      disabled={confirm.isPending}
      onClick={() => confirm.mutate({ organizationId: organization.id, items: [{ kind, id }] })}
      data-testid="confirm-draft"
    >
      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
      {t("confirm")}
    </Button>
  );
}

/**
 * One line above a list: "7 drafted records to confirm. They count once a
 * person confirms them." and the link to the review page. Nothing when there
 * are no drafts.
 */
export function DraftsNotice({ className }: { className?: string }) {
  const t = useTranslations("drafts");
  const { organization } = useOrganization();
  const { data } = trpc.drafts.summary.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id },
  );
  if (!data || data.total === 0) return null;
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 sm:p-4 ${className ?? ""}`}
      data-testid="drafts-notice"
    >
      <CircleDashed className="hidden sm:block w-5 h-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <p className="flex-1 min-w-0 text-sm">
        <span className="font-medium">{t("noticeCount", { count: data.total })}</span>{" "}
        <span className="text-muted-foreground">{t("noticeWhy")}</span>
      </p>
      <Link href={REVIEW_DRAFTS_HREF} className="shrink-0">
        <Button size="sm" variant="outline" className="w-full sm:w-auto gap-2">
          <ListChecks className="w-4 h-4" aria-hidden="true" />
          {t("reviewAndConfirm")}
        </Button>
      </Link>
    </div>
  );
}

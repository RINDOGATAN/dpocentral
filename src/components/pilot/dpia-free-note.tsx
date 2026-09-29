"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The pilot tier's free DPIAs, as the screens say them.
 *
 * On the pilot tier two DPIAs per organisation are free for a limited time
 * (PILOT_DPIA_LIMIT in server/services/pilot/caps.ts). The type card, the
 * quick action and the form all read the same server count through
 * `assessment.dpiaQuota`; the server remains the judge at creation. Off the
 * pilot tier (the self-hosted kit, a licensed organisation) the query reports
 * no cap and nothing here renders.
 */

import { useLocale, useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { plansUrl } from "@/lib/hosted";
import { cn } from "@/lib/utils";

export function useDpiaQuota() {
  const { organization } = useOrganization();
  const { data } = trpc.assessment.dpiaQuota.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );
  return data?.capped ? data : null;
}

/** The link to the plans page (no price is ever given in the app). */
export function SeePlansLink({ className }: { className?: string }) {
  const t = useTranslations("pages.trialAssessments");
  const locale = useLocale();
  return (
    <a
      href={plansUrl(locale)}
      target="_blank"
      rel="noreferrer"
      className={cn("underline underline-offset-4", className)}
      data-testid="dpia-see-plans"
    >
      {t("seePlans")}
    </a>
  );
}

/**
 * "Free for a limited time: two DPIAs per organisation on the pilot tier",
 * then, with `detail`, how many are left, or that they are used up with the
 * link to the plans page.
 */
export function DpiaFreeNote({
  detail = false,
  withLink = true,
  className,
}: {
  detail?: boolean;
  /** False inside something already clickable (a card that is a button). */
  withLink?: boolean;
  className?: string;
}) {
  const t = useTranslations("pages.trialAssessments");
  const quota = useDpiaQuota();
  if (!quota) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)} data-testid="dpia-free-note">
      <span className="font-medium text-foreground">{t("freeNote", { limit: quota.limit })}</span>
      {detail && (
        <>
          {". "}
          {quota.remaining > 0
            ? t("remaining", { remaining: quota.remaining, limit: quota.limit })
            : t("usedUp", { limit: quota.limit })}
          {quota.remaining === 0 && withLink && (
            <>
              {" "}
              <SeePlansLink />
            </>
          )}
        </>
      )}
    </p>
  );
}

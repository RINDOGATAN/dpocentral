"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Recorded in error" on an incident page: the notice (to everyone) when the
 * incident is marked, and for owners and admins the action to mark it, with
 * the reason, or to undo it. Incidents are never deleted; a marked one stays
 * in the register and leaves every count (incident.setRecordedInError).
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusNote } from "@/components/ui/status-note";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useOrgRole } from "@/lib/use-org-role";
import { formatDateIn } from "@/lib/utils";

export function IncidentRecordedInErrorNotice({
  recordedInErrorAt,
  reason,
}: {
  recordedInErrorAt: Date | string | null | undefined;
  reason: string | null | undefined;
}) {
  const t = useTranslations("pages.incidentDetail.recordedInError");
  const locale = useLocale();
  if (!recordedInErrorAt) return null;
  return (
    <StatusNote tone="info" title={t("noticeTitle", { date: formatDateIn(new Date(recordedInErrorAt), locale) })} data-testid="incident-recorded-in-error">
      {reason ? t("noticeReason", { reason: reason.trim().replace(/[.]+$/, "") }) : null} {t("noticeBody")}
    </StatusNote>
  );
}

export function IncidentRecordedInErrorAction({
  organizationId,
  incidentId,
  recordedInError,
}: {
  organizationId: string;
  incidentId: string;
  recordedInError: boolean;
}) {
  const t = useTranslations("pages.incidentDetail.recordedInError");
  const tCommon = useTranslations("common");
  const { isAdmin } = useOrgRole();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mutation = trpc.incident.setRecordedInError.useMutation({
    onSuccess: (_d, vars) => {
      toast.success(vars.recordedInError ? t("marked") : t("undone"));
      setOpen(false);
      setReason("");
      utils.incident.getById.invalidate();
      utils.incident.list.invalidate();
      utils.incident.getStats.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  if (!isAdmin) return null;

  if (recordedInError) {
    return (
      <Button
        variant="outline"
        onClick={() => mutation.mutate({ organizationId, id: incidentId, recordedInError: false })}
        disabled={mutation.isPending}
        data-testid="incident-undo-recorded-in-error"
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
        {t("undo")}
      </Button>
    );
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="incident-mark-recorded-in-error">
        <Ban className="w-4 h-4 mr-2" />
        {t("action")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="recorded-in-error-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="recorded-in-error-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => mutation.mutate({ organizationId, id: incidentId, recordedInError: true, reason: reason.trim() })}
              disabled={!reason.trim() || mutation.isPending}
              data-testid="incident-confirm-recorded-in-error"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

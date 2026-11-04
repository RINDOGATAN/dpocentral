"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The new processing activity form. Its one home is Records of processing
 * (src/app/(dashboard)/privacy/data-inventory/processing-activities): the
 * activities are created and listed there; the data inventory links to it.
 * After saving, the new activity's page opens, where systems are linked.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useSubmitLock } from "@/lib/use-submit-lock";

export const LEGAL_BASIS_KEYS = [
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTERESTS",
  "PUBLIC_TASK",
  "LEGITIMATE_INTERESTS",
] as const;

const INITIAL_ACTIVITY_FORM = {
  name: "",
  purpose: "",
  legalBasis: "" as string,
  dataSubjects: "",
};

export function NewActivityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("pages.dataInventory");
  const tCommon = useTranslations("common");
  const { organization } = useOrganization();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [activityForm, setActivityForm] = useState(INITIAL_ACTIVITY_FORM);
  const activityLock = useSubmitLock();

  const createActivity = trpc.dataInventory.createActivity.useMutation({
    onSuccess: (activity) => {
      utils.dataInventory.listActivities.invalidate();
      onOpenChange(false);
      setActivityForm(INITIAL_ACTIVITY_FORM);
      router.push(`/privacy/data-inventory/activities/${activity.id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("activityDialog.title")}</DialogTitle>
          <DialogDescription>{t("activityDialog.description")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!activityForm.name || !activityForm.purpose || !activityForm.legalBasis) return;
            if (!activityLock.acquire()) return;
            createActivity.mutate(
              {
                organizationId: organization?.id ?? "",
                name: activityForm.name,
                purpose: activityForm.purpose,
                legalBasis: activityForm.legalBasis as (typeof LEGAL_BASIS_KEYS)[number],
                dataSubjects: activityForm.dataSubjects
                  ? activityForm.dataSubjects.split(",").map((s) => s.trim()).filter(Boolean)
                  : [],
                categories: [],
              },
              { onSettled: activityLock.release }
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="activity-name">{t("activityDialog.nameLabel")}</Label>
            <Input
              id="activity-name"
              placeholder={t("activityDialog.namePlaceholder")}
              value={activityForm.name}
              onChange={(e) => setActivityForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-purpose">{t("activityDialog.purposeLabel")}</Label>
            <Input
              id="activity-purpose"
              placeholder={t("activityDialog.purposePlaceholder")}
              value={activityForm.purpose}
              onChange={(e) => setActivityForm((f) => ({ ...f, purpose: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("activityDialog.legalBasisLabel")}</Label>
            <Select
              value={activityForm.legalBasis}
              onValueChange={(v) => setActivityForm((f) => ({ ...f, legalBasis: v }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder={t("activityDialog.legalBasisPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_BASIS_KEYS.map((value) => (
                  <SelectItem key={value} value={value}>{t(`legalBasis.${value}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-subjects">{t("activityDialog.subjectsLabel")}</Label>
            <Input
              id="activity-subjects"
              placeholder={t("activityDialog.subjectsPlaceholder")}
              value={activityForm.dataSubjects}
              onChange={(e) => setActivityForm((f) => ({ ...f, dataSubjects: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">{t("activityDialog.subjectsHelp")}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={createActivity.isPending || !activityForm.name || !activityForm.purpose || !activityForm.legalBasis}
            >
              {createActivity.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("addActivity")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

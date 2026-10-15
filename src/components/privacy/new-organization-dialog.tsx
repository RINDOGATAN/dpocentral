"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one "new organisation" dialog: a blank client with only a name. Opened
 * from the left menu's organisation switcher ("New organization" or "Add a
 * client") and by "Add a client" on All clients. Starting a client from
 * another one is a different dialog (copy-from-client-dialog.tsx).
 *
 * On the hosted service it asks for the data processing agreement, as the
 * first-run screen does, and an account that already has the most
 * organisations it may have (ORGANIZATIONS_PER_ACCOUNT) reads the reason
 * instead of the form. The server enforces both either way.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { organizationSlug } from "@/lib/organization-slug";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";
import { DpaAcceptCheckbox } from "@/components/pilot/dpa-accept";

export { organizationSlug };

export function NewOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the new organisation is created and made current. */
  onCreated?: () => void;
}) {
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.dashboard");
  const tCommon = useTranslations("common");
  const { setOrganization, refetchOrganizations } = useOrganization();
  const [name, setName] = useState("");
  const hosted = useHostedPilot();
  const [acceptDpa, setAcceptDpa] = useState(false);
  const capacity = trpc.organization.capacity.useQuery(undefined, { enabled: open && hosted });
  const atLimit = hosted && capacity.data?.limited === true && !capacity.data.canAdd;

  const createOrg = trpc.organization.create.useMutation({
    onSuccess: (org) => {
      setOrganization(org);
      refetchOrganizations();
      onOpenChange(false);
      setName("");
      setAcceptDpa(false);
      void capacity.refetch();
      toast.success(t("organization.created", { name: org.name }));
      onCreated?.();
    },
    onError: (err) => {
      toast.error(err.message || t("generic.somethingWentWrong"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (hosted && !acceptDpa)) return;
    createOrg.mutate({
      name: name.trim(),
      slug: organizationSlug(name),
      acceptDpa: hosted ? acceptDpa : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tp("newOrgDialog.title")}</DialogTitle>
        </DialogHeader>
        {atLimit ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="organization-limit">
              {capacity.data?.message}
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {tCommon("close")}
              </Button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-org-name">{tp("newOrgDialog.nameLabel")}</Label>
            <Input
              id="new-org-name"
              placeholder={tp("newOrgDialog.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          {hosted && (
            <DpaAcceptCheckbox id="new-org-accept-dpa" checked={acceptDpa} onCheckedChange={setAcceptDpa} />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={createOrg.isPending || !name.trim() || (hosted && !acceptDpa)}>
              {createOrg.isPending ? tp("newOrgDialog.creating") : tp("newOrgDialog.create")}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

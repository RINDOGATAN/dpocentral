"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one "new organisation" dialog: a blank client with only a name. Opened
 * from the left menu's organisation switcher ("New organization" or "Add a
 * client") and by "Add a client" on All clients. Starting a client from
 * another one is a different dialog (copy-from-client-dialog.tsx).
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

export function organizationSlug(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

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

  const createOrg = trpc.organization.create.useMutation({
    onSuccess: (org) => {
      setOrganization(org);
      refetchOrganizations();
      onOpenChange(false);
      setName("");
      toast.success(t("organization.created", { name: org.name }));
      onCreated?.();
    },
    onError: (err) => {
      toast.error(err.message || t("generic.somethingWentWrong"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createOrg.mutate({ name: name.trim(), slug: organizationSlug(name) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tp("newOrgDialog.title")}</DialogTitle>
        </DialogHeader>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={createOrg.isPending || !name.trim()}>
              {createOrg.isPending ? tp("newOrgDialog.creating") : tp("newOrgDialog.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

/**
 * "All clients": delete one client organisation from its row's menu.
 *
 * The same deletion as Settings (organizationDeletion router, owner of that
 * organisation only; the server checks the role, the plan and the typed name
 * again). Only that organisation goes. When it was the one open, the app
 * switches to another remaining organisation (organizationAfterDeletion).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { organizationAfterDeletion } from "@/lib/organization-after-deletion";
import { confirmsName } from "@/lib/confirm-name";

export function DeleteClientDialog({
  client,
  onOpenChange,
}: {
  /** The client to delete; null closes the dialog. */
  client: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!client} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" data-testid="delete-client-dialog">
        {/* Keyed by the client so the typed name never carries over to another row. */}
        {client && <DeleteClientBody key={client.id} client={client} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function DeleteClientBody({ client, onClose }: { client: { id: string; name: string }; onClose: () => void }) {
  const t = useTranslations("portfolio.delete");
  const ts = useTranslations("pages.settings.deleteOrganization");
  const [typed, setTyped] = useState("");
  const { organization, organizations, setOrganization, refetchOrganizations } = useOrganization();
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.organizationDeletion.status.useQuery({ organizationId: client.id });

  const isCurrent = organization?.id === client.id;
  const othersRemain = organizations.some((o) => o.id !== client.id);

  const del = trpc.organizationDeletion.delete.useMutation({
    onSuccess: () => {
      toast.success(t("deleted", { name: client.name }));
      const next = organizationAfterDeletion(organizations, client.id, organization?.id);
      if (next.kind === "none") {
        try {
          localStorage.removeItem("currentOrganizationId");
        } catch {
          // Storage may be unavailable; the next page finds no organisation either way.
        }
        window.location.href = "/privacy";
        return;
      }
      if (next.kind === "switch") setOrganization(next.to);
      refetchOrganizations();
      void utils.clients.listClients.invalidate();
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const name = status?.name ?? client.name;
  const matches = confirmsName(typed, name);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title", { name })}</DialogTitle>
        <DialogDescription>{t("intro")}</DialogDescription>
      </DialogHeader>

      {isLoading || !status ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {t("loading")}
        </p>
      ) : !status.canDelete ? (
        <div className="space-y-3">
          <p className="text-sm" data-testid="delete-client-blocked">
            {status.reason === "dsar-module" ? ts("dsarModule") : ts("paidPlan")}
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>{t("whatGoes")}</li>
            <li>{t("whatStays")}</li>
            <li>{t("accounts")}</li>
            {status.planContinues && <li>{ts("planContinues")}</li>}
            <li className="font-medium">{ts("noUndo")}</li>
            {status.hosted && <li>{ts("backups")}</li>}
          </ul>
          {isCurrent && othersRemain && (
            <p className="text-sm" data-testid="delete-client-current">
              {t("current")}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t("exportFirst")}</p>
          <div className="space-y-1">
            <Label htmlFor="delete-client-confirm">{t("confirmLabel", { name })}</Label>
            <Input
              id="delete-client-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" disabled={del.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!matches || del.isPending}
              onClick={() => del.mutate({ organizationId: client.id, confirmName: typed })}
            >
              {t("confirm")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

/**
 * Settings: the owner deletes the organisation open now (DPA clause 13), and
 * only that one: the account and the person's other organisations stay.
 * Shown to the owner only; the server checks the role, the plan and the typed
 * name again (src/server/routers/privacy/organizationDeletion.ts). With more
 * than one organisation, the card points to "All clients", where any client
 * can be deleted from its row. After the deletion the saved choice is
 * cleared and the app reloads on another remaining organisation.
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { confirmsName } from "@/lib/confirm-name";

export function DeleteOrganizationCard({
  organizationId,
  showClientsLink = false,
}: {
  organizationId: string;
  /** The person has other organisations: point to "All clients". */
  showClientsLink?: boolean;
}) {
  const t = useTranslations("pages.settings.deleteOrganization");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { data: status } = trpc.organizationDeletion.status.useQuery({ organizationId });
  const del = trpc.organizationDeletion.delete.useMutation({
    onSuccess: () => {
      try {
        localStorage.removeItem("currentOrganizationId");
      } catch {
        // Storage may be unavailable; the next page picks another organisation.
      }
      toast.success(t("deleted"));
      window.location.href = "/privacy";
    },
    onError: (error) => toast.error(error.message),
  });

  if (!status) return null;
  const matches = confirmsName(typed, status.name);

  return (
    <Card className="border-destructive/40" data-testid="delete-organization-card">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description", { name: status.name })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {showClientsLink && (
          <p className="text-sm" data-testid="delete-organization-clients-link">
            {t.rich("otherClients", {
              link: (chunks) => (
                <Link href="/privacy/clients" className="text-primary underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
        {!status.canDelete ? (
          <p className="text-sm text-muted-foreground" data-testid="delete-organization-paid">
            {status.reason === "dsar-module" ? t("dsarModule") : t("paidPlan")}
          </p>
        ) : !open ? (
          <Button variant="destructive" onClick={() => setOpen(true)}>
            {t("start")}
          </Button>
        ) : (
          <div className="space-y-3">
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>{t("whatGoes")}</li>
              <li>{t("whatStays")}</li>
              <li>{t("accounts")}</li>
              {status.planContinues && <li>{t("planContinues")}</li>}
              <li className="font-medium">{t("noUndo")}</li>
              {status.hosted && <li>{t("backups")}</li>}
            </ul>
            <p className="text-sm">{t("exportFirst")}</p>
            <div className="space-y-1">
              <Label htmlFor="delete-org-confirm">{t("confirmLabel", { name: status.name })}</Label>
              <Input
                id="delete-org-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                disabled={!matches || del.isPending}
                onClick={() => del.mutate({ organizationId, confirmName: typed })}
              >
                {t("confirm")}
              </Button>
              <Button
                variant="outline"
                disabled={del.isPending}
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

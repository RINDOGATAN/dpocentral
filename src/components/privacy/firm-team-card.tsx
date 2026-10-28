"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings: the firm team of the signed-in account (firmTeam router). People
 * added here are members, with the chosen role, of every client organisation
 * the account manages, including clients added later. Shown to privacy
 * professional accounts, and to any account that still has people in its
 * firm team (so they can be removed). Every rule is enforced on the server.
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import type { OrganizationRole } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailNotAcceptedNote, isEmailNotAcceptedError } from "@/components/ui/email-not-accepted";
import { useEnumLabels } from "@/lib/enum-labels";
import { formatDateIn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

/** Never OWNER (src/server/services/members/firm-team.ts). */
const FIRM_ROLES: OrganizationRole[] = ["ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"];
const DEFAULT_ROLE: OrganizationRole = "PRIVACY_OFFICER";

export function FirmTeamCard() {
  const t = useTranslations("firmTeam");
  const locale = useLocale();
  const { label: enumLabel } = useEnumLabels();
  const utils = trpc.useUtils();
  const { data } = trpc.firmTeam.list.useQuery();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(DEFAULT_ROLE);
  const [toRemove, setToRemove] = useState<{ id: string; name: string } | null>(null);

  const refresh = () => {
    void utils.firmTeam.list.invalidate();
    void utils.organization.getById.invalidate();
    void utils.organization.list.invalidate();
  };

  const add = trpc.firmTeam.add.useMutation({
    onSuccess: (result, vars) => {
      if (result.pending) {
        if (result.emailSent) toast.success(t("invitedSent", { email: vars.email }));
        else toast.info(t("invitedNoEmail", { url: result.signInUrl ?? "" }), { duration: 15000 });
      } else {
        toast.success(t("added", { count: result.joined }));
      }
      setEmail("");
      setRole(DEFAULT_ROLE);
      refresh();
    },
    onError: (e) => {
      if (!isEmailNotAcceptedError(e)) toast.error(e.message);
    },
  });
  const updateRole = trpc.firmTeam.updateRole.useMutation({
    onSuccess: () => {
      toast.success(t("roleUpdated"));
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.firmTeam.remove.useMutation({
    onSuccess: () => {
      toast.success(t("removed"));
      setToRemove(null);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  // Reached from "All clients" (/privacy/settings#firm-team): the card renders
  // once its data arrives, after the browser has looked for the anchor.
  const shown = !!data && (data.available || data.members.length > 0);
  useEffect(() => {
    if (!shown || typeof window === "undefined" || window.location.hash !== "#firm-team") return;
    // After the cards above have settled, so the card stays in view.
    const timer = window.setTimeout(
      () => document.getElementById("firm-team")?.scrollIntoView({ block: "start" }),
      400
    );
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (!data || !shown) return null;

  return (
    <Card id="firm-team" className="scroll-mt-20" data-testid="firm-team-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" aria-hidden="true" /> {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.available && (
          <div className="space-y-2 pb-3 border-b">
            <Label htmlFor="firm-team-email">{t("addLabel")}</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="firm-team-email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (add.error) add.reset();
                }}
                className="flex-1"
              />
              <Select value={role} onValueChange={(v) => setRole(v as OrganizationRole)}>
                <SelectTrigger className="sm:w-56" aria-label={t("roleLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIRM_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {enumLabel("role", r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => add.mutate({ email: email.trim(), role })}
                disabled={add.isPending || !email.trim()}
              >
                {add.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {t("add")}
              </Button>
            </div>
            <EmailNotAcceptedNote show={isEmailNotAcceptedError(add.error)} />
            <p className="text-xs text-muted-foreground">{t("addHelp")}</p>
          </div>
        )}

        {data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="space-y-2">
            {data.members.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-2 p-2 rounded-md border ${m.pending ? "border-dashed" : ""}`}
                data-testid="firm-team-member"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.name ? `${m.email} · ` : ""}
                    {m.pending
                      ? t("pendingSince", { date: formatDateIn(new Date(m.invitedAt), locale) })
                      : t("inClients", { joined: m.clientsJoined, total: data.clients })}
                  </p>
                </div>
                <Select
                  value={m.role}
                  onValueChange={(v) => updateRole.mutate({ id: m.id, role: v as OrganizationRole })}
                  disabled={updateRole.isPending || !data.available}
                >
                  <SelectTrigger className="w-40 sm:w-56" aria-label={t("roleFor", { name: m.name || m.email })}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIRM_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {enumLabel("role", r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeAria", { name: m.name || m.email })}
                  onClick={() => setToRemove({ id: m.id, name: m.name || m.email })}
                  disabled={remove.isPending}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {data.members.some((m) => !m.pending && m.clientsJoined < data.clients) && (
          <p className="text-xs text-muted-foreground" data-testid="firm-team-partial">
            {t("partialNote")}
          </p>
        )}
        <div>
          <Badge variant="outline" className="text-xs font-normal">
            {t("clientsCount", { count: data.clients })}
          </Badge>
        </div>
      </CardContent>

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(open) => !open && setToRemove(null)}
        title={t("removeConfirmTitle", { name: toRemove?.name ?? "" })}
        description={t("removeConfirmDescription")}
        confirmText={t("removeConfirm")}
        danger
        pending={remove.isPending}
        onConfirm={() => toRemove && remove.mutate({ id: toRemove.id })}
      />
    </Card>
  );
}

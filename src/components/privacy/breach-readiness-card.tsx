"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Step 5's readiness confirmation, at the top of the breach register: the
 * notification deadlines of each declared law (src/config/breach-readiness.ts,
 * rendered in the reader's language), the assess-first acknowledgement, the
 * internal contact, the authority and where the register is kept. Confirming
 * completes step 5 and appears in the board report; changing the declared
 * laws asks for it again.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { formatDateIn } from "@/lib/utils";
import { readinessLaws, type ReadinessLocale } from "@/config/breach-readiness";
import { withStepDone } from "@/components/guided/path";

export function BreachReadinessCard({ organizationId, canConfirm }: { organizationId: string; canConfirm: boolean }) {
  const t = useTranslations("breachReadiness");
  const locale = (useLocale() === "es" ? "es" : "en") as ReadinessLocale;
  const utils = trpc.useUtils();
  const { data } = trpc.breachReadiness.get.useQuery({ organizationId }, { enabled: !!organizationId });

  const laws = useMemo(() => readinessLaws(data?.declared ?? [], locale), [data?.declared, locale]);
  const defaultAuthority = useMemo(
    () => [...new Set(laws.map((l) => l.authorityName).filter(Boolean))].join("; "),
    [laws],
  );
  const defaultRegister = t("registerDefault");

  const [editing, setEditing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [contact, setContact] = useState("");
  const [authority, setAuthority] = useState("");
  const [register, setRegister] = useState("");

  useEffect(() => {
    setContact(data?.record?.contact ?? "");
    setAuthority(data?.record?.authority ?? defaultAuthority);
    setRegister(data?.record?.register ?? defaultRegister);
  }, [data?.record, defaultAuthority, defaultRegister]);

  const confirm = trpc.breachReadiness.confirm.useMutation({
    onSuccess: async () => {
      toast.success(t("saved"));
      setEditing(false);
      setAcknowledged(false);
      // The confirmation completes step 5 (path-config.ts, "incidents"): show
      // it in the menu and the figure now, not after the refetch below, which
      // asks for every query on the page in one batch and then corrects this
      // if the server reads it otherwise.
      utils.programPath.status.setData({ organizationId }, (old) =>
        old ? { ...old, steps: withStepDone(old.steps, "incidents") } : old,
      );
      await utils.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!data) return null;
  const record = data.record;
  const showForm = canConfirm && (!data.current || editing);

  return (
    <Card className="mb-6" data-testid="breach-readiness">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 mt-0.5 text-primary shrink-0" />
          <div className="space-y-1">
            <h2 className="font-semibold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("intro")}</p>
          </div>
        </div>

        {record && data.current && !editing && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/40 p-3">
            <p className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              {t("confirmedOn", {
                date: formatDateIn(record.confirmedAt, locale),
                name: data.confirmedByName ?? "",
              })}
            </p>
            {canConfirm && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                {t("review")}
              </Button>
            )}
          </div>
        )}
        {record && !data.current && (
          <p className="text-sm rounded-md border p-3" data-testid="breach-readiness-stale">
            {t("stale", { date: formatDateIn(record.confirmedAt, locale) })}
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("deadlinesTitle")}</h3>
          {laws.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noLaws")}{" "}
              <Link href="/privacy/regulations" className="underline underline-offset-4 text-primary">
                {t("noLawsLink")}
              </Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {laws.map((law) => (
                <li key={law.code} className="text-sm rounded-md border p-3 space-y-1" data-verified={law.verified}>
                  <p className="font-medium">{law.name}</p>
                  <p>
                    <span className="text-muted-foreground">{t("toAuthority")} </span>
                    {law.authority}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("toIndividuals")} </span>
                    {law.individuals}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showForm ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!acknowledged || !contact.trim()) return;
              confirm.mutate({
                organizationId,
                contact: contact.trim(),
                authority: authority.trim() && authority.trim() !== defaultAuthority ? authority.trim() : null,
                register: register.trim() && register.trim() !== defaultRegister ? register.trim() : null,
                acknowledged: true,
              });
            }}
          >
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(v === true)}
                aria-label={t("assessFirst")}
                className="mt-0.5"
              />
              <span>{t("assessFirst")}</span>
            </label>
            <div className="space-y-1">
              <Label htmlFor="readiness-contact">{t("contactLabel")}</Label>
              <Input
                id="readiness-contact"
                value={contact}
                maxLength={300}
                placeholder={t("contactPlaceholder")}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="readiness-authority">{t("authorityLabel")}</Label>
              <Input id="readiness-authority" value={authority} maxLength={300} onChange={(e) => setAuthority(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="readiness-register">{t("registerLabel")}</Label>
              <Input id="readiness-register" value={register} maxLength={300} onChange={(e) => setRegister(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!acknowledged || !contact.trim() || confirm.isPending}>
                {confirm.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {record ? t("reconfirm") : t("confirm")}
              </Button>
              {editing && (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  {t("cancel")}
                </Button>
              )}
            </div>
          </form>
        ) : (
          !canConfirm &&
          !data.current && <p className="text-sm text-muted-foreground">{t("officersOnly")}</p>
        )}
      </CardContent>
    </Card>
  );
}

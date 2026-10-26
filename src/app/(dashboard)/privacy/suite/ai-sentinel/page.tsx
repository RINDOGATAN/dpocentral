// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

/**
 * "Start from DPO Central": reached from AI Sentinel's first run
 * (?aisOrg=<AI Sentinel organisation>&return=<AI Sentinel page>). The person
 * picks the DPO Central organisation to start from; its AI vendors, AI
 * systems and the processing behind them go to AI Sentinel as drafts
 * (src/server/services/suite/link-ais.ts).
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/privacy/page-header";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { safeAiSentinelReturn } from "@/lib/suite-return";

export default function LinkAiSentinelPage() {
  const t = useTranslations("suite");
  const params = useSearchParams();
  const { organization } = useOrganization();
  const wantedAis = params.get("aisOrg") ?? "";
  const returnTo = safeAiSentinelReturn(params.get("return"));
  const { data, isLoading } = trpc.suite.options.useQuery();
  const [dpcChoice, setDpcChoice] = useState<string | null>(null);
  const [aisChoice, setAisChoice] = useState<string | null>(null);
  const [done, setDone] = useState<{ systems: number; vendors: number; back: number } | null>(null);
  const utils = trpc.useUtils();

  const dpcOrgs = useMemo(() => data?.dpc ?? [], [data]);
  const aisOrgs = useMemo(() => data?.ais ?? [], [data]);
  const dpcId =
    dpcChoice ??
    (dpcOrgs.find((o) => o.id === organization?.id && !o.linkedTo)?.id ?? dpcOrgs.find((o) => !o.linkedTo)?.id ?? null);
  const aisId = aisChoice ?? (aisOrgs.find((o) => o.id === wantedAis)?.id ?? (aisOrgs.length === 1 ? aisOrgs[0].id : null));
  const aisTarget = aisOrgs.find((o) => o.id === aisId);
  const takenElsewhere = !!aisTarget?.linkedTo && aisTarget.linkedTo !== dpcId;

  const link = trpc.suite.link.useMutation({
    onSuccess: (out) => {
      setDone({
        systems: out.created?.systems ?? 0,
        vendors: out.created?.vendors ?? 0,
        back: out.back && "createdSystems" in out.back ? (out.back.createdSystems ?? 0) : 0,
      });
      void utils.suite.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t("pageTitle")} description={t("pageLead")} />

      {isLoading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("loading")}
        </p>
      )}

      {data && !data.configured && (
        <Card>
          <CardContent className="p-4 text-sm">{t("notConnected")}</CardContent>
        </Card>
      )}

      {data?.configured && data.error && (
        <Card>
          <CardContent className="p-4 text-sm">{t("aisError", { error: data.error })}</CardContent>
        </Card>
      )}

      {done ? (
        <Card data-testid="suite-link-done">
          <CardContent className="p-5 space-y-3">
            <p className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {t("doneTitle")}
            </p>
            <p className="text-sm">{t("doneBody", { systems: done.systems, vendors: done.vendors })}</p>
            {done.back > 0 && <p className="text-sm">{t("doneBack", { count: done.back })}</p>}
            {returnTo && (
              <Button asChild>
                <a href={returnTo}>{t("backToAis")}</a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        data?.configured &&
        !data.error && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("chooseDpc")}</CardTitle>
                <CardDescription>{t("chooseDpcHelp")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dpcOrgs.length === 0 && <p className="text-sm text-muted-foreground">{t("noDpcOrgs")}</p>}
                {dpcOrgs.map((o) => (
                  <label key={o.id} className="flex items-center gap-3 text-sm cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="dpc-org"
                      checked={dpcId === o.id}
                      disabled={!!o.linkedTo && o.linkedTo !== aisId}
                      onChange={() => setDpcChoice(o.id)}
                    />
                    <span>{o.name}</span>
                    {o.linkedTo && <span className="text-xs text-muted-foreground">{t("alreadyLinked")}</span>}
                  </label>
                ))}
              </CardContent>
            </Card>

            {aisOrgs.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("chooseAis")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {aisOrgs.map((o) => (
                    <label key={o.id} className="flex items-center gap-3 text-sm cursor-pointer min-h-11">
                      <input type="radio" name="ais-org" checked={aisId === o.id} onChange={() => setAisChoice(o.id)} />
                      <span>{o.name}</span>
                      {o.linkedTo && <span className="text-xs text-muted-foreground">{t("alreadyLinked")}</span>}
                    </label>
                  ))}
                </CardContent>
              </Card>
            )}
            {aisOrgs.length === 0 && (
              <Card>
                <CardContent className="p-4 text-sm">{t("noAisOrgs")}</CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("whatTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>{t("what1")}</li>
                  <li>{t("what2")}</li>
                  <li>{t("what3")}</li>
                  <li>{t("what4")}</li>
                  <li>{t("what5")}</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-3">{t("whatNote")}</p>
              </CardContent>
            </Card>

            {takenElsewhere && <p className="text-sm">{t("takenElsewhere")}</p>}

            <Button
              disabled={!dpcId || !aisId || takenElsewhere || link.isPending}
              onClick={() => dpcId && aisId && link.mutate({ organizationId: dpcId, aisOrganizationId: aisId })}
            >
              {link.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              {t("linkButton")}
            </Button>
          </>
        )
      )}
    </div>
  );
}

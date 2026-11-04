"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The controller block of the record of processing (GDPR Art. 30(1)(a) and
 * (g)): who the controller is and how to reach it, its data protection
 * officer, its representative in the Union, and the general description of
 * security measures. Printed on the cover of every record export.
 *
 * Where a field is empty the form shows what the export will print instead
 * (the organisation's name, the rights-request form's contact address).
 * Privacy officers, admins and owners edit it; everyone else reads it.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type Field =
  | "controllerLegalName"
  | "controllerTaxId"
  | "controllerAddress"
  | "controllerEmail"
  | "controllerPhone"
  | "dpoName"
  | "dpoContact"
  | "euRepresentativeName"
  | "euRepresentativeContact"
  | "securityMeasures";

const GROUPS: Array<{ title: "controller" | "dpo" | "representative" | "security"; fields: Field[] }> = [
  {
    title: "controller",
    fields: ["controllerLegalName", "controllerTaxId", "controllerAddress", "controllerEmail", "controllerPhone"],
  },
  { title: "dpo", fields: ["dpoName", "dpoContact"] },
  { title: "representative", fields: ["euRepresentativeName", "euRepresentativeContact"] },
  { title: "security", fields: ["securityMeasures"] },
];

const MULTILINE: ReadonlySet<Field> = new Set(["controllerAddress", "dpoContact", "euRepresentativeContact", "securityMeasures"]);

const EMPTY: Record<Field, string> = {
  controllerLegalName: "",
  controllerTaxId: "",
  controllerAddress: "",
  controllerEmail: "",
  controllerPhone: "",
  dpoName: "",
  dpoContact: "",
  euRepresentativeName: "",
  euRepresentativeContact: "",
  securityMeasures: "",
};

export function ControllerDetailsCard({ organizationId, canEdit }: { organizationId: string; canEdit: boolean }) {
  const t = useTranslations("controllerDetails");
  const utils = trpc.useUtils();
  const { data } = trpc.recordOfProcessing.getControllerDetails.useQuery({ organizationId }, { enabled: !!organizationId });
  // Only what the person has changed is held here; everything else reads
  // from the server (the stored value, or what the export would print).
  const [edits, setEdits] = useState<Partial<Record<Field, string>>>({});
  const dirty = Object.keys(edits).length > 0;

  // What the export prints when the field is left empty: the form starts
  // from it, so it can be checked and saved.
  const fallback = (f: Field): string | null => {
    if (f === "controllerLegalName") return data?.known.orgName || null;
    if (f === "controllerEmail") return data?.known.contactEmail || null;
    return null;
  };
  const initial = (f: Field): string => data?.stored[f] ?? fallback(f) ?? "";
  const form = Object.fromEntries(
    (Object.keys(EMPTY) as Field[]).map((f) => [f, edits[f] ?? initial(f)]),
  ) as Record<Field, string>;

  const save = trpc.recordOfProcessing.updateControllerDetails.useMutation({
    onSuccess: async () => {
      toast.success(t("saved"));
      setEdits({});
      await utils.recordOfProcessing.getControllerDetails.invalidate({ organizationId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card id="controller-details">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {GROUPS.map((g) => (
          <div key={g.title} className="space-y-3">
            <h4 className="text-sm font-medium">{t(`groups.${g.title}`)}</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {g.fields.map((f) => {
                const id = `controller-${f}`;
                const fb = fallback(f);
                const common = {
                  id,
                  value: form[f],
                  disabled: !canEdit,
                  placeholder: t(`placeholders.${f}`),
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    setEdits({ ...edits, [f]: e.target.value });
                  },
                };
                return (
                  <div key={f} className={MULTILINE.has(f) ? "space-y-2 md:col-span-2" : "space-y-2"}>
                    <Label htmlFor={id}>{t(`fields.${f}`)}</Label>
                    {MULTILINE.has(f) ? (
                      <Textarea rows={f === "securityMeasures" ? 5 : 2} maxLength={5000} {...common} />
                    ) : (
                      <Input maxLength={300} {...common} />
                    )}
                    {fb && data?.stored[f] == null && form[f] === fb && <p className="text-xs text-muted-foreground">{t("prefilled")}</p>}
                    {f === "securityMeasures" && <p className="text-xs text-muted-foreground">{t("securityHelp")}</p>}
                    {f === "euRepresentativeName" && (
                      <p className="text-xs text-muted-foreground">{t("representativeHelp")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {canEdit && dirty && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEdits({})}
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  organizationId,
                  ...(Object.fromEntries((Object.keys(EMPTY) as Field[]).map((f) => [f, form[f].trim() || null])) as Record<
                    Field,
                    string | null
                  >),
                })
              }
            >
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

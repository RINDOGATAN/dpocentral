"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Start from another client" (directive stage 2b). One dialog, two ways in:
 *
 *  - from the quick start, into the client open now: choose the client to copy
 *    from ("current");
 *  - from the portfolio row menu, "Start a new client from this one": the row's
 *    client is the source, and the dialog creates the new one
 *    (organization.create, the same path as adding a client) before copying
 *    into it ("new").
 *
 * Choose what to copy with plain checkboxes and counts; see every flag the
 * scrub raised before anything is written, and say you have seen them. After
 * the copy the flagged items are listed again. The rules are in
 * src/config/client-template.ts.
 */

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { slugify } from "@/lib/utils";
import { useOrganization } from "@/lib/organization-context";
import {
  COPY_PARTS,
  DEFAULT_PARTS,
  PART_REQUIRES,
  effectiveParts,
  type CopyPart,
} from "@/config/client-template";

/** Where a flagged item opens in the new client, by part. */
const ITEM_HREF: Record<CopyPart, ((id: string) => string) | null> = {
  jurisdictions: null,
  dataAssets: null,
  processingActivities: null,
  vendors: (id) => `/privacy/vendors/${id}`,
  assessmentTemplates: null,
  dsarIntake: null,
};

type Result = {
  counts: Record<CopyPart, number>;
  flagged: { part: CopyPart; title: string; id: string | null }[];
  target: { id: string; name: string; slug: string };
};

export function CopyFromClientDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `current`: copy into the client open now, choosing the source.
   * `new`: copy the given client into a new one, named here.
   */
  mode: { kind: "current" } | { kind: "new"; source: { id: string; name: string } };
}) {
  const t = useTranslations("clientTemplate");
  const tc = useTranslations("common");
  const router = useRouter();
  const utils = trpc.useUtils();
  const { organization, setOrganization, refetchOrganizations } = useOrganization();

  const [chosenSource, setChosenSource] = useState<string>("");
  const [parts, setParts] = useState<CopyPart[]>([...DEFAULT_PARTS]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [newName, setNewName] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  // The new client, once created: a retry after a failed copy reuses it
  // rather than creating a second one.
  const [created, setCreated] = useState<Result["target"] | null>(null);

  const intoNew = mode.kind === "new";
  const sourceId = intoNew ? mode.source.id : chosenSource;
  const targetName = intoNew ? newName.trim() : (organization?.name ?? "");
  const deferredName = useDeferredValue(targetName);

  const { data: sources, isLoading: sourcesLoading } = trpc.clientTemplate.sources.useQuery(
    { excludeOrganizationId: intoNew ? undefined : organization?.id },
    { enabled: open && !intoNew },
  );

  // One preview with every part: the counts beside each checkbox, and the
  // flags, which are then narrowed to what is ticked.
  const { data: preview, isFetching: previewLoading } = trpc.clientTemplate.preview.useQuery(
    {
      sourceOrganizationId: sourceId,
      targetOrganizationId: intoNew ? undefined : organization?.id,
      targetName: deferredName || "-",
      parts: [...COPY_PARTS],
    },
    { enabled: open && !!sourceId && !result, placeholderData: (prev) => prev },
  );

  const chosen = useMemo(() => effectiveParts(parts), [parts]);
  const flagged = (preview?.flagged ?? []).filter((f) => chosen.includes(f.part));
  const total = chosen.reduce((n, p) => n + (preview?.counts[p] ?? 0), 0);

  const reset = () => {
    setChosenSource("");
    setParts([...DEFAULT_PARTS]);
    setAcknowledged(false);
    setNewName("");
    setResult(null);
    setCreated(null);
  };
  const close = () => {
    onOpenChange(false);
    reset();
  };

  const createOrg = trpc.organization.create.useMutation();
  const copy = trpc.clientTemplate.copy.useMutation();
  const busy = createOrg.isPending || copy.isPending;

  const run = async () => {
    try {
      let target: Result["target"] | null = null;
      if (intoNew) {
        target = created;
        if (!target) {
          // The server makes the slug unique; it is only an internal handle.
          const base = slugify(targetName);
          const org = await createOrg.mutateAsync({ name: targetName, slug: base.length >= 2 ? base : "client" });
          target = { id: org.id, name: org.name, slug: org.slug };
          setCreated(target);
          void utils.clients.listClients.invalidate();
        }
      } else {
        target = organization
          ? { id: organization.id, name: organization.name, slug: organization.slug }
          : null;
      }
      if (!target) return;
      const copied = await copy.mutateAsync({
        organizationId: target.id,
        sourceOrganizationId: sourceId,
        parts: chosen,
        acknowledgeFlags: acknowledged,
      });
      setResult({ ...copied, target });
      toast.success(t("done"));
      void utils.clients.listClients.invalidate();
      void utils.programPath.invalidate();
      void utils.dataInventory.invalidate();
      void utils.vendor.invalidate();
      void utils.assessment.invalidate();
      void utils.regulations.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failed"));
    }
  };

  const openTarget = () => {
    if (!result) return;
    setOrganization({ id: result.target.id, name: result.target.name, slug: result.target.slug });
    refetchOrganizations();
    close();
    router.push("/privacy");
  };

  const toggle = (part: CopyPart, on: boolean) =>
    setParts((prev) => (on ? [...new Set([...prev, part])] : prev.filter((p) => p !== part)));

  const canCopy =
    !!sourceId &&
    !!preview &&
    total > 0 &&
    (!intoNew || targetName.length > 0) &&
    (flagged.length === 0 || acknowledged) &&
    !busy;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{intoNew ? t("titleNew") : t("titleCurrent")}</DialogTitle>
          <DialogDescription>
            {intoNew ? t("descriptionNew", { source: mode.source.name }) : t("descriptionCurrent")}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm" role="status">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
              <span>{t("resultSummary", { client: result.target.name })}</span>
            </p>
            <ul className="text-sm space-y-1">
              {COPY_PARTS.filter((p) => result.counts[p] > 0).map((p) => (
                <li key={p} className="flex justify-between gap-3">
                  <span>{t(`parts.${p}.label`)}</span>
                  <span className="tabular-nums text-muted-foreground">{result.counts[p]}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t("resultStarted")}</p>
            {result.flagged.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("resultFlaggedTitle")}</p>
                <ul className="text-sm space-y-1">
                  {result.flagged.map((f, i) => {
                    const href = f.id ? ITEM_HREF[f.part]?.(f.id) : null;
                    const onTarget = result.target.id === organization?.id;
                    return (
                      <li key={`${f.part}-${i}`} className="min-w-0 break-words">
                        <span className="text-muted-foreground">{t(`parts.${f.part}.label`)}: </span>
                        {href && onTarget ? (
                          <Link href={href} className="text-primary hover:underline" onClick={close}>
                            {f.title}
                          </Link>
                        ) : (
                          f.title
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <DialogFooter>
              {result.target.id === organization?.id ? (
                <Button onClick={close}>{tc("close")}</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={close}>
                    {tc("close")}
                  </Button>
                  <Button onClick={openTarget}>{t("openClient", { client: result.target.name })}</Button>
                </>
              )}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            {intoNew ? (
              <div className="space-y-2">
                <Label htmlFor="copy-new-name">{t("newNameLabel")} *</Label>
                <Input
                  id="copy-new-name"
                  value={newName}
                  placeholder={t("newNamePlaceholder")}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="copy-source">{t("sourceLabel")}</Label>
                {sourcesLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("loading")} />
                ) : !sources || sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noSources")}</p>
                ) : (
                  <Select
                    value={chosenSource}
                    onValueChange={(v) => {
                      setChosenSource(v);
                      setAcknowledged(false);
                    }}
                  >
                    <SelectTrigger id="copy-source" className="w-full">
                      <SelectValue placeholder={t("sourcePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">{t("sourceHint")}</p>
              </div>
            )}

            {sourceId && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium mb-1">{t("partsLegend")}</legend>
                {COPY_PARTS.map((p) => {
                  const needs = PART_REQUIRES[p];
                  const blocked = !!needs && !parts.includes(needs);
                  const count = preview?.counts[p];
                  const skipped = preview?.skipped[p] ?? 0;
                  const editedSkip = p === "dsarIntake" && !!preview?.dsarIntakeSkippedEdited;
                  return (
                    <label
                      key={p}
                      className={`flex items-start gap-3 rounded-md p-2 -mx-2 ${blocked ? "opacity-60" : "cursor-pointer hover:bg-secondary/60"}`}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={parts.includes(p) && !blocked}
                        disabled={blocked || busy}
                        onCheckedChange={(v) => toggle(p, !!v)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-sm">{t(`parts.${p}.label`)}</span>
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                            {count === undefined ? "–" : count}
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {blocked && needs
                            ? t("needsPart", { part: t(`parts.${needs}.label`) })
                            : t(`parts.${p}.hint`)}
                          {editedSkip ? (
                            <> {t("dsarIntakeEdited")}</>
                          ) : (
                            skipped > 0 && <> {t("skipped", { count: skipped })}</>
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
                <p className="text-xs text-muted-foreground pt-1">{t("neverCopied")}</p>
              </fieldset>
            )}

            {sourceId && preview && flagged.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3 space-y-2" role="alert">
                <p className="flex items-start gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
                  {t("flagsTitle", { count: flagged.length })}
                </p>
                <p className="text-xs text-muted-foreground">{t("flagsHint")}</p>
                <ul className="text-xs space-y-1.5">
                  {flagged.map((f, i) => (
                    <li key={`${f.part}-${i}`} className="min-w-0 break-words">
                      <span className="font-medium">{f.title}</span>
                      <span className="text-muted-foreground"> ({t(`parts.${f.part}.label`)})</span>
                      {f.flags.slice(0, 3).map((flag, j) => (
                        <span key={j} className="block text-muted-foreground">
                          {flag.snippet}
                        </span>
                      ))}
                      {f.flags.length > 3 && (
                        <span className="block text-muted-foreground">{t("moreFlags", { count: f.flags.length - 3 })}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
                  <Checkbox
                    className="mt-0.5"
                    checked={acknowledged}
                    onCheckedChange={(v) => setAcknowledged(!!v)}
                  />
                  {t("flagsAcknowledge")}
                </label>
              </div>
            )}

            {sourceId && preview && <p className="text-xs text-muted-foreground">{t("summary", { count: total })}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={busy}>
                {tc("cancel")}
              </Button>
              <Button onClick={run} disabled={!canCopy}>
                {(busy || previewLoading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {intoNew ? t("submitNew") : t("submitCurrent")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

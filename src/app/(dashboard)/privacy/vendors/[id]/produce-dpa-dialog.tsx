"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Produce DPA + TIA" flow: the mapper's fact proposal is shown pre-filled
 * for human review and editing — facts become representations in a signable
 * document, so a person confirms every one before generation. §7
 * contradictions require an explicit tick. Generation stores a VendorContract
 * (type DPA, PENDING_SIGNATURE) whose PDFs re-render from the stored facts.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Download, FileText, Info, TriangleAlert } from "lucide-react";
// Pure §7 checks only — never import the engine barrel here: it would pull
// the whole contract pack's JSON into the client bundle.
import { checkFactConsistency } from "@/lib/dpa-engine/consistency";

type Localized = string | { [lang: string]: string };

interface PartyForm {
  name: string;
  address: string;
  taxId: string;
  signatoryName: string;
  signatoryTitle: string;
}

const EMPTY_PARTY: PartyForm = {
  name: "",
  address: "",
  taxId: "",
  signatoryName: "",
  signatoryTitle: "",
};

function partyInput(p: PartyForm) {
  return {
    name: p.name || undefined,
    address: p.address || undefined,
    taxId: p.taxId || undefined,
    signatoryName: p.signatoryName || undefined,
    signatoryTitle: p.signatoryTitle || undefined,
  };
}

export function ProduceDpaDialog({
  organizationId,
  vendorId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  vendorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("pages.vendorDetail.dpa");
  const tToast = useTranslations("toasts");
  const utils = trpc.useUtils();

  const localize = useMemo(
    () =>
      (value: Localized | undefined | null): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return value[locale] || value.en || Object.values(value)[0] || "";
      },
    [locale]
  );

  const prepare = trpc.vendor.prepareDpa.useQuery(
    { organizationId, vendorId },
    { enabled: open, staleTime: Infinity }
  );

  const [initialized, setInitialized] = useState(false);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<"en" | "es">(locale === "es" ? "es" : "en");
  const [governingLaw, setGoverningLaw] = useState<"CALIFORNIA" | "ENGLAND_WALES" | "SPAIN">("SPAIN");
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [dealName, setDealName] = useState("");
  const [controller, setController] = useState<PartyForm>(EMPTY_PARTY);
  const [processor, setProcessor] = useState<PartyForm>(EMPTY_PARTY);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<{
    dpaUrl: string;
    tiaUrl: string | null;
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setResult(null);
      setConfirmed({});
      return;
    }
    if (prepare.data && !initialized) {
      setFacts(prepare.data.facts);
      setSelections(prepare.data.selections);
      setGoverningLaw(prepare.data.governingLaw);
      setController({
        ...EMPTY_PARTY,
        name: prepare.data.organization.name,
      });
      setProcessor({
        ...EMPTY_PARTY,
        name: prepare.data.vendor.name,
        address: prepare.data.vendor.address ?? "",
      });
      setInitialized(true);
    }
  }, [open, prepare.data, initialized]);

  const generate = trpc.vendor.generateDpa.useMutation({
    onSuccess: (data) => {
      toast.success(tToast("dpaGenerated"));
      setResult({ dpaUrl: data.dpaUrl, tiaUrl: data.tiaUrl, warnings: data.warnings });
      utils.vendor.getById.invalidate({ organizationId, id: vendorId });
    },
    onError: (err) => toast.error(err.message),
  });

  const issues = useMemo(() => checkFactConsistency(facts), [facts]);
  const allConfirmed = issues.every((i) => confirmed[i.code]);
  const catalog = prepare.data?.catalog;
  const requiredMissing = (catalog?.parameters ?? [])
    .filter((p) => p.required)
    .some((p) => !(facts[p.id] ?? "").trim());

  const setFact = (id: string, value: string) =>
    setFacts((prev) => ({ ...prev, [id]: value }));

  const toggleMulti = (id: string, key: string) =>
    setFacts((prev) => {
      const current = (prev[id] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, [id]: next.join(",") };
    });

  const onGenerate = () =>
    generate.mutate({
      organizationId,
      vendorId,
      language,
      effectiveDate: new Date(effectiveDate),
      dealName: dealName || undefined,
      governingLaw,
      facts,
      selections,
      controller: partyInput(controller),
      processor: partyInput(processor),
      confirmedIssues: issues.filter((i) => confirmed[i.code]).map((i) => i.code),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <p className="text-sm">{t("successBody")}</p>
            {result.warnings.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-1">
                <p className="font-medium flex items-center gap-2">
                  <TriangleAlert className="w-4 h-4" /> {t("warningsTitle")}
                </p>
                {result.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={result.dpaUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" /> {t("downloadDpa")}
                </a>
              </Button>
              {result.tiaUrl && (
                <Button variant="outline" asChild>
                  <a href={result.tiaUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" /> {t("downloadTia")}
                  </a>
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("close")}
              </Button>
            </DialogFooter>
          </div>
        ) : prepare.isLoading || !catalog ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="space-y-6 py-2">
            {prepare.data!.notes.length > 0 && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
                <p className="font-medium flex items-center gap-2">
                  <Info className="w-4 h-4" /> {t("notesTitle")}
                </p>
                {prepare.data!.notes.map((n, i) => (
                  <p key={i} className="text-muted-foreground">
                    {n}
                  </p>
                ))}
              </div>
            )}

            {/* ── Agreement settings & parties ── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("sectionAgreement")}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("languageLabel")}</Label>
                  <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "es")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("effectiveDateLabel")}</Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("governingLawLabel")}</Label>
                  <Select
                    value={governingLaw}
                    onValueChange={(v) => setGoverningLaw(v as typeof governingLaw)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPAIN">{t("law.SPAIN")}</SelectItem>
                      <SelectItem value="ENGLAND_WALES">{t("law.ENGLAND_WALES")}</SelectItem>
                      <SelectItem value="CALIFORNIA">{t("law.CALIFORNIA")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("dealNameLabel")}</Label>
                <Input
                  value={dealName}
                  placeholder={t("dealNamePlaceholder")}
                  onChange={(e) => setDealName(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("controllerName")}</Label>
                  <Input
                    value={controller.name}
                    onChange={(e) => setController({ ...controller, name: e.target.value })}
                  />
                  <Label>{t("controllerAddress")}</Label>
                  <Input
                    value={controller.address}
                    onChange={(e) => setController({ ...controller, address: e.target.value })}
                  />
                  <Label>{t("signatoryName")}</Label>
                  <Input
                    value={controller.signatoryName}
                    onChange={(e) =>
                      setController({ ...controller, signatoryName: e.target.value })
                    }
                  />
                  <Label>{t("signatoryTitle")}</Label>
                  <Input
                    value={controller.signatoryTitle}
                    onChange={(e) =>
                      setController({ ...controller, signatoryTitle: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("processorName")}</Label>
                  <Input
                    value={processor.name}
                    onChange={(e) => setProcessor({ ...processor, name: e.target.value })}
                  />
                  <Label>{t("processorAddress")}</Label>
                  <Input
                    value={processor.address}
                    onChange={(e) => setProcessor({ ...processor, address: e.target.value })}
                  />
                  <Label>{t("signatoryName")}</Label>
                  <Input
                    value={processor.signatoryName}
                    onChange={(e) =>
                      setProcessor({ ...processor, signatoryName: e.target.value })
                    }
                  />
                  <Label>{t("signatoryTitle")}</Label>
                  <Input
                    value={processor.signatoryTitle}
                    onChange={(e) =>
                      setProcessor({ ...processor, signatoryTitle: e.target.value })
                    }
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* ── Facts (pack parameters) ── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("sectionFacts")}</h3>
              {catalog.parameters.map((param, i) => {
                const value = facts[param.id] ?? "";
                const label = localize(param.label);
                const hint = localize(param.hint);
                // The pack groups related facts; render a subheading when
                // the group changes (file order is the intended order).
                const group = localize(param.group);
                const prevGroup = i > 0 ? localize(catalog.parameters[i - 1]!.group) : "";
                return (
                  <div key={param.id} className="space-y-1.5">
                    {group && group !== prevGroup && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
                        {group}
                      </p>
                    )}
                    <Label>
                      {label}
                      {param.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {param.type === "multiSelect" && param.options ? (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {param.options.map((key) => {
                          const selected = value
                            .split(",")
                            .map((s) => s.trim())
                            .includes(key);
                          return (
                            <label
                              key={key}
                              className="flex items-center gap-2 text-sm font-normal"
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleMulti(param.id, key)}
                              />
                              {localize(param.optionLabels?.[key]) || key}
                            </label>
                          );
                        })}
                      </div>
                    ) : param.type === "choice" && param.options ? (
                      <Select
                        value={value || param.default || ""}
                        onValueChange={(v) => setFact(param.id, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {param.options.map((key) => (
                            <SelectItem key={key} value={key}>
                              {localize(param.optionLabels?.[key]) || key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : param.type === "textarea" ? (
                      <Textarea
                        value={value}
                        placeholder={localize(param.placeholder)}
                        onChange={(e) => setFact(param.id, e.target.value)}
                        rows={2}
                      />
                    ) : (
                      <Input
                        value={value}
                        placeholder={localize(param.placeholder)}
                        onChange={(e) => setFact(param.id, e.target.value)}
                      />
                    )}
                    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                  </div>
                );
              })}
            </section>

            <Separator />

            {/* ── Negotiated terms (clause selections) ── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("sectionTerms")}</h3>
              {catalog.clauses.map((clause) => {
                const selected = selections[clause.id];
                const option = clause.options.find((o) => o.id === selected);
                return (
                  <div key={clause.id} className="space-y-1.5">
                    <Label>{localize(clause.title)}</Label>
                    <Select
                      value={selected ?? ""}
                      onValueChange={(v) =>
                        setSelections((prev) => ({ ...prev, [clause.id]: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {clause.options.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {localize(o.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {option?.plainDescription && (
                      <p className="text-xs text-muted-foreground">
                        {localize(option.plainDescription)}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>

            {/* ── §7 contradictions requiring explicit confirmation ── */}
            {issues.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-2">
                <p className="font-medium flex items-center gap-2">
                  <TriangleAlert className="w-4 h-4" /> {t("issuesTitle")}
                </p>
                {issues.map((issue) => (
                  <label key={issue.code} className="flex items-start gap-2 font-normal">
                    <Checkbox
                      checked={!!confirmed[issue.code]}
                      onCheckedChange={(v) =>
                        setConfirmed((prev) => ({ ...prev, [issue.code]: v === true }))
                      }
                    />
                    <span>
                      {issue.message[locale === "es" ? "es" : "en"]}{" "}
                      <span className="font-medium">{t("confirmIssue")}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                onClick={onGenerate}
                disabled={generate.isPending || requiredMissing || !allConfirmed}
              >
                <FileText className="w-4 h-4 mr-2" />
                {generate.isPending ? t("generating") : t("generate")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The risk register of an assessment (GDPR Art. 35(7)(c)): one row per risk
 * to the rights and freedoms of data subjects, graded for likelihood and
 * severity before the measures (inherent) and after them (residual), on the
 * same four levels. Measures are linked to the risk they address; a risk is
 * closed only once at least one measure addresses it and its residual is
 * graded (the server refuses otherwise, src/lib/assessment-risk-register.ts).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  RISK_GRADES,
  closeRefusal,
  registerRows,
  registerSummary,
  type RegisterLevel,
} from "@/lib/assessment-risk-register";

interface Risk {
  id: string;
  title: string;
  description: string | null;
  rightsAffected: string | null;
  likelihood: number;
  severity: number;
  residualLikelihood: number | null;
  residualSeverity: number | null;
  status: string;
}

interface Measure {
  id: string;
  riskId: string;
  title: string;
  status: string;
}

const levelTone: Record<RegisterLevel, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-destructive/50 bg-destructive/20 text-foreground",
  CRITICAL: "border-destructive bg-destructive text-destructive-foreground",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  rightsAffected: "",
  likelihood: "",
  severity: "",
  residualLikelihood: "",
  residualSeverity: "",
};

function GradeSelect({
  id,
  label,
  value,
  onChange,
  optional,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  const t = useTranslations("pages.assessmentDetail.riskRegister");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || (optional ? "none" : "")} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={t("choose")} />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value="none">{t("notGraded")}</SelectItem>}
          {RISK_GRADES.map((g) => (
            <SelectItem key={g} value={String(g)}>
              {g}. {t(`grades.${g}` as "grades.1")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function RiskRegister({
  organizationId,
  assessmentId,
  risks,
  measures,
  canEdit,
}: {
  organizationId: string;
  assessmentId: string;
  risks: Risk[];
  measures: Measure[];
  canEdit: boolean;
}) {
  const t = useTranslations("pages.assessmentDetail.riskRegister");
  const tLevel = useTranslations("enums.riskLevel");
  const tStatus = useTranslations("enums.assessmentRiskStatus");
  const utils = trpc.useUtils();
  const refresh = () => utils.assessment.getById.invalidate();
  const onError = (error: { message: string }) => toast.error(error.message);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [measureDraft, setMeasureDraft] = useState<Record<string, string>>({});

  const addRisk = trpc.assessment.addRisk.useMutation({
    onSuccess: () => {
      refresh();
      setForm(EMPTY_FORM);
      setFormOpen(false);
    },
    onError,
  });
  const updateRisk = trpc.assessment.updateRisk.useMutation({
    onSuccess: () => {
      refresh();
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    },
    onError,
  });
  const deleteRisk = trpc.assessment.deleteRisk.useMutation({ onSuccess: refresh, onError });
  const addMeasure = trpc.assessment.addMitigation.useMutation({
    onSuccess: (_d, v) => {
      refresh();
      setMeasureDraft((prev) => ({ ...prev, [v.riskId]: "" }));
    },
    onError,
  });

  const rows = registerRows(risks, measures);
  const summary = registerSummary(rows);
  const level = (l: RegisterLevel | null) => (l ? tLevel(l) : t("notGraded"));

  const grade = (v: string) => (v ? Number(v) : null);
  const valid = form.title.trim() !== "" && form.likelihood !== "" && form.severity !== "";
  const save = () => {
    const fields = {
      title: form.title.trim(),
      description: form.description || undefined,
      rightsAffected: form.rightsAffected || undefined,
      likelihood: Number(form.likelihood),
      severity: Number(form.severity),
      residualLikelihood: grade(form.residualLikelihood),
      residualSeverity: grade(form.residualSeverity),
    };
    if (editingId) updateRisk.mutate({ organizationId, id: editingId, ...fields });
    else addRisk.mutate({ organizationId, assessmentId, ...fields });
  };
  const startEdit = (r: Risk) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      description: r.description ?? "",
      rightsAffected: r.rightsAffected ?? "",
      likelihood: String(r.likelihood),
      severity: String(r.severity),
      residualLikelihood: r.residualLikelihood ? String(r.residualLikelihood) : "",
      residualSeverity: r.residualSeverity ? String(r.residualSeverity) : "",
    });
    setFormOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="risk-register">
      <Card>
        <CardContent className="py-4 space-y-2">
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
          {rows.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span>
                {t("inherentMax")}: <strong>{level(summary.inherent)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t("residualMax")}: <strong>{level(summary.residual)}</strong>
              </span>
            </div>
          )}
          {summary.unsupportedReductions.length > 0 && (
            <p className="text-sm flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
              {t("unsupported")}
            </p>
          )}
        </CardContent>
      </Card>

      {rows.length === 0 && !formOpen && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("empty")}</p>
          </CardContent>
        </Card>
      )}

      {rows.map(({ risk, inherent, residual, measures: count }) => {
        const own = measures.filter((m) => m.riskId === risk.id);
        const refusal = closeRefusal(risk, measures);
        const closed = risk.status === "CLOSED";
        return (
          <Card key={risk.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium break-words">{risk.title}</span>
                    <Badge variant="outline">{tStatus(risk.status as "OPEN")}</Badge>
                  </div>
                  {risk.description && <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>}
                  {risk.rightsAffected && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("rightsAffected")}: {risk.rightsAffected}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Badge variant="outline" className={inherent ? levelTone[inherent] : ""}>
                    {t("inherentPair", { level: level(inherent), likelihood: risk.likelihood, severity: risk.severity })}
                  </Badge>
                  <Badge variant="outline" className={residual ? levelTone[residual] : ""}>
                    {residual
                      ? t("residualPair", {
                          level: level(residual),
                          likelihood: risk.residualLikelihood ?? "",
                          severity: risk.residualSeverity ?? "",
                        })
                      : t("residualNotGraded")}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">{t("measuresTitle", { count })}</p>
                {own.length > 0 ? (
                  <ul className="text-sm text-muted-foreground list-disc pl-5">
                    {own.map((m) => (
                      <li key={m.id}>{m.title}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("noMeasures")}</p>
                )}
                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={measureDraft[risk.id] ?? ""}
                      onChange={(e) => setMeasureDraft((prev) => ({ ...prev, [risk.id]: e.target.value }))}
                      placeholder={t("measurePlaceholder")}
                      aria-label={t("measurePlaceholder")}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!(measureDraft[risk.id] ?? "").trim() || addMeasure.isPending}
                      onClick={() =>
                        addMeasure.mutate({
                          organizationId,
                          assessmentId,
                          riskId: risk.id,
                          title: (measureDraft[risk.id] ?? "").trim(),
                          priority: 3,
                        })
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {t("addMeasure")}
                    </Button>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {closed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateRisk.mutate({ organizationId, id: risk.id, status: "OPEN" })}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      {t("reopen")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={refusal != null || updateRisk.isPending}
                      title={refusal === "NO_MEASURE" ? t("closeNeedsMeasure") : refusal === "NO_RESIDUAL" ? t("closeNeedsResidual") : undefined}
                      onClick={() => updateRisk.mutate({ organizationId, id: risk.id, status: "CLOSED" })}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      {t("close")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => startEdit(risk)}>
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRisk.mutate({ organizationId, id: risk.id })}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {refusal != null && !closed && (
                    <span className="text-xs text-muted-foreground self-center">
                      {refusal === "NO_MEASURE" ? t("closeNeedsMeasure") : t("closeNeedsResidual")}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {canEdit && formOpen && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="risk-title">{t("titleLabel")}</Label>
              <Input
                id="risk-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("titlePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="risk-description">{t("descriptionLabel")}</Label>
              <Textarea
                id="risk-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="risk-rights">{t("rightsAffected")}</Label>
              <Input
                id="risk-rights"
                value={form.rightsAffected}
                onChange={(e) => setForm({ ...form, rightsAffected: e.target.value })}
                placeholder={t("rightsPlaceholder")}
              />
            </div>
            <p className="text-sm font-medium">{t("beforeMeasures")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <GradeSelect id="risk-l" label={t("likelihood")} value={form.likelihood} onChange={(v) => setForm({ ...form, likelihood: v })} />
              <GradeSelect id="risk-s" label={t("severity")} value={form.severity} onChange={(v) => setForm({ ...form, severity: v })} />
            </div>
            <p className="text-sm font-medium">{t("afterMeasures")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <GradeSelect
                id="risk-rl"
                label={t("likelihood")}
                value={form.residualLikelihood}
                onChange={(v) => setForm({ ...form, residualLikelihood: v })}
                optional
              />
              <GradeSelect
                id="risk-rs"
                label={t("severity")}
                value={form.residualSeverity}
                onChange={(v) => setForm({ ...form, residualSeverity: v })}
                optional
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={!valid || addRisk.isPending || updateRisk.isPending}>
                {(addRisk.isPending || updateRisk.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {t("save")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canEdit && !formOpen && (
        <Button variant="outline" onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          {t("add")}
        </Button>
      )}
    </div>
  );
}

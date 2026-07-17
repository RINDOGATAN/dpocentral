"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AiDraftPanel — the one UX for every AI assist in the suite.
 *
 * Status-aware: posture off shows a quiet hint (no calls are ever made);
 * posture on without an engine shows the admin hint; otherwise a "Draft
 * with AI" button. A generated draft is shown read-only with the provenance
 * line ("AI-generated with {model} — review before use") and two actions:
 * Insert (hands the text to the parent's EDITABLE field and stamps
 * acceptedAt) or Discard. The panel never writes AI output to the DB.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { features } from "@/config/features";

export interface AiDraft {
  content: string;
  model: string;
  generationId: string;
}

const KNOWN_ERROR_CODES = ["ai_off", "ai_not_configured", "ai_rate_limited", "ai_failed"] as const;
type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

function knownErrorCode(message: string | undefined): KnownErrorCode | null {
  return KNOWN_ERROR_CODES.includes(message as KnownErrorCode)
    ? (message as KnownErrorCode)
    : null;
}

interface AiDraftPanelProps {
  organizationId: string;
  /** Run the feature's generate mutation (server-side prompts only). */
  onGenerate: () => Promise<AiDraft>;
  /** Put the draft into the parent's editable field (the user's Insert). */
  onInsert: (content: string) => void;
  disabled?: boolean;
  className?: string;
}

export function AiDraftPanel({
  organizationId,
  onGenerate,
  onInsert,
  disabled,
  className,
}: AiDraftPanelProps) {
  const t = useTranslations("ai");
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: status } = trpc.ai.getStatus.useQuery(
    { organizationId },
    { enabled: features.aiAssistEnabled && !!organizationId, staleTime: 60_000 }
  );

  const markAccepted = trpc.assessment.markAiAccepted.useMutation();

  if (!features.aiAssistEnabled || !status) return null;

  // Posture off (or no row): the assist is invisible-but-explained. No calls.
  if (status.posture === "off") {
    return (
      <div className={`flex items-start gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{t("panel.offHint")}</span>
      </div>
    );
  }

  // Posture on but no engine configured: admin hint, no call.
  if (!status.configured) {
    return (
      <div className={`flex items-start gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{t("panel.notConfiguredHint")}</span>
      </div>
    );
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await onGenerate();
      setDraft(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : undefined;
      const code = knownErrorCode(message);
      toast.error(code ? t(`errors.${code}`) : message || t("errors.ai_failed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = () => {
    if (!draft) return;
    onInsert(draft.content);
    // Audit: stamp acceptedAt (metadata only) — best-effort
    markAccepted.mutate({ organizationId, generationId: draft.generationId });
    toast.success(t("panel.inserted"));
    setDraft(null);
  };

  if (!draft) {
    return (
      <div className={className}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={disabled || isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? t("panel.generating") : t("panel.draftWithAi")}
        </Button>
      </div>
    );
  }

  return (
    <Card className={`border-primary/30 ${className ?? ""}`}>
      <CardContent className="pt-4 space-y-3">
        <div className="text-sm whitespace-pre-wrap max-h-72 overflow-y-auto rounded-md bg-muted/50 p-3">
          {draft.content}
        </div>
        <p className="text-xs text-muted-foreground italic">
          {t("panel.provenance", { model: draft.model })}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)}>
            <X className="w-4 h-4 mr-1.5" />
            {t("panel.discard")}
          </Button>
          <Button type="button" size="sm" onClick={handleInsert}>
            <Check className="w-4 h-4 mr-1.5" />
            {t("panel.insert")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI systems are read-only in DPO Central (the owner's decision, 27 Sep 2026):
 * governance lives in AI Sentinel. Registering a system by hand is no longer
 * offered — this page is a plain notice pointing to AI Sentinel, kept so an old
 * link or bookmark lands somewhere clear instead of a broken form. The server
 * refuses the create in any case (aiGovernance.create).
 */

import Link from "next/link";
import { Bot, ArrowLeft, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RegisterAISystemPage() {
  const t = useTranslations("pages.aiSystems");
  const aisUrl = process.env.NEXT_PUBLIC_AI_SENTINEL_URL || "https://aisentinel.todo.law";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="shrink-0">
        <Link href="/privacy/ai-systems">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("readOnly.back")}
        </Link>
      </Button>
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Bot className="w-12 h-12 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("readOnly.title")}</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("readOnly.body")}</p>
          <Button variant="outline" asChild>
            <a href={`${aisUrl}/governance/ai-registry`} target="_blank" rel="noopener noreferrer">
              {t("sentinel.governNote.open")}
              <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

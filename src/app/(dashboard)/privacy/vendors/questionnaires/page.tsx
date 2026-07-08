"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  ClipboardList,
  Loader2,
  ExternalLink,
  Eye,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

export default function VendorQuestionnairesPage() {
  const { organization } = useOrganization();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const t = useTranslations("pages.vendorQuestionnaires");

  const { data: questionnaires, isLoading } = trpc.vendor.listQuestionnaires.useQuery(
    { organizationId: organization?.id ?? "" },
    {
      enabled: !!organization?.id,
      refetchOnWindowFocus: false,
    }
  );

  const totalQuestions = (sections: any[]) =>
    sections?.reduce((sum: number, s: any) => sum + (s.questions?.length ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/vendors">
            <Button variant="ghost" size="icon" aria-label={t("back")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Vendor.Watch pointer */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-4 h-4 text-primary" />
            {t("vwTitle")}
          </CardTitle>
          <CardDescription>{t("vwBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="https://vendor.watch" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              {t("vwOpen")}
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>{t("libraryTitle")}</CardTitle>
          <CardDescription>{t("librarySubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : questionnaires && questionnaires.length > 0 ? (
            <div className="space-y-4">
              {questionnaires.map((questionnaire) => {
                const sections = (questionnaire.sections as any[]) ?? [];
                const questionCount = totalQuestions(sections);
                const isExpanded = expandedId === questionnaire.id;

                return (
                  <Card
                    key={questionnaire.id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 border-2 border-primary flex items-center justify-center shrink-0">
                            <ClipboardList className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{questionnaire.name}</CardTitle>
                            {questionnaire.description && (
                              <CardDescription className="mt-1">
                                {questionnaire.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {questionnaire.isSystem && <Badge variant="secondary">{t("system")}</Badge>}
                          <Badge variant="outline">{t("version", { version: questionnaire.version })}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{t("sectionsCount", { count: sections.length })}</span>
                          <span>{t("questionsCount", { count: questionCount })}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : questionnaire.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {t("preview")}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 ml-1" />
                          ) : (
                            <ChevronDown className="w-4 h-4 ml-1" />
                          )}
                        </Button>
                      </div>
                      {isExpanded && (
                        <div className="mt-4 border-t pt-4 space-y-4">
                          {sections.map((section: any, idx: number) => (
                            <div key={section.id}>
                              <h4 className="font-medium text-sm">
                                {idx + 1}. {section.title}
                              </h4>
                              {section.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {section.description}
                                </p>
                              )}
                              <ul className="mt-2 space-y-1.5">
                                {section.questions?.map((q: any) => (
                                  <li key={q.id} className="flex items-start gap-2 text-sm">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5"
                                    >
                                      {q.type}
                                    </Badge>
                                    <span className="text-muted-foreground">{q.text}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("empty")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

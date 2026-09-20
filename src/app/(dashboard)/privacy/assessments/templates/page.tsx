"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Search,
  FileText,
  ClipboardCheck,
  Copy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useTemplateMeta } from "@/lib/template-i18n";

export default function AssessmentTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.assessmentTemplates");
  const tCommon = useTranslations("common");
  const templateMeta = useTemplateMeta();

  const { data: templates, isLoading } = trpc.assessment.listTemplates.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  const cloneTemplate = trpc.assessment.cloneTemplate.useMutation({
    onSuccess: () => {
      toast.success(t("assessment.templateCloned"));
      utils.assessment.listTemplates.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const systemTemplates = templates?.filter((tpl) => tpl.isSystem) ?? [];
  const customTemplates = templates?.filter((tpl) => !tpl.isSystem) ?? [];

  const matches = (tpl: { name: string; type: string }) =>
    tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tpl.type.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredSystemTemplates = systemTemplates.filter(matches);
  const filteredCustomTemplates = customTemplates.filter(matches);

  const handleClone = (templateId: string, templateName: string) => {
    const name = prompt(tp("clonePrompt"), tp("cloneSuffix", { name: templateName }));
    if (name) {
      cloneTemplate.mutate({
        organizationId: organization?.id ?? "",
        templateId,
        name,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/assessments">
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tp("title")}</h1>
          <p className="text-muted-foreground">{tp("subtitle")}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tp("searchPlaceholder")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system">
            {tp("tabSystem", { count: systemTemplates.length })}
          </TabsTrigger>
          <TabsTrigger value="custom">
            {tp("tabCustom", { count: customTemplates.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSystemTemplates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSystemTemplates.map((template) => (
                <Card key={template.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                        <ClipboardCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{template.type}</Badge>
                        <Badge variant="secondary">{tp("system")}</Badge>
                      </div>
                    </div>
                    <CardTitle className="mt-3">{templateMeta(template).name}</CardTitle>
                    {template.description && (
                      <CardDescription className="line-clamp-2">
                        {templateMeta(template).description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {tp("sectionsCount", {
                          count: (template.sections as unknown[])?.length || 0,
                        })}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClone(template.id, templateMeta(template).name)}
                          disabled={cloneTemplate.isPending}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          {tp("clone")}
                        </Button>
                        <Link href={`/privacy/assessments/new?type=${template.type}`}>
                          <Button variant="outline" size="sm">
                            {tp("use")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tp("noSystemTitle")}</p>
                <p className="text-sm">{tp("noSystemBody")}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredCustomTemplates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCustomTemplates.map((template) => (
                <Card key={template.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                        <ClipboardCheck className="w-5 h-5 text-primary" />
                      </div>
                      <Badge variant="outline">{template.type}</Badge>
                    </div>
                    <CardTitle className="mt-3">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {tp("sectionsCount", {
                          count: (template.sections as unknown[])?.length || 0,
                        })}
                      </span>
                      <Link href={`/privacy/assessments/new?type=${template.type}`}>
                        <Button variant="outline" size="sm">
                          {tp("use")}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tp("noCustomTitle")}</p>
                <p className="text-sm">{tp("noCustomBody")}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tp("aboutTitle")}</CardTitle>
          <CardDescription>{tp("aboutSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <h4 className="font-medium mb-2">{tp("aboutDpia")}</h4>
              <p className="text-muted-foreground">{tp("aboutDpiaBody")}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">{tp("aboutTia")}</h4>
              <p className="text-muted-foreground">{tp("aboutTiaBody")}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">{tp("aboutLia")}</h4>
              <p className="text-muted-foreground">{tp("aboutLiaBody")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

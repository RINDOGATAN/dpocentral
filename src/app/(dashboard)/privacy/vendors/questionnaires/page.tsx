"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  FileText,
  ClipboardList,
  Send,
  CheckCircle2,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

export default function VendorQuestionnairesPage() {
  const { organization } = useOrganization();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: questionnaires, isLoading } = trpc.vendor.listQuestionnaires.useQuery(
    { organizationId: organization?.id ?? "" },
    {
      enabled: !!organization?.id,
      refetchOnWindowFocus: false,
    }
  );

  const systemQuestionnaires = questionnaires?.filter((q) => q.isSystem) ?? [];
  const customQuestionnaires = questionnaires?.filter((q) => !q.isSystem) ?? [];

  const totalQuestions = (sections: any[]) =>
    sections?.reduce((sum: number, s: any) => sum + (s.questions?.length ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/vendors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Vendor Questionnaires</h1>
            <p className="text-muted-foreground">
              Manage due diligence questionnaires for vendors
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {questionnaires?.length ?? 0}
            </div>
            <p className="text-sm text-muted-foreground">Total Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {systemQuestionnaires.length}
            </div>
            <p className="text-sm text-muted-foreground">System Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {customQuestionnaires.length}
            </div>
            <p className="text-sm text-muted-foreground">Custom Templates</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="sent">Sent Questionnaires</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
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
                          {questionnaire.isSystem && (
                            <Badge variant="secondary">System</Badge>
                          )}
                          <Badge variant="outline">v{questionnaire.version}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{sections.length} sections</span>
                          <span>{questionCount} questions</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : questionnaire.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 ml-1" />
                          ) : (
                            <ChevronDown className="w-4 h-4 ml-1" />
                          )}
                        </Button>
                      </div>

                      {/* Expanded preview */}
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
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
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
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No questionnaire templates yet</p>
                <p className="text-sm">
                  Questionnaire templates will appear here once configured
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No questionnaires sent yet</p>
              <p className="text-sm">
                Send questionnaires to vendors for due diligence assessments
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No responses received yet</p>
              <p className="text-sm">
                Vendor responses will appear here once submitted
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor Due Diligence</CardTitle>
          <CardDescription>
            Best practices for vendor security assessments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <h4 className="font-medium mb-2">Assessment Coverage</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Security governance and certifications</li>
                <li>Data protection and encryption practices</li>
                <li>Access control and authentication</li>
                <li>Incident response and breach notification</li>
                <li>Subprocessor management (GDPR Art. 28)</li>
                <li>International data transfers (GDPR Ch. V)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Review Frequency</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>High-risk vendors: Annual review</li>
                <li>Medium-risk vendors: Every 2 years</li>
                <li>Low-risk vendors: Every 3 years</li>
                <li>After security incidents: Immediate review</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

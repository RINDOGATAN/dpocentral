"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Search,
  FileText,
  ClipboardList,
  Send,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

export default function VendorQuestionnairesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();

  const { data: questionnaires, isLoading } = trpc.vendor.listQuestionnaires.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const systemQuestionnaires = questionnaires?.filter((q) => q.isSystem) ?? [];
  const customQuestionnaires = questionnaires?.filter((q) => !q.isSystem) ?? [];

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
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Questionnaire
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {questionnaires?.length ?? 0}
            </div>
            <p className="text-sm text-muted-foreground">Total Questionnaires</p>
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">0</div>
            <p className="text-sm text-muted-foreground">Pending Responses</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questionnaires..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {questionnaires.map((questionnaire) => (
                <Card
                  key={questionnaire.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex gap-2">
                        {questionnaire.isSystem && (
                          <Badge variant="secondary">System</Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="mt-3">{questionnaire.name}</CardTitle>
                    {questionnaire.description && (
                      <CardDescription className="line-clamp-2">
                        {questionnaire.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {(questionnaire.sections as any[])?.length || 0} sections
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Preview
                        </Button>
                        <Button variant="outline" size="sm">
                          <Send className="w-4 h-4 mr-1" />
                          Send
                        </Button>
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
                <p>No questionnaire templates yet</p>
                <p className="text-sm mb-4">
                  Create questionnaires to assess vendor security and privacy practices
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Questionnaire
                </Button>
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
              <h4 className="font-medium mb-2">Recommended Questions</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Data security measures and certifications</li>
                <li>Subprocessor usage and locations</li>
                <li>Incident response procedures</li>
                <li>Data retention and deletion practices</li>
                <li>Employee training and access controls</li>
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

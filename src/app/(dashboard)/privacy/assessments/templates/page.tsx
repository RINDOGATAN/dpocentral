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
  ClipboardCheck,
  Copy,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const typeLabels: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment",
  PIA: "Privacy Impact Assessment",
  TIA: "Transfer Impact Assessment",
  LIA: "Legitimate Interest Assessment",
  VENDOR: "Vendor Risk Assessment",
  CUSTOM: "Custom Assessment",
};

export default function AssessmentTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { organization } = useOrganization();

  const { data: templates, isLoading } = trpc.assessment.listTemplates.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  const cloneTemplate = trpc.assessment.cloneTemplate.useMutation({
    onSuccess: () => {
      utils.assessment.listTemplates.invalidate();
    },
  });

  const systemTemplates = templates?.filter((t) => t.isSystem) ?? [];
  const customTemplates = templates?.filter((t) => !t.isSystem) ?? [];

  const filteredSystemTemplates = systemTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomTemplates = customTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClone = (templateId: string, templateName: string) => {
    const name = prompt("Enter a name for the cloned template:", `${templateName} (Copy)`);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/assessments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Assessment Templates</h1>
            <p className="text-muted-foreground">
              Manage and customize assessment templates
            </p>
          </div>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system">System Templates ({systemTemplates.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom Templates ({customTemplates.length})</TabsTrigger>
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
                        <Badge variant="secondary">System</Badge>
                      </div>
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
                        {(template.sections as any[])?.length || 0} sections
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClone(template.id, template.name)}
                          disabled={cloneTemplate.isPending}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Clone
                        </Button>
                        <Link href={`/privacy/assessments/new?template=${template.id}`}>
                          <Button variant="outline" size="sm">
                            Use
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
                <p>No system templates found</p>
                <p className="text-sm">Run the database seed to add default templates</p>
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
                        {(template.sections as any[])?.length || 0} sections
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Link href={`/privacy/assessments/new?template=${template.id}`}>
                          <Button variant="outline" size="sm">
                            Use
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
                <p>No custom templates yet</p>
                <p className="text-sm mb-4">Clone a system template or create your own</p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Assessment Templates</CardTitle>
          <CardDescription>
            Templates define the structure and questions for privacy assessments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <h4 className="font-medium mb-2">DPIA (Article 35)</h4>
              <p className="text-muted-foreground">
                Required when processing is likely to result in high risk to individuals.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">TIA (Schrems II)</h4>
              <p className="text-muted-foreground">
                Assess risks of international data transfers following Schrems II ruling.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">LIA (Article 6.1.f)</h4>
              <p className="text-muted-foreground">
                Balance test required when relying on legitimate interests as legal basis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const RISK_LEVELS = ["UNACCEPTABLE", "HIGH_RISK", "LIMITED", "MINIMAL"] as const;

export default function EditAISystemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("toasts");
  const tEdit = useTranslations("pages.editAiSystem");
  const tExt = useTranslations("pages.editAiSystemExt");
  const tRisk = useTranslations("pages.editAiSystemExt.risk_option");
  const tCommon = useTranslations("common");

  const initializedRef = useRef(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    purpose: "",
    category: "",
    riskLevel: "MINIMAL" as string,
    provider: "",
    deployer: "",
    modelType: "",
    vendorId: "",
    trainingDataSources: [] as string[],
    humanOversight: "",
    transparencyMeasures: "",
    technicalDocUrl: "",
  });
  const [trainingInput, setTrainingInput] = useState("");

  const { data: system, isLoading } = trpc.aiGovernance.getById.useQuery(
    { organizationId: orgId, id },
    { enabled: !!orgId && !!id }
  );

  const { data: vendorsPages, hasNextPage, fetchNextPage, isFetchingNextPage } =
    trpc.vendor.list.useInfiniteQuery(
      { organizationId: orgId, limit: 100 },
      { enabled: !!orgId, getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
  const vendors = vendorsPages?.pages.flatMap((p) => p.vendors) ?? [];
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (system && !initializedRef.current) {
      initializedRef.current = true;
      setFormData({
        name: system.name || "",
        description: system.description || "",
        purpose: system.purpose || "",
        category: system.category || "",
        riskLevel: system.riskLevel as string,
        provider: system.provider || "",
        deployer: system.deployer || "",
        modelType: system.modelType || "",
        vendorId: system.vendorId || "",
        trainingDataSources: (system.trainingDataSources as string[]) || [],
        humanOversight: system.humanOversight || "",
        transparencyMeasures: system.transparencyMeasures || "",
        technicalDocUrl: system.technicalDocUrl || "",
      });
    }
  }, [system]);

  const utils = trpc.useUtils();

  const updateAiSystem = trpc.aiGovernance.update.useMutation({
    onSuccess: () => {
      toast.success(t("aiSystem.updated"));
      utils.aiGovernance.getById.invalidate({ organizationId: orgId, id });
      utils.aiGovernance.list.invalidate();
      router.push(`/privacy/ai-systems/${id}`);
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !formData.name) return;
    setIsSubmitting(true);
    updateAiSystem.mutate({
      organizationId: orgId,
      id,
      name: formData.name,
      description: formData.description || null,
      purpose: formData.purpose || null,
      category: formData.category || null,
      riskLevel: formData.riskLevel as any,
      provider: formData.provider || null,
      deployer: formData.deployer || null,
      modelType: formData.modelType || null,
      vendorId: formData.vendorId || null,
      trainingDataSources: formData.trainingDataSources,
      humanOversight: formData.humanOversight || null,
      transparencyMeasures: formData.transparencyMeasures || null,
      technicalDocUrl: formData.technicalDocUrl || null,
    });
  };

  const addTrainingSource = () => {
    const value = trainingInput.trim();
    if (!value || formData.trainingDataSources.includes(value)) return;
    setFormData({
      ...formData,
      trainingDataSources: [...formData.trainingDataSources, value],
    });
    setTrainingInput("");
  };
  const removeTrainingSource = (value: string) => {
    setFormData({
      ...formData,
      trainingDataSources: formData.trainingDataSources.filter((s) => s !== value),
    });
  };

  if (isLoading || !system) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/privacy/ai-systems/${id}`}>
          <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{tEdit("title")}</h1>
          <p className="text-muted-foreground">{tEdit("subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{tExt("basics")}</CardTitle>
            <CardDescription>{tExt("basicsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{tExt("name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelType">{tExt("modelType")}</Label>
                <Input
                  id="modelType"
                  placeholder={tExt("modelTypePlaceholder")}
                  value={formData.modelType}
                  onChange={(e) => setFormData({ ...formData, modelType: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{tExt("description")}</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">{tExt("purpose")}</Label>
              <Textarea
                id="purpose"
                rows={3}
                placeholder={tExt("purposePlaceholder")}
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">{tExt("category")}</Label>
                <Input
                  id="category"
                  placeholder={tExt("categoryPlaceholder")}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorId">{tExt("linkedVendor")}</Label>
                <Select
                  value={formData.vendorId || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vendorId: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tExt("none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{tExt("none")}</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tExt("euAct")}</CardTitle>
            <CardDescription>{tExt("euActSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="riskLevel">{tExt("riskLevel")}</Label>
                <Select
                  value={formData.riskLevel}
                  onValueChange={(value) => setFormData({ ...formData, riskLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tRisk(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">{tExt("provider")}</Label>
                <Input
                  id="provider"
                  placeholder={tExt("providerPlaceholder")}
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deployer">{tExt("deployer")}</Label>
                <Input
                  id="deployer"
                  placeholder={tExt("deployerPlaceholder")}
                  value={formData.deployer}
                  onChange={(e) => setFormData({ ...formData, deployer: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tExt("complianceAndDocs")}</CardTitle>
            <CardDescription>{tExt("complianceAndDocsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tExt("trainingDataSources")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={tExt("trainingDataPlaceholder")}
                  value={trainingInput}
                  onChange={(e) => setTrainingInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTrainingSource())}
                />
                <Button type="button" variant="outline" onClick={addTrainingSource}>{tExt("add")}</Button>
              </div>
              {formData.trainingDataSources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.trainingDataSources.map((src) => (
                    <Badge key={src} variant="secondary">
                      {src}
                      <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeTrainingSource(src)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="humanOversight">{tExt("humanOversight")}</Label>
              <Textarea
                id="humanOversight"
                rows={3}
                placeholder={tExt("humanOversightPlaceholder")}
                value={formData.humanOversight}
                onChange={(e) => setFormData({ ...formData, humanOversight: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transparencyMeasures">{tExt("transparencyMeasures")}</Label>
              <Textarea
                id="transparencyMeasures"
                rows={3}
                placeholder={tExt("transparencyMeasuresPlaceholder")}
                value={formData.transparencyMeasures}
                onChange={(e) =>
                  setFormData({ ...formData, transparencyMeasures: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="technicalDocUrl">{tExt("technicalDocUrl")}</Label>
              <Input
                id="technicalDocUrl"
                type="url"
                placeholder="https://..."
                value={formData.technicalDocUrl}
                onChange={(e) => setFormData({ ...formData, technicalDocUrl: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {updateAiSystem.error && (
          <div className="text-sm text-destructive">{tExt("errorPrefix", { message: updateAiSystem.error.message })}</div>
        )}

        <div className="flex justify-end gap-4">
          <Link href={`/privacy/ai-systems/${id}`}>
            <Button variant="outline" type="button">{tCommon("cancel")}</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || !formData.name}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {tEdit("saving")}
              </>
            ) : (
              tEdit("save")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

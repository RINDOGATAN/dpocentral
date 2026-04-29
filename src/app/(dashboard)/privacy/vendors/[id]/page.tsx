"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Mail,
  User,
  Globe,
  Shield,
  ShieldCheck,
  FileText,
  Clock,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { VendorStatus, VendorRiskTier, ContractType, ReviewType } from "@prisma/client";

const statusColors: Record<string, string> = {
  PROSPECTIVE: "border-muted-foreground text-muted-foreground",
  ACTIVE: "border-primary bg-primary text-primary-foreground",
  UNDER_REVIEW: "border-muted-foreground text-muted-foreground",
  SUSPENDED: "border-destructive text-destructive",
  TERMINATED: "border-muted-foreground text-muted-foreground",
};

const riskColors: Record<string, string> = {
  LOW: "border-primary text-primary",
  MEDIUM: "border-muted-foreground text-muted-foreground",
  HIGH: "border-destructive/50 bg-destructive/20 text-foreground",
  CRITICAL: "border-destructive bg-destructive text-destructive-foreground",
};

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organization } = useOrganization();
  const t = useTranslations("toasts");
  const tp = useTranslations("pages.vendorDetail");
  const tList = useTranslations("pages.vendors");

  const { data: vendor, isLoading } = trpc.vendor.getById.useQuery(
    { organizationId: organization?.id ?? "", id },
    { enabled: !!organization?.id }
  );

  const utils = trpc.useUtils();

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    website: "",
    status: "ACTIVE" as VendorStatus,
    riskTier: null as VendorRiskTier | null,
    primaryContact: "",
    contactEmail: "",
  });

  // Contract form
  const [contractForm, setContractForm] = useState({
    name: "",
    type: "DPA" as ContractType,
    description: "",
    documentUrl: "",
    startDate: "",
    endDate: "",
  });

  // Review form
  const [reviewForm, setReviewForm] = useState({
    reviewerId: "",
    type: "PERIODIC" as ReviewType,
    scheduledAt: "",
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const tConfirm = useTranslations("confirms");
  const tCommon = useTranslations("common");

  // Members for reviewer picker (lazy-loaded when dialog opens)
  const { data: orgData } = trpc.organization.getById.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && reviewOpen }
  );

  const openEditDialog = () => {
    if (!vendor) return;
    setEditForm({
      name: vendor.name,
      description: vendor.description ?? "",
      website: vendor.website ?? "",
      status: vendor.status,
      riskTier: vendor.riskTier,
      primaryContact: vendor.primaryContact ?? "",
      contactEmail: vendor.contactEmail ?? "",
    });
    setEditOpen(true);
  };

  const updateVendor = trpc.vendor.update.useMutation({
    onSuccess: () => {
      toast.success(t("vendor.updated"));
      utils.vendor.getById.invalidate();
      setEditOpen(false);
    },
    onError: (error) => toast.error(error.message || t("generic.somethingWentWrong")),
  });

  const addContract = trpc.vendor.addContract.useMutation({
    onSuccess: () => {
      toast.success(t("vendor.contractAdded"));
      utils.vendor.getById.invalidate();
      setContractOpen(false);
      setContractForm({ name: "", type: "DPA", description: "", documentUrl: "", startDate: "", endDate: "" });
    },
    onError: (error) => toast.error(error.message || t("generic.somethingWentWrong")),
  });

  const scheduleReview = trpc.vendor.scheduleReview.useMutation({
    onSuccess: () => {
      toast.success(t("vendor.reviewScheduled"));
      utils.vendor.getById.invalidate();
      setReviewOpen(false);
      setReviewForm({ reviewerId: "", type: "PERIODIC", scheduledAt: "" });
    },
    onError: (error) => toast.error(error.message || t("generic.somethingWentWrong")),
  });

  const deleteVendor = trpc.vendor.delete.useMutation({
    onSuccess: () => {
      toast.success(t("vendor.deleted"));
      utils.vendor.list.invalidate();
      router.push("/privacy/vendors");
    },
    onError: (error) => {
      toast.error(error.message || t("generic.somethingWentWrong"));
    },
  });

  const handleDelete = () => setConfirmDeleteOpen(true);
  const confirmDelete = () => {
    setConfirmDeleteOpen(false);
    deleteVendor.mutate({ organizationId: organization?.id ?? "", id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{tp("notFound")}</p>
        <Link href="/privacy/vendors">
          <Button variant="outline" className="mt-4">{tp("back")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/privacy/vendors">
            <Button variant="ghost" size="icon" aria-label={tCommon("back")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{vendor.name}</h1>
              <Badge variant="outline" className={statusColors[vendor.status] || ""}>
                {tList(`status.${vendor.status}` as `status.PROSPECTIVE` | `status.ACTIVE` | `status.UNDER_REVIEW` | `status.SUSPENDED` | `status.TERMINATED`)}
              </Badge>
              {vendor.riskTier && (
                <Badge variant="outline" className={riskColors[vendor.riskTier] || ""}>
                  {tp("riskBadge", { level: tList(`riskTier.${vendor.riskTier}` as `riskTier.LOW` | `riskTier.MEDIUM` | `riskTier.HIGH` | `riskTier.CRITICAL`) })}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {(vendor.categories as string[])?.join(" - ") || tp("noCategories")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={deleteVendor.isPending}>
            {deleteVendor.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {tp("delete")}
          </Button>
          <Button onClick={openEditDialog}>{tp("edit")}</Button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-sm">{tp("info.website")}</span>
            </div>
            {vendor.website ? (
              <a
                href={vendor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {new URL(vendor.website).hostname}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-muted-foreground">{tp("info.empty")}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="w-4 h-4" />
              <span className="text-sm">{tp("info.contact")}</span>
            </div>
            <p className="font-medium">{vendor.primaryContact || tp("info.empty")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Mail className="w-4 h-4" />
              <span className="text-sm">{tp("info.email")}</span>
            </div>
            {vendor.contactEmail ? (
              <a href={`mailto:${vendor.contactEmail}`} className="text-primary hover:underline">
                {vendor.contactEmail}
              </a>
            ) : (
              <span className="text-muted-foreground">{tp("info.empty")}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{tp("info.added")}</span>
            </div>
            <p className="font-medium">{new Date(vendor.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{tp("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="contracts">{tp("tabs.contractsWithCount", { count: vendor.contracts?.length ?? 0 })}</TabsTrigger>
          <TabsTrigger value="assessments">{tp("tabs.assessments")}</TabsTrigger>
          <TabsTrigger value="reviews">{tp("tabs.reviews")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {vendor.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tp("overview.description")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{vendor.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tp("overview.dataProcessing")}</CardTitle>
                <CardDescription>{tp("overview.dataProcessingDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {(vendor.dataProcessed as string[])?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(vendor.dataProcessed as string[]).map((data) => (
                      <Badge key={data} variant="outline">
                        {data.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{tp("overview.dataEmpty")}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tp("overview.countries")}</CardTitle>
                <CardDescription>{tp("overview.countriesDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {(vendor.countries as string[])?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(vendor.countries as string[]).map((country) => (
                      <Badge key={country} variant="secondary">
                        {country}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{tp("overview.countriesEmpty")}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tp("overview.certifications")}</CardTitle>
              <CardDescription>{tp("overview.certificationsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {(vendor.certifications as string[])?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(vendor.certifications as string[]).map((cert) => (
                    <Badge key={cert} variant="outline">
                      <Shield className="w-3 h-3 mr-1" />
                      {cert}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{tp("overview.certificationsEmpty")}</p>
              )}
            </CardContent>
          </Card>

          {/* Privacy Technologies */}
          {(vendor.metadata as any)?.privacyTechnologies?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tp("overview.privacyTech")}</CardTitle>
                <CardDescription>{tp("overview.privacyTechDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {((vendor.metadata as any).privacyTechnologies as string[]).map((pet: string) => (
                    <Badge key={pet} variant="outline">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      {pet}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          {vendor.contracts && vendor.contracts.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setContractOpen(true)}>
                  {tp("contracts.add")}
                </Button>
              </div>
              {vendor.contracts.map((contract) => (
                <Card key={contract.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium truncate">{contract.name}</span>
                          <Badge variant="outline">{contract.type}</Badge>
                          <Badge variant="outline">{contract.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {contract.startDate && (
                            <>
                              {tp("contracts.start", { date: new Date(contract.startDate).toLocaleDateString() })}
                              {contract.endDate && tp("contracts.endSuffix", { date: new Date(contract.endDate).toLocaleDateString() })}
                            </>
                          )}
                        </p>
                      </div>
                      {contract.documentUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={contract.documentUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            {tp("contracts.open")}
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled title={tp("contracts.noDocument")}>
                          {tp("contracts.noDocument")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tp("contracts.empty")}</p>
                <Button className="mt-4" onClick={() => setContractOpen(true)}>
                  {tp("contracts.add")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{tp("assessments.empty")}</p>
              <Link href={`/privacy/assessments/new?vendorId=${id}&vendorName=${encodeURIComponent(vendor.name)}`}>
                <Button className="mt-4">{tp("assessments.start")}</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{tp("reviews.empty")}</p>
              <Button className="mt-4" onClick={() => setReviewOpen(true)}>
                {tp("reviews.schedule")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Vendor Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tp("editDialog.title")}</DialogTitle>
            <DialogDescription>{tp("editDialog.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{tp("editDialog.nameLabel")}</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{tp("editDialog.descLabel")}</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website">{tp("editDialog.websiteLabel")}</Label>
              <Input
                id="edit-website"
                placeholder={tp("editDialog.websitePlaceholder")}
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{tp("editDialog.statusLabel")}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as VendorStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROSPECTIVE">{tList("status.PROSPECTIVE")}</SelectItem>
                    <SelectItem value="ACTIVE">{tList("status.ACTIVE")}</SelectItem>
                    <SelectItem value="UNDER_REVIEW">{tList("status.UNDER_REVIEW")}</SelectItem>
                    <SelectItem value="SUSPENDED">{tList("status.SUSPENDED")}</SelectItem>
                    <SelectItem value="TERMINATED">{tList("status.TERMINATED")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tp("editDialog.riskLabel")}</Label>
                <Select
                  value={editForm.riskTier ?? "__none"}
                  onValueChange={(v) => setEditForm({ ...editForm, riskTier: v === "__none" ? null : (v as VendorRiskTier) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{tp("editDialog.riskNotSet")}</SelectItem>
                    <SelectItem value="LOW">{tList("riskTier.LOW")}</SelectItem>
                    <SelectItem value="MEDIUM">{tList("riskTier.MEDIUM")}</SelectItem>
                    <SelectItem value="HIGH">{tList("riskTier.HIGH")}</SelectItem>
                    <SelectItem value="CRITICAL">{tList("riskTier.CRITICAL")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-contact">{tp("editDialog.contactLabel")}</Label>
                <Input
                  id="edit-contact"
                  value={editForm.primaryContact}
                  onChange={(e) => setEditForm({ ...editForm, primaryContact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{tp("editDialog.emailLabel")}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.contactEmail}
                  onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{tCommon("cancel")}</Button>
            <Button
              disabled={!editForm.name || updateVendor.isPending}
              onClick={() =>
                updateVendor.mutate({
                  organizationId: organization?.id ?? "",
                  id,
                  name: editForm.name,
                  description: editForm.description || null,
                  website: editForm.website || null,
                  status: editForm.status,
                  riskTier: editForm.riskTier,
                  primaryContact: editForm.primaryContact || null,
                  contactEmail: editForm.contactEmail || null,
                })
              }
            >
              {updateVendor.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tp("editDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contract Dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tp("contractDialog.title")}</DialogTitle>
            <DialogDescription>{tp("contractDialog.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">{tp("contractDialog.nameLabel")}</Label>
              <Input
                id="c-name"
                placeholder={tp("contractDialog.namePlaceholder")}
                value={contractForm.name}
                onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tp("contractDialog.typeLabel")}</Label>
              <Select
                value={contractForm.type}
                onValueChange={(v) => setContractForm({ ...contractForm, type: v as ContractType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DPA">{tp("contractDialog.type.DPA")}</SelectItem>
                  <SelectItem value="SCC">{tp("contractDialog.type.SCC")}</SelectItem>
                  <SelectItem value="MSA">{tp("contractDialog.type.MSA")}</SelectItem>
                  <SelectItem value="NDA">{tp("contractDialog.type.NDA")}</SelectItem>
                  <SelectItem value="OTHER">{tp("contractDialog.type.OTHER")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">{tp("contractDialog.descLabel")}</Label>
              <Textarea
                id="c-desc"
                rows={2}
                value={contractForm.description}
                onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-url">{tp("contractDialog.urlLabel")}</Label>
              <Input
                id="c-url"
                placeholder={tp("contractDialog.urlPlaceholder")}
                value={contractForm.documentUrl}
                onChange={(e) => setContractForm({ ...contractForm, documentUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-start">{tp("contractDialog.startLabel")}</Label>
                <Input
                  id="c-start"
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-end">{tp("contractDialog.endLabel")}</Label>
                <Input
                  id="c-end"
                  type="date"
                  value={contractForm.endDate}
                  onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractOpen(false)}>{tCommon("cancel")}</Button>
            <Button
              disabled={!contractForm.name || addContract.isPending}
              onClick={() =>
                addContract.mutate({
                  organizationId: organization?.id ?? "",
                  vendorId: id,
                  name: contractForm.name,
                  type: contractForm.type,
                  description: contractForm.description || undefined,
                  documentUrl: contractForm.documentUrl || undefined,
                  startDate: contractForm.startDate ? new Date(contractForm.startDate) : undefined,
                  endDate: contractForm.endDate ? new Date(contractForm.endDate) : undefined,
                })
              }
            >
              {addContract.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tp("contractDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tp("reviewDialog.title")}</DialogTitle>
            <DialogDescription>{tp("reviewDialog.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tp("reviewDialog.reviewerLabel")}</Label>
              <Select
                value={reviewForm.reviewerId}
                onValueChange={(v) => setReviewForm({ ...reviewForm, reviewerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tp("reviewDialog.reviewerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(orgData?.members ?? []).map((m: { user: { id: string; name: string | null; email: string } }) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.name || m.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tp("reviewDialog.typeLabel")}</Label>
              <Select
                value={reviewForm.type}
                onValueChange={(v) => setReviewForm({ ...reviewForm, type: v as ReviewType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERIODIC">{tp("reviewDialog.type.PERIODIC")}</SelectItem>
                  <SelectItem value="INITIAL">{tp("reviewDialog.type.INITIAL")}</SelectItem>
                  <SelectItem value="INCIDENT_TRIGGERED">{tp("reviewDialog.type.INCIDENT_TRIGGERED")}</SelectItem>
                  <SelectItem value="CONTRACT_RENEWAL">{tp("reviewDialog.type.CONTRACT_RENEWAL")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-date">{tp("reviewDialog.dateLabel")}</Label>
              <Input
                id="r-date"
                type="date"
                value={reviewForm.scheduledAt}
                onChange={(e) => setReviewForm({ ...reviewForm, scheduledAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>{tCommon("cancel")}</Button>
            <Button
              disabled={!reviewForm.reviewerId || !reviewForm.scheduledAt || scheduleReview.isPending}
              onClick={() =>
                scheduleReview.mutate({
                  organizationId: organization?.id ?? "",
                  vendorId: id,
                  reviewerId: reviewForm.reviewerId,
                  type: reviewForm.type,
                  scheduledAt: new Date(reviewForm.scheduledAt),
                })
              }
            >
              {scheduleReview.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tp("reviewDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={tConfirm("deleteVendorTitle")}
        description={tConfirm("deleteVendorDesc")}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        danger
        pending={deleteVendor.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

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
      toast.success("Vendor updated");
      utils.vendor.getById.invalidate();
      setEditOpen(false);
    },
    onError: (error) => toast.error(error.message || "Failed to update vendor"),
  });

  const addContract = trpc.vendor.addContract.useMutation({
    onSuccess: () => {
      toast.success("Contract added");
      utils.vendor.getById.invalidate();
      setContractOpen(false);
      setContractForm({ name: "", type: "DPA", description: "", documentUrl: "", startDate: "", endDate: "" });
    },
    onError: (error) => toast.error(error.message || "Failed to add contract"),
  });

  const scheduleReview = trpc.vendor.scheduleReview.useMutation({
    onSuccess: () => {
      toast.success("Review scheduled");
      utils.vendor.getById.invalidate();
      setReviewOpen(false);
      setReviewForm({ reviewerId: "", type: "PERIODIC", scheduledAt: "" });
    },
    onError: (error) => toast.error(error.message || "Failed to schedule review"),
  });

  const deleteVendor = trpc.vendor.delete.useMutation({
    onSuccess: () => {
      toast.success("Vendor deleted");
      utils.vendor.list.invalidate();
      router.push("/privacy/vendors");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete vendor");
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      deleteVendor.mutate({ organizationId: organization?.id ?? "", id });
    }
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
        <p className="text-muted-foreground">Vendor not found</p>
        <Link href="/privacy/vendors">
          <Button variant="outline" className="mt-4">
            Back to Vendors
          </Button>
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
            <Button variant="ghost" size="icon">
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
                {vendor.status.replace("_", " ")}
              </Badge>
              {vendor.riskTier && (
                <Badge variant="outline" className={riskColors[vendor.riskTier] || ""}>
                  {vendor.riskTier} Risk
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {(vendor.categories as string[])?.join(" - ") || "No categories"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={deleteVendor.isPending}>
            {deleteVendor.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete
          </Button>
          <Button onClick={openEditDialog}>Edit Vendor</Button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-sm">Website</span>
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
              <span className="text-muted-foreground">-</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="w-4 h-4" />
              <span className="text-sm">Contact</span>
            </div>
            <p className="font-medium">{vendor.primaryContact || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Mail className="w-4 h-4" />
              <span className="text-sm">Email</span>
            </div>
            {vendor.contactEmail ? (
              <a href={`mailto:${vendor.contactEmail}`} className="text-primary hover:underline">
                {vendor.contactEmail}
              </a>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Added</span>
            </div>
            <p className="font-medium">{new Date(vendor.createdAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Contracts ({vendor.contracts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {vendor.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{vendor.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Processing</CardTitle>
                <CardDescription>Categories of data this vendor processes</CardDescription>
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
                  <p className="text-muted-foreground text-sm">No data categories specified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Countries</CardTitle>
                <CardDescription>Data transfer locations</CardDescription>
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
                  <p className="text-muted-foreground text-sm">No countries specified</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Certifications</CardTitle>
              <CardDescription>Security and compliance certifications</CardDescription>
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
                <p className="text-muted-foreground text-sm">No certifications recorded</p>
              )}
            </CardContent>
          </Card>

          {/* Privacy Technologies */}
          {(vendor.metadata as any)?.privacyTechnologies?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Privacy Technologies</CardTitle>
                <CardDescription>Privacy enhancing technologies used by this vendor</CardDescription>
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
                  Add Contract
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
                              Start: {new Date(contract.startDate).toLocaleDateString()}
                              {contract.endDate && (
                                <> — End: {new Date(contract.endDate).toLocaleDateString()}</>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      {contract.documentUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={contract.documentUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled title="No document URL on this contract">
                          No document
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
                <p>No contracts recorded</p>
                <Button className="mt-4" onClick={() => setContractOpen(true)}>
                  Add Contract
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No vendor assessments completed</p>
              <Link href={`/privacy/assessments/new?vendorId=${id}&vendorName=${encodeURIComponent(vendor.name)}`}>
                <Button className="mt-4">Start Assessment</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No reviews scheduled</p>
              <Button className="mt-4" onClick={() => setReviewOpen(true)}>
                Schedule Review
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Vendor Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
            <DialogDescription>Update core vendor details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                placeholder="https://…"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as VendorStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROSPECTIVE">Prospective</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Risk Tier</Label>
                <Select
                  value={editForm.riskTier ?? "__none"}
                  onValueChange={(v) => setEditForm({ ...editForm, riskTier: v === "__none" ? null : (v as VendorRiskTier) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not set</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-contact">Primary Contact</Label>
                <Input
                  id="edit-contact"
                  value={editForm.primaryContact}
                  onChange={(e) => setEditForm({ ...editForm, primaryContact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Contact Email</Label>
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
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
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contract Dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Contract</DialogTitle>
            <DialogDescription>Record a contract, DPA, or SCC for this vendor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name *</Label>
              <Input
                id="c-name"
                placeholder="e.g., Master Services Agreement 2026"
                value={contractForm.name}
                onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={contractForm.type}
                onValueChange={(v) => setContractForm({ ...contractForm, type: v as ContractType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DPA">DPA (Data Processing Agreement)</SelectItem>
                  <SelectItem value="SCC">SCC (Standard Contractual Clauses)</SelectItem>
                  <SelectItem value="MSA">MSA (Master Services Agreement)</SelectItem>
                  <SelectItem value="NDA">NDA</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">Description</Label>
              <Textarea
                id="c-desc"
                rows={2}
                value={contractForm.description}
                onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-url">Document URL</Label>
              <Input
                id="c-url"
                placeholder="https://…"
                value={contractForm.documentUrl}
                onChange={(e) => setContractForm({ ...contractForm, documentUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-start">Start Date</Label>
                <Input
                  id="c-start"
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-end">End Date</Label>
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
            <Button variant="outline" onClick={() => setContractOpen(false)}>Cancel</Button>
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
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Review</DialogTitle>
            <DialogDescription>Assign a reviewer and date for this vendor&apos;s next review.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reviewer *</Label>
              <Select
                value={reviewForm.reviewerId}
                onValueChange={(v) => setReviewForm({ ...reviewForm, reviewerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reviewer" />
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
              <Label>Review Type</Label>
              <Select
                value={reviewForm.type}
                onValueChange={(v) => setReviewForm({ ...reviewForm, type: v as ReviewType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERIODIC">Periodic</SelectItem>
                  <SelectItem value="INITIAL">Initial</SelectItem>
                  <SelectItem value="INCIDENT_TRIGGERED">Incident-triggered</SelectItem>
                  <SelectItem value="CONTRACT_RENEWAL">Contract renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-date">Scheduled Date *</Label>
              <Input
                id="r-date"
                type="date"
                value={reviewForm.scheduledAt}
                onChange={(e) => setReviewForm({ ...reviewForm, scheduledAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
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
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

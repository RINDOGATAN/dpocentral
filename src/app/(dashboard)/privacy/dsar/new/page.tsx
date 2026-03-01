"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { DSARType } from "@prisma/client";

const typeOptions: { value: DSARType; label: string; description: string }[] = [
  { value: "ACCESS", label: "Access", description: "Right to obtain a copy of personal data" },
  { value: "RECTIFICATION", label: "Rectification", description: "Right to correct inaccurate data" },
  { value: "ERASURE", label: "Erasure", description: "Right to deletion (right to be forgotten)" },
  { value: "PORTABILITY", label: "Portability", description: "Right to receive data in a portable format" },
  { value: "OBJECTION", label: "Objection", description: "Right to object to data processing" },
  { value: "RESTRICTION", label: "Restriction", description: "Right to restrict processing" },
];

const relationshipOptions = [
  "Customer",
  "Employee",
  "Former Employee",
  "Job Applicant",
  "Contractor",
  "Website Visitor",
  "Other",
];

export default function NewDSARRequestPage() {
  const router = useRouter();
  const { organization } = useOrganization();

  const [form, setForm] = useState({
    type: "" as string,
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    requesterAddress: "",
    relationship: "",
    description: "",
    requestedData: "",
  });

  const createRequest = trpc.dsar.create.useMutation({
    onSuccess: (data) => {
      toast.success("DSAR request created");
      router.push(`/privacy/dsar/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create request");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !form.type || !form.requesterName || !form.requesterEmail) return;

    createRequest.mutate({
      organizationId: organization.id,
      type: form.type as DSARType,
      requesterName: form.requesterName,
      requesterEmail: form.requesterEmail,
      requesterPhone: form.requesterPhone || undefined,
      requesterAddress: form.requesterAddress || undefined,
      relationship: form.relationship || undefined,
      description: form.description || undefined,
      requestedData: form.requestedData || undefined,
    });
  };

  const isValid = form.type && form.requesterName && form.requesterEmail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/dsar">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">New DSAR Request</h1>
          <p className="text-sm text-muted-foreground">
            Log a data subject access request
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Type</CardTitle>
            <CardDescription>Select the type of data subject request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: opt.value })}
                  className={`text-left p-4 border transition-colors ${
                    form.type === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Requester Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requester Information</CardTitle>
            <CardDescription>Details of the data subject making the request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requesterName">Full Name *</Label>
                <Input
                  id="requesterName"
                  placeholder="e.g., John Doe"
                  value={form.requesterName}
                  onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requesterEmail">Email Address *</Label>
                <Input
                  id="requesterEmail"
                  type="email"
                  placeholder="e.g., john@example.com"
                  value={form.requesterEmail}
                  onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requesterPhone">Phone Number</Label>
                <Input
                  id="requesterPhone"
                  placeholder="e.g., +34 600 000 000"
                  value={form.requesterPhone}
                  onChange={(e) => setForm({ ...form, requesterPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Select
                  value={form.relationship}
                  onValueChange={(value) => setForm({ ...form, relationship: value })}
                >
                  <SelectTrigger id="relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map((rel) => (
                      <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requesterAddress">Address</Label>
              <Input
                id="requesterAddress"
                placeholder="e.g., 123 Main St, City, Country"
                value={form.requesterAddress}
                onChange={(e) => setForm({ ...form, requesterAddress: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Details</CardTitle>
            <CardDescription>Additional information about the request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the request in detail..."
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestedData">Specific Data Requested</Label>
              <Textarea
                id="requestedData"
                placeholder="e.g., All marketing communications, CRM records, billing history..."
                rows={2}
                value={form.requestedData}
                onChange={(e) => setForm({ ...form, requestedData: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/privacy/dsar">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={!isValid || createRequest.isPending}>
            {createRequest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Request
          </Button>
        </div>
      </form>
    </div>
  );
}

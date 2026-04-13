"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DSARType } from "@prisma/client";

const REQUEST_TYPE_META: Record<DSARType, { label: string; description: string }> = {
  ACCESS: { label: "Access my data", description: "Get a copy of the personal data held about you" },
  ERASURE: { label: "Delete my data", description: "Request deletion of your personal data" },
  RECTIFICATION: { label: "Correct my data", description: "Request correction of inaccurate personal data" },
  PORTABILITY: { label: "Export my data", description: "Receive your data in a portable format" },
  OBJECTION: { label: "Object to processing", description: "Object to how your data is processed" },
  RESTRICTION: { label: "Restrict processing", description: "Limit how your data is used" },
  AUTOMATED_DECISION: { label: "Automated decisions", description: "Request human review of automated decisions" },
  WITHDRAW_CONSENT: { label: "Withdraw consent", description: "Withdraw previously given consent" },
  OTHER: { label: "Other request", description: "A different data protection request" },
};

export default function PublicDSARPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const { data: formConfig, isLoading: configLoading, error: configError } =
    trpc.dsar.getPublicForm.useQuery({ orgSlug }, { retry: false });

  const submitMutation = trpc.dsar.submitPublic.useMutation();

  const [consentGiven, setConsentGiven] = useState(false);
  const [formData, setFormData] = useState({
    type: "" as DSARType | "",
    name: "",
    email: "",
    phone: "",
    relationship: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type) return;
    submitMutation.mutate({
      orgSlug,
      type: formData.type,
      requesterName: formData.name,
      requesterEmail: formData.email,
      requesterPhone: formData.phone || undefined,
      relationship: formData.relationship || undefined,
      description: formData.description || undefined,
    });
  };

  // Loading state
  if (configLoading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Bad slug / no active form
  if (configError || !formConfig) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Request form not available</CardTitle>
            <CardDescription>
              We couldn&apos;t find an active data subject request form for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please check the link you used, or contact the organization directly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation state — mutation succeeded
  if (submitMutation.isSuccess && submitMutation.data) {
    const publicId = submitMutation.data.publicId;
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Request Submitted</CardTitle>
            <CardDescription>
              {formConfig.thankYouMessage || "Your data subject request has been received"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Your reference number</p>
              <p className="text-2xl font-mono font-bold break-all">{publicId}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              We will review your request and respond within the legally required timeframe.
              You will receive updates at {formData.email}.
            </p>
            <Button variant="outline" asChild>
              <a href={`/dsar/status/${publicId}`}>Check Request Status</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enabledTypes = formConfig.enabledTypes.length > 0
    ? formConfig.enabledTypes
    : (Object.keys(REQUEST_TYPE_META) as DSARType[]);

  return (
    <div className="min-h-screen bg-muted/50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">{formConfig.title}</h1>
          <p className="text-muted-foreground mt-1">
            {formConfig.description || `Submit a request regarding your personal data held by ${formConfig.orgName}`}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Request</CardTitle>
            <CardDescription>
              Please provide the information below so we can process your request
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>What would you like to do?</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as DSARType })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledTypes.map((type) => {
                      const meta = REQUEST_TYPE_META[type];
                      return (
                        <SelectItem key={type} value={type}>
                          <div>
                            <p className="font-medium">{meta.label}</p>
                            <p className="text-xs text-muted-foreground">{meta.description}</p>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship *</Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) => setFormData({ ...formData, relationship: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="job_applicant">Job Applicant</SelectItem>
                      <SelectItem value="website_visitor">Website Visitor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Additional Details</Label>
                <Textarea
                  id="description"
                  placeholder="Please provide any additional information that may help us process your request..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Your contact details will be processed solely to verify your identity and fulfill
                  this data subject request. Your personal data will be retained for the duration of
                  request processing and automatically redacted within {formConfig.retentionDays} days of completion.
                  {formConfig.privacyNoticeUrl && (
                    <>
                      {" "}
                      See our{" "}
                      <a
                        href={formConfig.privacyNoticeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        privacy notice
                      </a>{" "}
                      for full details.
                    </>
                  )}
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                  />
                  <label htmlFor="consent" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                    I understand that my contact details will be processed to fulfill this request
                    and consent to this processing.
                  </label>
                </div>
              </div>

              {submitMutation.error && (
                <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
                  {submitMutation.error.message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending || !consentGiven || !formData.type}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

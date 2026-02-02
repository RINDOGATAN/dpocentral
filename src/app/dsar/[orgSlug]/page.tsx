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
import { Shield, CheckCircle2, Loader2 } from "lucide-react";

const requestTypes = [
  { value: "ACCESS", label: "Access my data", description: "Get a copy of the personal data we hold about you" },
  { value: "ERASURE", label: "Delete my data", description: "Request deletion of your personal data" },
  { value: "RECTIFICATION", label: "Correct my data", description: "Request correction of inaccurate personal data" },
  { value: "PORTABILITY", label: "Export my data", description: "Receive your data in a portable format" },
  { value: "OBJECTION", label: "Object to processing", description: "Object to how we process your data" },
  { value: "RESTRICTION", label: "Restrict processing", description: "Limit how we use your data" },
];

export default function PublicDSARPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: "",
    name: "",
    email: "",
    phone: "",
    relationship: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setRequestId("DSR-" + Math.random().toString(36).substring(2, 10).toUpperCase());
    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  if (isSubmitted && requestId) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>Request Submitted</CardTitle>
            <CardDescription>
              Your data subject request has been received
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Your reference number</p>
              <p className="text-2xl font-mono font-bold">{requestId}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              We will review your request and respond within the legally required timeframe.
              You will receive updates at {formData.email}.
            </p>
            <Button variant="outline" asChild>
              <a href={`/dsar/status/${requestId}`}>Check Request Status</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Data Subject Request</h1>
          <p className="text-muted-foreground mt-1">
            Submit a request regarding your personal data
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Request</CardTitle>
            <CardDescription>
              Please provide the information below so we can process your request
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Request Type */}
              <div className="space-y-2">
                <Label>What would you like to do?</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <p className="font-medium">{type.label}</p>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Information */}
              <div className="grid gap-4 md:grid-cols-2">
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

              <div className="grid gap-4 md:grid-cols-2">
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

              {/* Additional Details */}
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

              {/* Privacy Notice */}
              <div className="text-xs text-muted-foreground p-4 bg-muted rounded-lg">
                <p>
                  By submitting this form, you acknowledge that we will process your personal data
                  to fulfill your request. We may need to verify your identity before processing.
                  For more information, please see our Privacy Policy.
                </p>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
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

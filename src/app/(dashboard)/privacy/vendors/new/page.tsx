"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";

const vendorCategories = [
  { value: "CLOUD_SERVICES", label: "Cloud Services" },
  { value: "DATA_PROCESSING", label: "Data Processing" },
  { value: "ANALYTICS", label: "Analytics" },
  { value: "MARKETING", label: "Marketing" },
  { value: "HR_SERVICES", label: "HR Services" },
  { value: "PAYMENT_PROCESSING", label: "Payment Processing" },
  { value: "CUSTOMER_SUPPORT", label: "Customer Support" },
  { value: "IT_SECURITY", label: "IT Security" },
  { value: "LEGAL", label: "Legal" },
  { value: "OTHER", label: "Other" },
];

const riskTiers = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const dataCategories = [
  { value: "IDENTIFIERS", label: "Identifiers" },
  { value: "DEMOGRAPHICS", label: "Demographics" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "HEALTH", label: "Health" },
  { value: "LOCATION", label: "Location" },
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "EMPLOYMENT", label: "Employment" },
];

export default function NewVendorPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website: "",
    contactName: "",
    contactEmail: "",
    categories: [] as string[],
    dataProcessed: [] as string[],
    countries: [] as string[],
    riskTier: "",
  });

  const [newCountry, setNewCountry] = useState("");

  const utils = trpc.useUtils();

  const createVendor = trpc.vendor.create.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      router.push("/privacy/vendors");
    },
    onError: (error) => {
      console.error("Failed to create vendor:", error);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !formData.name) return;

    setIsSubmitting(true);

    createVendor.mutate({
      organizationId: organization.id,
      name: formData.name,
      description: formData.description || undefined,
      website: formData.website || undefined,
      primaryContact: formData.contactName || undefined,
      contactEmail: formData.contactEmail || undefined,
      categories: formData.categories,
      dataProcessed: formData.dataProcessed as any[],
      countries: formData.countries,
    });
  };

  const toggleCategory = (value: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.includes(value)
        ? formData.categories.filter((c) => c !== value)
        : [...formData.categories, value],
    });
  };

  const toggleDataProcessed = (value: string) => {
    setFormData({
      ...formData,
      dataProcessed: formData.dataProcessed.includes(value)
        ? formData.dataProcessed.filter((d) => d !== value)
        : [...formData.dataProcessed, value],
    });
  };

  const addCountry = () => {
    if (newCountry && !formData.countries.includes(newCountry)) {
      setFormData({ ...formData, countries: [...formData.countries, newCountry] });
      setNewCountry("");
    }
  };

  const removeCountry = (country: string) => {
    setFormData({ ...formData, countries: formData.countries.filter((c) => c !== country) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/privacy/vendors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Add Vendor</h1>
          <p className="text-muted-foreground">
            Register a new third-party vendor
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Information</CardTitle>
            <CardDescription>
              Basic details about the vendor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Acme Cloud Services"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the vendor and services provided..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  placeholder="John Smith"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="contact@vendor.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories & Risk</CardTitle>
            <CardDescription>
              Classify the vendor and assess risk level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Service Categories</Label>
              <div className="flex flex-wrap gap-2">
                {vendorCategories.map((cat) => (
                  <Badge
                    key={cat.value}
                    variant={formData.categories.includes(cat.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat.value)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskTier">Risk Tier</Label>
              <Select
                value={formData.riskTier}
                onValueChange={(value) => setFormData({ ...formData, riskTier: value })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select risk tier" />
                </SelectTrigger>
                <SelectContent>
                  {riskTiers.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Processing</CardTitle>
            <CardDescription>
              What data does this vendor process?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Data Categories Processed</Label>
              <div className="flex flex-wrap gap-2">
                {dataCategories.map((cat) => (
                  <Badge
                    key={cat.value}
                    variant={formData.dataProcessed.includes(cat.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleDataProcessed(cat.value)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Countries (Data Transfer)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., United States"
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCountry())}
                />
                <Button type="button" variant="outline" onClick={addCountry}>
                  Add
                </Button>
              </div>
              {formData.countries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.countries.map((country) => (
                    <Badge key={country} variant="secondary">
                      {country}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={() => removeCountry(country)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {createVendor.error && (
          <div className="text-sm text-destructive">
            Error: {createVendor.error.message}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/privacy/vendors">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || !formData.name}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Vendor"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

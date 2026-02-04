"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  ArrowLeft,
  Loader2,
  X,
  Search,
  Building2,
  CheckCircle2,
  Shield,
  ExternalLink,
  Sparkles,
} from "lucide-react";
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

// Type for catalog vendor
interface CatalogVendor {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  website: string | null;
  privacyPolicyUrl: string | null;
  trustCenterUrl: string | null;
  dpaUrl: string | null;
  securityPageUrl: string | null;
  certifications: string[];
  frameworks: string[];
  gdprCompliant: boolean | null;
  ccpaCompliant: boolean | null;
  hipaaCompliant: boolean | null;
  dataLocations: string[];
  hasEuDataCenter: boolean | null;
  isVerified: boolean;
}

function NewVendorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catalog mode state
  const isCatalogMode = searchParams.get("catalog") === "true";
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogVendor, setSelectedCatalogVendor] = useState<CatalogVendor | null>(null);
  const [showCatalogResults, setShowCatalogResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowCatalogResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    // Additional fields from catalog
    privacyPolicyUrl: "",
    trustCenterUrl: "",
    dpaUrl: "",
    certifications: [] as string[],
  });

  const [newCountry, setNewCountry] = useState("");

  const utils = trpc.useUtils();

  // Catalog search query
  const { data: catalogResults, isLoading: isSearching } = trpc.vendorCatalog.search.useQuery(
    { query: catalogSearch, limit: 10 },
    { enabled: catalogSearch.length >= 2 }
  );

  // Catalog categories for filtering
  const { data: catalogCategories } = trpc.vendorCatalog.listCategories.useQuery(
    undefined,
    { enabled: isCatalogMode }
  );

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

  // Auto-fill form when catalog vendor is selected
  const selectCatalogVendor = (vendor: CatalogVendor) => {
    setSelectedCatalogVendor(vendor);
    setShowCatalogResults(false);
    setCatalogSearch(vendor.name);

    // Map catalog category to our categories
    const categoryMapping: Record<string, string> = {
      "Marketing Automation": "MARKETING",
      "Email Marketing": "MARKETING",
      "AB Testing": "ANALYTICS",
      "Lead Generation": "MARKETING",
      "AI Chatbot": "CUSTOMER_SUPPORT",
      "AI Model": "DATA_PROCESSING",
      "AI Assistants": "DATA_PROCESSING",
      "Analytics": "ANALYTICS",
      "Web Analytics": "ANALYTICS",
      "Social Media": "MARKETING",
      "Advertising": "MARKETING",
      "Cloud Services": "CLOUD_SERVICES",
      "Payment": "PAYMENT_PROCESSING",
      "HR": "HR_SERVICES",
      "Security": "IT_SECURITY",
      "Legal": "LEGAL",
    };

    const mappedCategory = categoryMapping[vendor.category] || "OTHER";

    setFormData({
      ...formData,
      name: vendor.name,
      description: vendor.description || "",
      website: vendor.website || "",
      categories: [mappedCategory],
      countries: vendor.dataLocations || [],
      privacyPolicyUrl: vendor.privacyPolicyUrl || "",
      trustCenterUrl: vendor.trustCenterUrl || "",
      dpaUrl: vendor.dpaUrl || "",
      certifications: vendor.certifications || [],
    });
  };

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

  const clearCatalogSelection = () => {
    setSelectedCatalogVendor(null);
    setCatalogSearch("");
    setFormData({
      name: "",
      description: "",
      website: "",
      contactName: "",
      contactEmail: "",
      categories: [],
      dataProcessed: [],
      countries: [],
      riskTier: "",
      privacyPolicyUrl: "",
      trustCenterUrl: "",
      dpaUrl: "",
      certifications: [],
    });
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
          <h1 className="text-2xl font-semibold">
            {isCatalogMode ? "Add from Vendor Catalog" : "Add Vendor"}
          </h1>
          <p className="text-muted-foreground">
            {isCatalogMode
              ? "Search pre-audited vendors and auto-fill compliance data"
              : "Register a new third-party vendor"}
          </p>
        </div>
      </div>

      {/* Catalog Search Section */}
      {isCatalogMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle>Vendor Catalog Search</CardTitle>
            </div>
            <CardDescription>
              Search 400+ pre-audited MarTech, AI, and SaaS vendors with compliance data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCatalogVendor ? (
              // Selected vendor display
              <div className="border border-primary/50 bg-background p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{selectedCatalogVendor.name}</span>
                        {selectedCatalogVendor.isVerified && (
                          <Badge variant="outline" className="border-primary text-primary">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedCatalogVendor.category}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearCatalogSelection}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Compliance badges */}
                <div className="flex flex-wrap gap-2">
                  {selectedCatalogVendor.gdprCompliant && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      GDPR
                    </Badge>
                  )}
                  {selectedCatalogVendor.ccpaCompliant && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      CCPA
                    </Badge>
                  )}
                  {selectedCatalogVendor.certifications.map((cert) => (
                    <Badge key={cert} variant="outline" className="text-xs">
                      {cert}
                    </Badge>
                  ))}
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {selectedCatalogVendor.website && (
                    <a
                      href={selectedCatalogVendor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Website <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedCatalogVendor.privacyPolicyUrl && (
                    <a
                      href={selectedCatalogVendor.privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Privacy Policy <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedCatalogVendor.dpaUrl && (
                    <a
                      href={selectedCatalogVendor.dpaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      DPA <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedCatalogVendor.trustCenterUrl && (
                    <a
                      href={selectedCatalogVendor.trustCenterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Trust Center <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Form fields have been auto-filled from catalog data. Review and edit as needed.
                </p>
              </div>
            ) : (
              // Search input
              <div className="relative" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors (e.g., Google Analytics, Mailchimp, HubSpot)..."
                  className="pl-9"
                  value={catalogSearch}
                  onChange={(e) => {
                    setCatalogSearch(e.target.value);
                    setShowCatalogResults(true);
                  }}
                  onFocus={() => setShowCatalogResults(true)}
                />

                {/* Search results dropdown */}
                {showCatalogResults && catalogSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border shadow-lg z-50 max-h-80 overflow-y-auto">
                    {isSearching ? (
                      <div className="p-4 text-center">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground mt-2">Searching catalog...</p>
                      </div>
                    ) : catalogResults && catalogResults.length > 0 ? (
                      catalogResults.map((vendor) => (
                        <button
                          key={vendor.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-muted/50 border-b last:border-b-0 flex items-center gap-3"
                          onClick={() => selectCatalogVendor(vendor)}
                        >
                          <div className="w-8 h-8 border flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{vendor.name}</span>
                              {vendor.isVerified && (
                                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {vendor.category}
                              {vendor.description && ` • ${vendor.description.substring(0, 50)}...`}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {vendor.gdprCompliant && (
                              <Badge variant="outline" className="text-xs px-1.5">GDPR</Badge>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        <p className="text-sm">No vendors found for &quot;{catalogSearch}&quot;</p>
                        <p className="text-xs mt-1">Try a different search term or add manually below</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!selectedCatalogVendor && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Can&apos;t find the vendor? Fill in the form below manually.
                </p>
                <Link href="/privacy/vendors/new">
                  <Button variant="link" size="sm" className="text-primary">
                    Skip catalog search
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

        {/* Compliance Info Card - only show if we have catalog data */}
        {selectedCatalogVendor && (formData.certifications.length > 0 || formData.privacyPolicyUrl || formData.dpaUrl) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Compliance Information
                <Badge variant="outline" className="text-xs">From Catalog</Badge>
              </CardTitle>
              <CardDescription>
                Pre-audited compliance data from the vendor catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.certifications.length > 0 && (
                <div className="space-y-2">
                  <Label>Certifications</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.certifications.map((cert) => (
                      <Badge key={cert} variant="outline">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {formData.privacyPolicyUrl && (
                  <div className="space-y-2">
                    <Label>Privacy Policy URL</Label>
                    <div className="flex gap-2">
                      <Input value={formData.privacyPolicyUrl} readOnly className="bg-muted" />
                      <a href={formData.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline" size="icon">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
                {formData.dpaUrl && (
                  <div className="space-y-2">
                    <Label>DPA URL</Label>
                    <div className="flex gap-2">
                      <Input value={formData.dpaUrl} readOnly className="bg-muted" />
                      <a href={formData.dpaUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline" size="icon">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {formData.trustCenterUrl && (
                <div className="space-y-2">
                  <Label>Trust Center URL</Label>
                  <div className="flex gap-2">
                    <Input value={formData.trustCenterUrl} readOnly className="bg-muted" />
                    <a href={formData.trustCenterUrl} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline" size="icon">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

export default function NewVendorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <NewVendorPageContent />
    </Suspense>
  );
}

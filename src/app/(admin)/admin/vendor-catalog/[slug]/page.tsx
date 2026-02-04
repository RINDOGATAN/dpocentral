"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle2,
  Globe,
  Shield,
  FileText,
  Link as LinkIcon,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function VendorCatalogEditPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const utils = trpc.useUtils();

  const { data: vendor, isLoading } = trpc.vendorCatalog.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    subcategory: "",
    description: "",
    website: "",
    privacyPolicyUrl: "",
    trustCenterUrl: "",
    dpaUrl: "",
    securityPageUrl: "",
    certifications: [] as string[],
    frameworks: [] as string[],
    gdprCompliant: false,
    ccpaCompliant: false,
    hipaaCompliant: false,
    dataLocations: [] as string[],
    hasEuDataCenter: false,
    logoUrl: "",
    isVerified: false,
  });

  const [certificationsInput, setCertificationsInput] = useState("");
  const [dataLocationsInput, setDataLocationsInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || "",
        category: vendor.category || "",
        subcategory: vendor.subcategory || "",
        description: vendor.description || "",
        website: vendor.website || "",
        privacyPolicyUrl: vendor.privacyPolicyUrl || "",
        trustCenterUrl: vendor.trustCenterUrl || "",
        dpaUrl: vendor.dpaUrl || "",
        securityPageUrl: vendor.securityPageUrl || "",
        certifications: vendor.certifications || [],
        frameworks: vendor.frameworks || [],
        gdprCompliant: vendor.gdprCompliant || false,
        ccpaCompliant: vendor.ccpaCompliant || false,
        hipaaCompliant: vendor.hipaaCompliant || false,
        dataLocations: vendor.dataLocations || [],
        hasEuDataCenter: vendor.hasEuDataCenter || false,
        logoUrl: vendor.logoUrl || "",
        isVerified: vendor.isVerified || false,
      });
      setCertificationsInput((vendor.certifications || []).join(", "));
      setDataLocationsInput((vendor.dataLocations || []).join(", "));
    }
  }, [vendor]);

  const updateVendor = trpc.vendorCatalog.update.useMutation({
    onSuccess: () => {
      utils.vendorCatalog.getBySlug.invalidate({ slug });
      utils.vendorCatalog.list.invalidate();
      utils.vendorCatalog.getStats.invalidate();
    },
  });

  const deleteVendor = trpc.vendorCatalog.delete.useMutation({
    onSuccess: () => {
      router.push("/admin/vendor-catalog");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse comma-separated inputs
    const certifications = certificationsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const dataLocations = dataLocationsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Build frameworks array from compliance flags
    const frameworks: string[] = [];
    if (formData.gdprCompliant) frameworks.push("GDPR");
    if (formData.ccpaCompliant) frameworks.push("CCPA");
    if (formData.hipaaCompliant) frameworks.push("HIPAA");

    updateVendor.mutate({
      slug,
      name: formData.name,
      category: formData.category,
      subcategory: formData.subcategory || null,
      description: formData.description || null,
      website: formData.website || null,
      privacyPolicyUrl: formData.privacyPolicyUrl || null,
      trustCenterUrl: formData.trustCenterUrl || null,
      dpaUrl: formData.dpaUrl || null,
      securityPageUrl: formData.securityPageUrl || null,
      certifications,
      frameworks,
      gdprCompliant: formData.gdprCompliant,
      ccpaCompliant: formData.ccpaCompliant,
      hipaaCompliant: formData.hipaaCompliant,
      dataLocations,
      hasEuDataCenter: formData.hasEuDataCenter,
      logoUrl: formData.logoUrl || null,
      isVerified: formData.isVerified,
    });
  };

  const handleDelete = () => {
    deleteVendor.mutate({ slug });
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
        <h2 className="text-xl font-semibold">Vendor not found</h2>
        <Link href="/admin/vendor-catalog" className="mt-4 inline-block">
          <Button variant="outline">Back to Catalog</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/vendor-catalog">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{vendor.name}</h1>
          <p className="text-muted-foreground">{vendor.slug}</p>
        </div>
        {vendor.isVerified && (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        )}
        <Badge variant="outline">{vendor.category}</Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>
              Core vendor details and categorization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategory</Label>
              <Input
                id="subcategory"
                value={formData.subcategory}
                onChange={(e) =>
                  setFormData({ ...formData, subcategory: e.target.value })
                }
                placeholder="Optional subcategory"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                placeholder="Brief description of the vendor's services"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                value={formData.logoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, logoUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Links & Resources
            </CardTitle>
            <CardDescription>
              Important URLs for compliance and due diligence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="privacyPolicyUrl">Privacy Policy URL</Label>
                <Input
                  id="privacyPolicyUrl"
                  type="url"
                  value={formData.privacyPolicyUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, privacyPolicyUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trustCenterUrl">Trust Center URL</Label>
                <Input
                  id="trustCenterUrl"
                  type="url"
                  value={formData.trustCenterUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, trustCenterUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dpaUrl">DPA URL</Label>
                <Input
                  id="dpaUrl"
                  type="url"
                  value={formData.dpaUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, dpaUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="securityPageUrl">Security Page URL</Label>
                <Input
                  id="securityPageUrl"
                  type="url"
                  value={formData.securityPageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, securityPageUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Compliance & Certifications
            </CardTitle>
            <CardDescription>
              Privacy frameworks and security certifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <Label>Privacy Frameworks</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gdprCompliant"
                    checked={formData.gdprCompliant}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      setFormData({ ...formData, gdprCompliant: checked === true })
                    }
                  />
                  <Label htmlFor="gdprCompliant" className="cursor-pointer">
                    GDPR Compliant
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ccpaCompliant"
                    checked={formData.ccpaCompliant}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      setFormData({ ...formData, ccpaCompliant: checked === true })
                    }
                  />
                  <Label htmlFor="ccpaCompliant" className="cursor-pointer">
                    CCPA Compliant
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hipaaCompliant"
                    checked={formData.hipaaCompliant}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      setFormData({ ...formData, hipaaCompliant: checked === true })
                    }
                  />
                  <Label htmlFor="hipaaCompliant" className="cursor-pointer">
                    HIPAA Compliant
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="certifications">Certifications</Label>
              <Input
                id="certifications"
                value={certificationsInput}
                onChange={(e) => setCertificationsInput(e.target.value)}
                placeholder="ISO 27001, SOC 2 Type II, PCI DSS (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">
                Enter certifications separated by commas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Processing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Data Processing
            </CardTitle>
            <CardDescription>
              Where and how the vendor processes data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataLocations">Data Processing Locations</Label>
              <Input
                id="dataLocations"
                value={dataLocationsInput}
                onChange={(e) => setDataLocationsInput(e.target.value)}
                placeholder="US, EU, UK, APAC (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">
                Enter country/region codes separated by commas
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasEuDataCenter"
                checked={formData.hasEuDataCenter}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  setFormData({ ...formData, hasEuDataCenter: checked === true })
                }
              />
              <Label htmlFor="hasEuDataCenter" className="cursor-pointer">
                Has EU Data Center
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Verification Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Verification Status
            </CardTitle>
            <CardDescription>
              Mark this vendor as verified after reviewing the information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isVerified"
                checked={formData.isVerified}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  setFormData({ ...formData, isVerified: checked === true })
                }
              />
              <Label htmlFor="isVerified" className="cursor-pointer">
                Mark as Verified
              </Label>
            </div>
            {vendor.verifiedAt && (
              <p className="text-sm text-muted-foreground">
                Verified on {new Date(vendor.verifiedAt).toLocaleDateString()} by{" "}
                {vendor.verifiedBy}
              </p>
            )}
            {vendor.source && (
              <p className="text-sm text-muted-foreground">
                Source: {vendor.source}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteVendor.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Vendor
          </Button>

          <div className="flex gap-2">
            <Link href="/admin/vendor-catalog">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={updateVendor.isPending}>
              {updateVendor.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {updateVendor.isSuccess && (
          <p className="text-sm text-green-600">Changes saved successfully!</p>
        )}
        {updateVendor.error && (
          <p className="text-sm text-destructive">{updateVendor.error.message}</p>
        )}
      </form>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Vendor
              </CardTitle>
              <CardDescription>
                Are you sure you want to delete "{vendor.name}" from the catalog?
                This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteVendor.isPending}
              >
                {deleteVendor.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

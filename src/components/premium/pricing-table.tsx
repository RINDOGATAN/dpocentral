"use client";

/**
 * Pricing Table Component
 *
 * Displays available premium skill packages and their pricing.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { brand } from "@/config/brand";

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  isPremium: boolean;
  skillPackageId?: string;
  isPopular?: boolean;
}

interface PricingTableProps {
  plans: PricingPlan[];
  organizationId: string;
  onUpgrade: (skillPackageId: string) => void;
  entitledSkillIds: string[];
}

export function PricingTable({
  plans,
  organizationId,
  onUpgrade,
  entitledSkillIds,
}: PricingTableProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isEntitled =
          plan.skillPackageId && entitledSkillIds.includes(plan.skillPackageId);

        return (
          <Card
            key={plan.id}
            className={`relative ${
              plan.isPopular ? "border-primary border-2" : ""
            }`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium">
                Most Popular
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {plan.isPremium && (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
                {plan.name}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground">/{plan.period}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {isEntitled ? (
                <Button className="w-full" disabled>
                  Current Plan
                </Button>
              ) : !plan.isPremium ? (
                <Button className="w-full" variant="outline" disabled>
                  Free
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() =>
                    plan.skillPackageId && onUpgrade(plan.skillPackageId)
                  }
                >
                  Upgrade
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Default pricing plans based on DPO Central skill packages
 */
export const defaultPricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Core",
    description: "Essential privacy management tools",
    price: "Free",
    period: "",
    isPremium: false,
    features: [
      "Data Inventory & ROPA",
      "DSAR Management",
      "Public DSAR Portal",
      "Incident Tracking",
      "LIA Assessments",
      "Custom Assessments",
      "Basic Vendor Management",
    ],
  },
  {
    id: "dpia",
    name: "DPIA",
    description: "Data Protection Impact Assessments",
    price: "€9",
    period: "month",
    isPremium: true,
    skillPackageId: "com.nel.dpocentral.dpia",
    features: [
      "GDPR Article 35 Assessments",
      "Risk Scoring",
      "Mitigation Tracking",
      "DPA Notifications",
      "Export to PDF/Word",
    ],
  },
  {
    id: "pia",
    name: "PIA",
    description: "Privacy Impact Assessments",
    price: "€9",
    period: "month",
    isPremium: true,
    skillPackageId: "com.nel.dpocentral.pia",
    features: [
      "Comprehensive PIA Templates",
      "Risk Scoring",
      "Mitigation Tracking",
      "Approval Workflows",
      "Export to PDF/Word",
    ],
  },
  {
    id: "tia",
    name: "TIA",
    description: "Transfer Impact Assessments",
    price: "€9",
    period: "month",
    isPremium: true,
    skillPackageId: "com.nel.dpocentral.tia",
    features: [
      "International Transfer Analysis",
      "Safeguard Documentation",
      "Risk Scoring",
      "Schrems II Compliance",
      "Export to PDF/Word",
    ],
  },
  {
    id: "vendor",
    name: "Vendor Risk",
    description: "Vendor Risk Assessments",
    price: "€9",
    period: "month",
    isPremium: true,
    skillPackageId: "com.nel.dpocentral.vendor",
    features: [
      "Vendor Risk Questionnaires",
      "Risk Scoring",
      "Due Diligence Templates",
      "Approval Workflows",
      "Export to PDF/Word",
    ],
  },
  {
    id: "vendor-catalog",
    name: "Vendor Catalog",
    description: "Pre-audited vendor database",
    price: "€9",
    period: "month",
    isPremium: true,
    skillPackageId: "com.nel.dpocentral.vendor-catalog",
    features: [
      "400+ Pre-audited Vendors",
      "Search & Autofill",
      "GDPR/CCPA Compliance Info",
      "Vendor Certifications",
      "Regular Database Updates",
    ],
  },
];

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import {
  SubscriptionStatusCard,
  ManageBillingButton,
} from "@/components/billing";
import {
  PricingTable,
  defaultPricingPlans,
} from "@/components/premium/pricing-table";
import { UpgradeModal } from "@/components/premium/upgrade-modal";

export default function BillingPage() {
  const { organization } = useOrganization();
  const [upgradeSkillId, setUpgradeSkillId] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } =
    trpc.billing.getSubscriptionStatus.useQuery(
      { organizationId: organization?.id ?? "" },
      { enabled: !!organization?.id }
    );

  if (statusLoading || !organization) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entitledSkillIds = (status?.entitlements ?? []).map((e) => e.skillId);

  // Find skill name for upgrade modal
  const upgradeSkill = upgradeSkillId
    ? defaultPricingPlans.find((p) => p.skillPackageId === upgradeSkillId)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and premium features
        </p>
      </div>

      {/* Current plan */}
      <SubscriptionStatusCard
        plan={status?.plan ?? "free"}
        entitlements={status?.entitlements ?? []}
      />

      {/* Manage billing button (only if they have a Stripe customer) */}
      {status?.stripeCustomerId && (
        <ManageBillingButton organizationId={organization.id} />
      )}

      {/* Pricing table */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Available Plans</h2>
        <PricingTable
          plans={defaultPricingPlans}
          organizationId={organization.id}
          onUpgrade={(skillPackageId) => setUpgradeSkillId(skillPackageId)}
          entitledSkillIds={entitledSkillIds}
        />
      </div>

      {/* Upgrade modal */}
      {upgradeSkill && (
        <UpgradeModal
          open={!!upgradeSkillId}
          onClose={() => setUpgradeSkillId(null)}
          organizationId={organization.id}
          skillPackageId={upgradeSkillId!}
          skillName={upgradeSkill.name}
          skillDescription={upgradeSkill.description}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Briefcase, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUserType } from "@/lib/use-user-type";
import { useOrganization } from "@/lib/organization-context";
import { brand } from "@/config/brand";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { UserType } from "@prisma/client";

const personas = [
  {
    type: "BUSINESS_OWNER" as UserType,
    icon: Building2,
    titleKey: "businessOwner" as const,
    descKey: "businessOwnerDesc" as const,
  },
  {
    type: "PRIVACY_PROFESSIONAL" as UserType,
    icon: Briefcase,
    titleKey: "privacyProfessional" as const,
    descKey: "privacyProfessionalDesc" as const,
  },
] as const;

export function OnboardingWelcome() {
  const t = useTranslations("onboarding");
  const tToasts = useTranslations("toasts");
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refreshSession } = useUserType();
  const { setOrganization, refetchOrganizations } = useOrganization();

  const setUserType = trpc.user.setUserType.useMutation();
  const createOrg = trpc.organization.create.useMutation();

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !orgName.trim()) return;

    setIsSubmitting(true);
    try {
      await setUserType.mutateAsync({ userType: selectedType });
      const slug = generateSlug(orgName);
      const org = await createOrg.mutateAsync({ name: orgName.trim(), slug, creatorType: selectedType });
      setOrganization(org);
      refetchOrganizations();
      await refreshSession();
    } catch (error) {
      console.error("Onboarding failed:", error);
      toast.error(tToasts("generic.somethingWentWrong"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedType && orgName.trim().length > 0 && !isSubmitting;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo-negative.svg" alt="TODO.LAW" style={{ height: "28px", width: "auto" }} />
            <span style={{ fontFamily: "var(--font-jost), 'Jost', sans-serif", fontWeight: 600 }}>{brand.nameUppercase}</span>
          </div>
          <h1 className="text-xl font-semibold">
            {t("welcome", { brandName: brand.nameUppercase })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Persona selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("howWillYouUse", { brandName: brand.nameUppercase })}
            </Label>
            <div className="grid gap-3">
              {personas.map((persona) => {
                const Icon = persona.icon;
                const isSelected = selectedType === persona.type;
                return (
                  <Card
                    key={persona.type}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedType(persona.type)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div
                        className={`p-3 rounded-lg shrink-0 ${
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-medium">{t(persona.titleKey)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(persona.descKey)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Organization name */}
          <div className="space-y-2">
            <Label htmlFor="onboarding-org-name">{t("orgName")}</Label>
            <Input
              id="onboarding-org-name"
              placeholder={t("orgNamePlaceholder")}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("settingUp")}
              </>
            ) : (
              t("getStarted")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

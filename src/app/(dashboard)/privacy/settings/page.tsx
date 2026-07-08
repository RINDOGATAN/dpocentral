"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Briefcase,
  Loader2,
  UserPlus,
  Trash2,
  Globe,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useUserType } from "@/lib/use-user-type";
import { useOrganization } from "@/lib/organization-context";
import { DeploymentExpertCta } from "@/components/privacy/deployment-expert-cta";
import { OrganizationRole, UserType } from "@prisma/client";
import { locales, localeNames, type Locale } from "@/i18n/config";

const personaIcons = {
  BUSINESS_OWNER: Building2,
  PRIVACY_PROFESSIONAL: Briefcase,
} as const;

const ROLE_OPTIONS: OrganizationRole[] = ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"];

export default function SettingsPage() {
  const _t = useTranslations("toasts");
  void _t;
  const ts = useTranslations("pages.settings");
  const tProfile = useTranslations("pages.settings.profile");
  const tAccountType = useTranslations("pages.settings.accountType");
  const tLang = useTranslations("pages.settings.language");
  const tOrg = useTranslations("pages.settings.organization");
  const tMembers = useTranslations("pages.settings.members");
  const { userType } = useUserType();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const locale = useLocale() as Locale;
  const utils = trpc.useUtils();

  const { data: profile } = trpc.user.getProfile.useQuery();
  const { data: org } = trpc.organization.getById.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const isOwner = org?.currentUserRole === "OWNER";
  const isAdmin = isOwner || org?.currentUserRole === "ADMIN";

  // ----- Profile -----
  const [profileName, setProfileName] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);

  useEffect(() => {
    if (profile?.name && !profileDirty) {
      setProfileName(profile.name);
    }
  }, [profile, profileDirty]);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success(tProfile("updated"));
      utils.user.getProfile.invalidate();
      setProfileDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const setUserType = trpc.user.setUserType.useMutation({
    onSuccess: () => {
      toast.success(tAccountType("updated"));
      utils.user.getProfile.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // ----- Locale -----
  const setLocale = (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    window.location.reload();
  };

  // ----- Organization -----
  const [orgForm, setOrgForm] = useState({ name: "", domain: "" });
  const [orgFormDirty, setOrgFormDirty] = useState(false);

  useEffect(() => {
    if (org?.name && !orgFormDirty) {
      setOrgForm({ name: org.name, domain: org.domain ?? "" });
    }
  }, [org, orgFormDirty]);

  const updateOrg = trpc.organization.update.useMutation({
    onSuccess: () => {
      toast.success(tOrg("updated"));
      utils.organization.getById.invalidate();
      setOrgFormDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // ----- Members -----
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("MEMBER");
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const addMember = trpc.organization.addMember.useMutation({
    onSuccess: () => {
      toast.success(tMembers("added"));
      utils.organization.getById.invalidate();
      setInviteEmail("");
      setInviteRole("MEMBER");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMember = trpc.organization.updateMember.useMutation({
    onSuccess: () => {
      toast.success(tMembers("roleUpdated"));
      utils.organization.getById.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMember = trpc.organization.removeMember.useMutation({
    onSuccess: () => {
      toast.success(tMembers("removed"));
      utils.organization.getById.invalidate();
      setMemberToRemove(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">{ts("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{ts("subtitle")}</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tProfile("title")}</CardTitle>
          <CardDescription>{tProfile("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{tProfile("name")}</Label>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(e) => {
                setProfileName(e.target.value);
                setProfileDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{tProfile("email")}</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              {profile?.email ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">{tProfile("emailHint")}</p>
          </div>
          {profileDirty && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setProfileName(profile?.name ?? "");
                  setProfileDirty(false);
                }}
              >
                {tProfile("cancel")}
              </Button>
              <Button
                size="sm"
                disabled={
                  updateProfile.isPending ||
                  !profileName.trim() ||
                  profileName === profile?.name
                }
                onClick={() => updateProfile.mutate({ name: profileName.trim() })}
              >
                {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {tProfile("save")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Type */}
      {userType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tAccountType("title")}</CardTitle>
            <CardDescription>{tAccountType("description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["BUSINESS_OWNER", "PRIVACY_PROFESSIONAL"] as const).map((type) => {
              const Icon = personaIcons[type];
              const isCurrent = userType === type;
              const label =
                type === "BUSINESS_OWNER"
                  ? tAccountType("businessOwner")
                  : tAccountType("privacyProfessional");
              const description =
                type === "BUSINESS_OWNER"
                  ? tAccountType("businessOwnerDesc")
                  : tAccountType("privacyProfessionalDesc");
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    if (!isCurrent && !setUserType.isPending) {
                      setUserType.mutate({ userType: type as UserType });
                    }
                  }}
                  disabled={isCurrent || setUserType.isPending}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg border text-left transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary/5 cursor-default"
                      : "hover:border-primary/40 cursor-pointer"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  {isCurrent && (
                    <Badge variant="outline" className="border-primary text-primary text-xs">
                      {tAccountType("current")}
                    </Badge>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" /> {tLang("title")}
          </CardTitle>
          <CardDescription>{tLang("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {locales.map((loc) => (
              <Button
                key={loc}
                variant={locale === loc ? "default" : "outline"}
                size="sm"
                onClick={() => setLocale(loc)}
                disabled={locale === loc}
              >
                {localeNames[loc]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      {org && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tOrg("title")}</CardTitle>
            <CardDescription>
              {isAdmin ? tOrg("descriptionAdmin") : tOrg("descriptionViewer")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">{tOrg("name")}</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={(e) => {
                  setOrgForm({ ...orgForm, name: e.target.value });
                  setOrgFormDirty(true);
                }}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-domain">{tOrg("domain")}</Label>
              <Input
                id="org-domain"
                placeholder="example.com"
                value={orgForm.domain}
                onChange={(e) => {
                  setOrgForm({ ...orgForm, domain: e.target.value });
                  setOrgFormDirty(true);
                }}
                disabled={!isAdmin}
              />
              <p className="text-xs text-muted-foreground">{tOrg("domainHint")}</p>
            </div>
            {isAdmin && orgFormDirty && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOrgForm({ name: org.name ?? "", domain: org.domain ?? "" });
                    setOrgFormDirty(false);
                  }}
                >
                  {tOrg("cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={updateOrg.isPending || !orgForm.name.trim()}
                  onClick={() =>
                    updateOrg.mutate({
                      organizationId: orgId,
                      name: orgForm.name.trim(),
                      domain: orgForm.domain.trim() || null,
                    })
                  }
                >
                  {updateOrg.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {tOrg("save")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      {org && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tMembers("title")}</CardTitle>
            <CardDescription>
              {isAdmin ? tMembers("descriptionAdmin") : tMembers("descriptionViewer")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2 pb-3 border-b">
                <Input
                  type="email"
                  placeholder={tMembers("inviteEmailPlaceholder")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as OrganizationRole)}
                >
                  <SelectTrigger className="sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.filter((r) => (isOwner ? true : r !== "OWNER")).map(
                      (role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() =>
                    addMember.mutate({
                      organizationId: orgId,
                      email: inviteEmail.trim(),
                      role: inviteRole,
                    })
                  }
                  disabled={addMember.isPending || !inviteEmail.trim()}
                >
                  {addMember.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {tMembers("add")}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {org.members?.map((member) => {
                const isSelf = member.userId === profile?.id;
                const canChange = isOwner && !isSelf;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 p-2 border rounded-md"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {member.user.name || member.user.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">{tMembers("you")}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                    </div>
                    {canChange ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          updateMember.mutate({
                            organizationId: orgId,
                            memberId: member.id,
                            role: v as OrganizationRole,
                          })
                        }
                        disabled={updateMember.isPending}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {member.role}
                      </Badge>
                    )}
                    {isAdmin && !isSelf && member.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tMembers("removeAria")}
                        onClick={() =>
                          setMemberToRemove({
                            id: member.id,
                            name: member.user.name || member.user.email || "—",
                          })
                        }
                        disabled={removeMember.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {!isAdmin && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                {tMembers("rolesLegend")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <DeploymentExpertCta />

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title={tMembers("removeConfirmTitle", { name: memberToRemove?.name ?? "—" })}
        description={tMembers("removeConfirmDescription")}
        confirmText={tMembers("removeConfirm")}
        danger
        pending={removeMember.isPending}
        onConfirm={() =>
          memberToRemove &&
          removeMember.mutate({ organizationId: orgId, memberId: memberToRemove.id })
        }
      />
    </div>
  );
}

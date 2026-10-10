"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The dashboard layout (Guided, the only one since Classic was retired on
 * 9 October 2026, owner's decision d11): a slim top bar, the privacy program
 * path as a left menu from the `lg` breakpoint, and on smaller screens a
 * one-line stage bar that opens the same path in the side sheet. The footer
 * and the feedback dialog come from dashboard-shell.tsx.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHelpButton } from "@/components/help/page-help-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useOrganization } from "@/lib/organization-context";
import { useUserType } from "@/lib/use-user-type";
import { MENU_COOKIE, cookieAssignment } from "@/lib/menu-cookie";
import { signOutOfSuite } from "@/lib/sign-out";
import { features, isDsarModuleEnabled } from "@/config/features";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { useMemberScope } from "@/lib/use-member-scope";
import { DPO_CENTRAL_PATH } from "./path-config";
import { currentStepId, nextStep, numberedStageCount, overallProgress, stageNumber, withoutOrgWideSteps, withoutSteps } from "./path";
import { useDsarAccess } from "@/lib/use-dsar-access";
import { useAuditAccess } from "@/lib/use-audit-access";
import { PathMenu } from "./path-menu";
import { DepartmentSwitch } from "./department-switch";
import { StepBand } from "./step-band";
import { ProgressBar } from "./progress-ring";
import { usePlanState, useProgramPath, useProgramPathRefresh } from "./use-program-path";
import { planDayText } from "./plan-text";
import { useProgrammeOverview } from "./use-programme-overview";
import { recordCountsText, stepNoteText } from "./document-words";
import { attentionStages, notYetEntries, stepDocumentRows } from "@/lib/programme-overview";
import { NewOrganizationDialog } from "@/components/privacy/new-organization-dialog";
import { trpc } from "@/lib/trpc";
import { lockedStepIds } from "@/lib/menu-locks";
import { useHostedPilot } from "@/components/pilot/hosted-pilot";

const OVERVIEW = { href: "/privacy", icon: LayoutDashboard };
/** The path a department-limited member sees: no quick start. */
const LIMITED_PATH = withoutOrgWideSteps(DPO_CENTRAL_PATH);
const ALL_CLIENTS_HREF = "/privacy/clients";
const DSAR_STEP_IDS = ["dsar"] as const;

const BRAND_STYLE = { fontFamily: "var(--font-jost), 'Jost', sans-serif", fontWeight: 600 } as const;

function BrandMark({ nameClassName }: { nameClassName?: string }) {
  return (
    <>
      <img src="/logo-negative.svg" alt="TODO.LAW" style={{ height: "28px", width: "auto" }} />
      <span className={cn("text-lg tracking-tight", nameClassName)} style={BRAND_STYLE}>
        {brand.nameUppercase}
      </span>
    </>
  );
}

export function GuidedLayout({
  children,
  footer,
  initialCollapsed,
  onFeedback,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Read from the `dpc_menu` cookie on the server, so the first paint is already right. */
  initialCollapsed: boolean;
  onFeedback: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const stepId = currentStepId(DPO_CENTRAL_PATH, pathname, search);
  const t = useTranslations("guided");
  const tn = useTranslations("nav");
  const td = useTranslations("documentRegister");
  const statuses = useProgramPath();
  // The document register's states and what needs action: the same answer
  // the dashboard panel reads (decisions d4 and d6).
  const { overview } = useProgrammeOverview();
  const plan = usePlanState();
  const { organization } = useOrganization();
  const { isProfessional } = useUserType();
  // A member limited to departments sees neither the quick start nor the
  // organisation-wide progress (src/lib/department-limit.ts).
  const { limited, orgWide } = useMemberScope();
  // The rights-requests step is left out for a member who may not read
  // requests (src/lib/dsar-access.ts).
  const { canHandle: canHandleDsars } = useDsarAccess();
  // The audit trail's library entry, for the roles that read it
  // (src/lib/audit-access.ts); not shown while the role is still loading.
  const { canRead: canReadAudit } = useAuditAccess();
  useProgramPathRefresh();
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [sheetOpen, setSheetOpen] = useState(false);
  // "New organization" / "Add a client" from the switcher (the entry Classic's
  // dashboard switcher had). The dialog lives here, not in the switcher, so
  // closing the phone sheet does not close it.
  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const router = useRouter();

  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    document.cookie = cookieAssignment(MENU_COOKIE, next ? "collapsed" : "open");
  };

  const menuProps = {
    config: limited ? LIMITED_PATH : DPO_CENTRAL_PATH,
    statuses: limited === null ? null : statuses,
    pathname,
    search,
    stripeEnabled: features.stripeEnabled,
    clientMode: isProfessional,
    auditTrail: canReadAudit === true,
    t,
    overview: OVERVIEW,
    planLine: orgWide ? planDayText(plan, t) : null,
    showProgress: !limited,
  };
  if (canHandleDsars === false) menuProps.config = withoutSteps(menuProps.config, DSAR_STEP_IDS);
  const stepRows = overview ? stepDocumentRows(menuProps.config, menuProps.statuses, overview.documents) : {};
  const stepNotes = Object.fromEntries(
    Object.entries(stepRows).map(([id, rows]) => [id, stepNoteText(td, rows, overview?.recordCounts ?? undefined)]),
  );
  const inventoryNote = overview?.recordCounts
    ? recordCountsText(td, "dataInventory", overview.recordCounts.dataInventory, { onlyIfDrafts: true })
    : null;
  if (inventoryNote) stepNotes.dataInventory = inventoryNote;
  const missing = notYetEntries({ dsarEnabled: isDsarModuleEnabled() });
  // A lock beside a step that leads to a premium type the organisation is not
  // entitled to, by the pages' own rule; never on the hosted pilot, which
  // therefore never asks (src/lib/menu-locks.ts).
  const hosted = useHostedPilot();
  const { data: entitled } = trpc.assessment.getEntitledTypes.useQuery(
    { organizationId: organization?.id ?? "" },
    { enabled: !!organization?.id && !hosted },
  );
  const fullMenuProps = {
    ...menuProps,
    stepNotes,
    attention: overview ? attentionStages(overview.needsAction) : [],
    notYet:
      missing.length > 0
        ? { title: t("notYetGroup"), items: missing.map((entry) => td(`items.${entry.id}`)) }
        : null,
    lockedSteps: lockedStepIds(menuProps.config, { entitledTypes: entitled?.entitledTypes, hosted }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setSheetOpen(true)}
            >
              <Menu className="w-5 h-5" />
              <span className="sr-only">{tn("openMenu")}</span>
            </Button>
            <Link href="/privacy" className="flex shrink-0 items-center gap-2">
              {/* The logo mark alone under `sm`, so "?" and Account stay on the
                  bar at 360 px; the name returns once there is room. */}
              <BrandMark nameClassName="hidden sm:inline" />
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <PageHelpButton />
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={onFeedback}
              title={tn("feedback")}
            >
              <MessageSquareWarning className="w-4 h-4" />
              <span className="sr-only">{tn("feedback")}</span>
            </Button>
            <LanguageSwitcher />
            <AccountMenu onFeedback={onFeedback} />
          </div>
        </div>
      </header>

      <PhoneStageBar statuses={statuses} showProgress={!limited} onOpen={() => setSheetOpen(true)} />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[340px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BrandMark />
            </SheetTitle>
          </SheetHeader>
          <div className="px-3 pb-6 flex flex-col gap-4">
            <OrganizationBlock
              onNavigate={() => setSheetOpen(false)}
              onAdd={() => {
                setSheetOpen(false);
                setAddOrgOpen(true);
              }}
            />
            <DepartmentSwitch />
            <PathMenu {...fullMenuProps} variant="sheet" onNavigate={() => setSheetOpen(false)} />
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 min-h-11 text-base rounded-lg"
              onClick={() => {
                setSheetOpen(false);
                onFeedback();
              }}
            >
              <MessageSquareWarning className="w-5 h-5 shrink-0" />
              {tn("feedback")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 min-w-0">
        <aside
          className={cn(
            "hidden lg:block shrink-0 self-stretch border-r border-border motion-safe:transition-[width] motion-safe:duration-200",
            collapsed ? "lg:w-[4.5rem]" : "lg:w-72",
          )}
        >
          <div className="sticky top-14 flex h-[calc(100dvh-3.5rem)] flex-col">
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                collapsed ? "px-2 py-3" : "px-3 py-4",
              )}
            >
              {!collapsed && <OrganizationBlock onAdd={() => setAddOrgOpen(true)} />}
              {!collapsed && (
                <div className="mt-3">
                  <DepartmentSwitch />
                </div>
              )}
              <div className={collapsed ? "" : "mt-4"}>
                <PathMenu {...fullMenuProps} variant="sidebar" collapsed={collapsed} />
              </div>
            </div>
            <div
              className={cn(
                "shrink-0 border-t border-border bg-background py-2",
                collapsed ? "px-2 flex justify-center" : "px-3",
              )}
            >
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                title={collapsed ? t("expand") : t("collapse")}
                className={cn(
                  "flex min-h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground motion-safe:transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  collapsed ? "size-11 justify-center px-0" : "w-full",
                )}
              >
                {collapsed ? (
                  <ChevronsRight className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronsLeft className="size-4" aria-hidden="true" />
                )}
                <span className={collapsed ? "sr-only" : ""}>{collapsed ? t("expand") : t("collapse")}</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0 flex-1">
            {/* Keyed by the organisation and the address: a "stage complete"
                message lasts for the page it was shown on. */}
            <StepBand
              key={`${organization?.id ?? ""}:${pathname}?${search}`}
              stepId={stepId}
              // No "stage complete" for a limited member: that is the whole
              // organisation's progress.
              statuses={orgWide ? statuses : null}
            />
            {children}
          </main>
          {footer}
        </div>
      </div>

      <NewOrganizationDialog
        open={addOrgOpen}
        onOpenChange={setAddOrgOpen}
        onCreated={() => router.push("/privacy")}
      />
    </div>
  );
}

/**
 * Top of the menu: the organisation. Its name opens a switcher with every
 * organisation the person belongs to and, at the foot, the way to add one
 * ("Add a client" for a privacy professional, "New organization" otherwise;
 * Classic offered it on its dashboard switcher to everyone). For a privacy
 * professional, "All clients" leads to the client overview.
 */
function OrganizationBlock({ onNavigate, onAdd }: { onNavigate?: () => void; onAdd: () => void }) {
  const { organization, organizations, setOrganization } = useOrganization();
  const { isProfessional } = useUserType();
  const t = useTranslations("guided");

  return (
    <div className="flex flex-col gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-secondary motion-safe:transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="organization-switcher"
          >
            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] text-muted-foreground">
                {isProfessional ? t("switchClient") : t("switchOrganization")}
              </span>
              <span className="truncate text-sm font-medium">{organization?.name}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[240px]">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setOrganization(org)}
              className={org.id === organization?.id ? "bg-primary/10 text-primary" : ""}
            >
              {org.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onAdd} className="flex items-center gap-2" data-testid="organization-add">
            <Plus className="size-4" aria-hidden="true" />
            {isProfessional ? t("addClient") : t("newOrganization")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isProfessional && (
        <Link
          href={ALL_CLIENTS_HREF}
          onClick={onNavigate}
          className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground motion-safe:transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Briefcase className="size-4 shrink-0" aria-hidden="true" />
          {t("allClients")}
        </Link>
      )}
    </div>
  );
}

/** The account: who is signed in, feedback on a phone, sign out. */
function AccountMenu({ onFeedback }: { onFeedback: () => void }) {
  const { data: session } = useSession();
  const t = useTranslations("guided");
  const tn = useTranslations("nav");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={t("account")}>
          <User className="w-4 h-4" />
          <span className="sr-only">{t("account")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuLabel className="truncate text-sm font-normal">
          {session?.user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onFeedback} className="flex items-center gap-2 sm:hidden">
          <MessageSquareWarning className="size-4" />
          {tn("feedback")}
        </DropdownMenuItem>
        {/* Settings is in "Library and tools"; one place for it. */}
        <DropdownMenuItem
          onClick={() => {
            void signOutOfSuite();
          }}
          className="flex items-center gap-2"
        >
          <LogOut className="size-4" />
          {tn("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Below `lg`: one line under the header, "Stage 3 of 6 · Know your data" and a
 * thin bar. The stage shown is the one holding the next step. Tapping it opens
 * the path in the side sheet. Always the same height, so the page does not
 * move when progress arrives.
 */
function PhoneStageBar({
  statuses,
  showProgress,
  onOpen,
}: {
  statuses: ReturnType<typeof useProgramPath>;
  /** False for a department-limited member: the menu, without the organisation's progress. */
  showProgress: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("guided");
  const total = numberedStageCount(DPO_CENTRAL_PATH);
  const next = statuses && showProgress ? nextStep(DPO_CENTRAL_PATH, statuses) : null;
  const overall = statuses && showProgress ? overallProgress(DPO_CENTRAL_PATH, statuses) : null;

  const label = !showProgress
    ? t("navLabel")
    : !statuses
    ? t("loading")
    : next
      ? t("phoneBar", {
          number: stageNumber(DPO_CENTRAL_PATH, next.stage.id) ?? next.stageIndex + 1,
          total,
          stage: t(`stages.${next.stage.id}`),
        })
      : t("phoneBarDone");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}. ${t("phoneBarOpen")}`}
      className="lg:hidden sticky top-14 z-40 flex min-h-11 w-full flex-col justify-center gap-1.5 border-b border-border bg-background/95 px-4 sm:px-6 py-2 text-left backdrop-blur supports-[backdrop-filter]:bg-background/60 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("min-w-0 truncate", statuses || !showProgress ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
        <ChevronDown className="size-3.5 shrink-0 -rotate-90 text-muted-foreground" aria-hidden="true" />
      </span>
      {showProgress && <ProgressBar value={overall?.done ?? null} total={overall?.total ?? 0} />}
    </button>
  );
}

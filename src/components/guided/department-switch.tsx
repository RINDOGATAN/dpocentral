"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// "For my department": a switch at the top of the menu, shown only when the
// organisation has departments. It sets the department the dashboard and the
// ready lists read their counts for. A department-limited member is offered only
// their own departments; "Whole organisation" leaves the server to narrow to
// whatever they may see.

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import { useDepartmentScope } from "@/lib/use-department-scope";

const ALL = "__all__";

export function DepartmentSwitch() {
  const t = useTranslations("views");
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const { data } = trpc.businessUnit.listForScope.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  );
  const { departmentId, setDepartmentId } = useDepartmentScope(orgId || undefined);

  const mine = data?.myBusinessUnitIds ?? null;
  const departments = (data?.departments ?? []).filter((d) => !mine || mine.includes(d.id));
  if (departments.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t("departmentSwitch.label")}
      </span>
      <Select value={departmentId ?? ALL} onValueChange={(v) => setDepartmentId(v === ALL ? null : v)}>
        <SelectTrigger className="h-9 w-full" aria-label={t("departmentSwitch.label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("departmentSwitch.wholeOrg")}</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

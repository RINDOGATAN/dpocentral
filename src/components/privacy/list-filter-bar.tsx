"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// The filter bar shared by every list: a search box, a select for each filter
// the list declares (src/lib/list-views.ts), a department filter where records
// carry one, the sort control, and the saved views a person keeps for this list.
// Everything is driven by the URL through useListFilters in the page, so a
// filtered view is shareable and bookmarkable.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SortControl } from "@/components/privacy/sort-control";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEnumLabels } from "@/lib/enum-labels";
import { useDebounce } from "@/hooks/use-debounce";
import { DEFAULT_LIST_SORT, type ListSort } from "@/lib/list-sort";
import {
  activeFilterCount,
  isEmptyFilterSet,
  UNASSIGNED_DEPARTMENT,
  type ListDef,
  type ListFilters,
} from "@/lib/list-views";

// Radix Select forbids an empty string value, so "Any" carries a sentinel.
const ANY = "__any__";

export function ListFilterBar({
  def,
  organizationId,
  filters,
  setFilter,
  applyAll,
  clearAll,
}: {
  def: ListDef;
  organizationId: string;
  filters: ListFilters;
  setFilter: (key: string, value: string | undefined) => void;
  applyAll: (next: ListFilters) => void;
  clearAll: () => void;
}) {
  const t = useTranslations("views");
  const tc = useTranslations("common");
  const { label, desnake } = useEnumLabels();

  const { data: deptData } = trpc.businessUnit.listForScope.useQuery(
    { organizationId },
    { enabled: def.hasDepartment && !!organizationId },
  );
  const departments = deptData?.departments ?? [];
  const hasDepartments = def.hasDepartment && departments.length > 0;

  const activeCount = activeFilterCount(def, filters);
  const anyActive = !isEmptyFilterSet(def, filters);

  return (
    <div className="space-y-3">
      <SavedViews def={def} organizationId={organizationId} filters={filters} onApplyAll={applyAll} />

      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <SearchField
          value={filters.q ?? ""}
          onChange={(v) => setFilter("q", v || undefined)}
          label={tc("search")}
        />

        {hasDepartments && (
          <FilterField label={t("filter.department")}>
            <Select
              value={filters.dept ?? ANY}
              onValueChange={(v) => setFilter("dept", v === ANY ? undefined : v)}
            >
              <SelectTrigger className="w-[10rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("filter.any")}</SelectItem>
                <SelectItem value={UNASSIGNED_DEPARTMENT}>{t("filter.unassigned")}</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        )}

        {def.fields.map((field) => (
          <FilterField key={field.key} label={t(`filter.${field.key}`)}>
            <Select
              value={filters[field.key] ?? ANY}
              onValueChange={(v) => setFilter(field.key, v === ANY ? undefined : v)}
            >
              <SelectTrigger className="w-[9.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("filter.any")}</SelectItem>
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {field.kind ? label(field.kind, opt) : desnake(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        ))}

        <FilterField label={tc("sortLabel")}>
          <SortControl
            value={filters.sort ?? DEFAULT_LIST_SORT}
            onChange={(v: ListSort) => setFilter("sort", v === DEFAULT_LIST_SORT ? undefined : v)}
            options={def.sorts}
          />
        </FilterField>

        {anyActive && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9">
            <X className="mr-1 h-4 w-4" />
            {t("filter.clear", { count: activeCount })}
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [local, setLocal] = useState(value);
  const debounced = useDebounce(local);
  // Keep the input in step when the URL changes from outside (a saved view, or
  // "clear").
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return (
    <FilterField label={label}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className="w-[12rem] pl-8"
          aria-label={label}
        />
      </div>
    </FilterField>
  );
}

/**
 * The saved views a person keeps for this list in this organisation, as chips.
 * Clicking a chip applies its filter set; the current filters can be saved under
 * a name.
 */
function SavedViews({
  def,
  organizationId,
  filters,
  onApplyAll,
}: {
  def: ListDef;
  organizationId: string;
  filters: ListFilters;
  onApplyAll: (next: ListFilters) => void;
}) {
  const t = useTranslations("views");
  const utils = trpc.useUtils();
  const listInput = { organizationId, list: def.key };
  const { data: views } = trpc.savedView.list.useQuery(listInput, { enabled: !!organizationId });
  const create = trpc.savedView.create.useMutation({
    onSuccess: () => {
      void utils.savedView.list.invalidate(listInput);
      toast.success(t("saved.created"));
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.savedView.remove.useMutation({
    onSuccess: () => void utils.savedView.list.invalidate(listInput),
    onError: (e) => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const canSave = !isEmptyFilterSet(def, filters) || filters.sort != null;

  // Only the string entries are stored; sort is captured too so a view restores
  // the order the person left.
  const filterRecord = (): Record<string, string> => {
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "string" && value) record[key] = value;
    }
    return record;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
        {t("saved.label")}
      </span>
      {(views ?? []).map((v) => (
        <span
          key={v.id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-0.5 text-xs"
        >
          <button
            type="button"
            className="max-w-[10rem] truncate outline-none hover:text-primary focus-visible:text-primary"
            onClick={() => onApplyAll(v.filters as ListFilters)}
          >
            {v.name}
          </button>
          <button
            type="button"
            aria-label={t("saved.remove", { name: v.name })}
            className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
            onClick={() => remove.mutate({ organizationId, id: v.id })}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        disabled={!canSave}
        onClick={() => {
          setName("");
          setDialogOpen(true);
        }}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        {t("saved.save")}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("saved.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="saved-view-name">{t("saved.nameLabel")}</Label>
            <Input
              id="saved-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("saved.namePlaceholder")}
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("saved.cancel")}
            </Button>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={() =>
                create.mutate(
                  { organizationId, list: def.key, name: name.trim(), filters: filterRecord() },
                  { onSuccess: () => setDialogOpen(false) },
                )
              }
            >
              {t("saved.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

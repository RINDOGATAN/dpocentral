"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Departments (business units): create them, give each an owner and an optional
 * parent (one level of nesting), and limit a member to one or more of them. A
 * member with no department limit sees the whole organisation, exactly as before
 * departments existed.
 *
 * Managing departments is an OWNER/ADMIN action, enforced server-side in the
 * businessUnit router; the card is only shown to those roles.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { trpc } from "@/lib/trpc";

const NONE = "__none__";

type Department = {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  recordCount: number;
  assetCount: number;
  memberCount: number;
};
type Member = { id: string; role: string; name: string | null; email: string; businessUnitIds: string[] };

export function DepartmentsCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations("departments");
  const utils = trpc.useUtils();
  const { data } = trpc.businessUnit.manage.useQuery({ organizationId });
  const departments = (data?.departments ?? []) as Department[];
  const members = (data?.members ?? []) as Member[];
  const refresh = () => {
    void utils.businessUnit.manage.invalidate({ organizationId });
    void utils.businessUnit.listForScope.invalidate({ organizationId });
  };

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(NONE);
  const [ownerId, setOwnerId] = useState<string>(NONE);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const create = trpc.businessUnit.create.useMutation({
    onSuccess: () => {
      toast.success(t("created"));
      setName("");
      setParentId(NONE);
      setOwnerId(NONE);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.businessUnit.remove.useMutation({
    onSuccess: () => {
      toast.success(t("deleted"));
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  // Only top-level departments can be a parent (one level of nesting).
  const parents = departments.filter((d) => d.parentId === null);
  const memberName = (m: Member) => m.name ?? m.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4" aria-hidden="true" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Existing departments */}
        <div className="space-y-2">
          {departments.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {departments.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 p-2 rounded border border-border">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {d.name}
                  {d.parentId && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {departments.find((p) => p.id === d.parentId)?.name}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("counts", { records: d.recordCount, systems: d.assetCount, members: d.memberCount })}
                  {d.ownerName ? ` · ${t("ownedBy", { name: d.ownerName })}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label={t("edit")} onClick={() => setEditing(d)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("delete")}
                disabled={remove.isPending}
                onClick={() => setDeleting(d)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* New department */}
        <div className="space-y-2">
          <Label htmlFor="new-department-name" className="text-sm font-medium">
            {t("addLabel")}
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="new-department-name"
              value={name}
              placeholder={t("namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="sm:w-44" aria-label={t("parent")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("noParent")}</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="sm:w-44" aria-label={t("owner")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("noOwner")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {memberName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={() =>
                create.mutate({
                  organizationId,
                  name: name.trim(),
                  parentId: parentId === NONE ? null : parentId,
                  ownerId: ownerId === NONE ? null : ownerId,
                })
              }
            >
              {create.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              {t("add")}
            </Button>
          </div>
        </div>

        {departments.length > 0 && (
          <>
            <Separator />
            <MemberAccess
              organizationId={organizationId}
              members={members}
              departments={departments}
              onChanged={refresh}
            />
          </>
        )}
      </CardContent>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleting ? t("deleteConfirm", { name: deleting.name }) : ""}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (deleting) remove.mutate({ organizationId, id: deleting.id });
                setDeleting(null);
              }}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <EditDepartmentDialog
          organizationId={organizationId}
          department={editing}
          parents={parents.filter((p) => p.id !== editing.id)}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

function MemberAccess({
  organizationId,
  members,
  departments,
  onChanged,
}: {
  organizationId: string;
  members: Member[];
  departments: Department[];
  onChanged: () => void;
}) {
  const t = useTranslations("departments");
  const setScope = trpc.businessUnit.setMemberDepartments.useMutation({
    onSuccess: () => {
      toast.success(t("access.saved"));
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (member: Member, departmentId: string, checked: boolean) => {
    const next = checked
      ? [...member.businessUnitIds, departmentId]
      : member.businessUnitIds.filter((id) => id !== departmentId);
    setScope.mutate({ organizationId, memberId: member.id, businessUnitIds: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{t("access.title")}</p>
        <p className="text-xs text-muted-foreground">{t("access.description")}</p>
      </div>
      {members.map((m) => (
        <div key={m.id} className="rounded border border-border p-2">
          <p className="text-sm font-medium truncate">{m.name ?? m.email}</p>
          <p className="text-xs text-muted-foreground mb-2">
            {m.businessUnitIds.length === 0
              ? t("access.wholeOrg")
              : t("access.limited", { count: m.businessUnitIds.length })}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {departments.map((d) => {
              const id = `bu-${m.id}-${d.id}`;
              return (
                <label key={d.id} htmlFor={id} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    id={id}
                    checked={m.businessUnitIds.includes(d.id)}
                    onCheckedChange={(v) => toggle(m, d.id, v === true)}
                  />
                  {d.name}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditDepartmentDialog({
  organizationId,
  department,
  parents,
  members,
  onClose,
  onSaved,
}: {
  organizationId: string;
  department: Department;
  parents: Department[];
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("departments");
  const [name, setName] = useState(department.name);
  const [parentId, setParentId] = useState<string>(department.parentId ?? NONE);
  const [ownerId, setOwnerId] = useState<string>(department.ownerId ?? NONE);

  const update = trpc.businessUnit.update.useMutation({
    onSuccess: () => {
      toast.success(t("updated"));
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-department-name">{t("name")}</Label>
            <Input
              id="edit-department-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("parent")}</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("noParent")}</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("owner")}</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("noOwner")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!name.trim() || update.isPending}
            onClick={() =>
              update.mutate({
                organizationId,
                id: department.id,
                name: name.trim(),
                parentId: parentId === NONE ? null : parentId,
                ownerId: ownerId === NONE ? null : ownerId,
              })
            }
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

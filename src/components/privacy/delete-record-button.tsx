"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A "Delete" button with its confirmation, for record pages. Shown only to
 * owners and admins (the server refuses everyone else: adminOrgProcedure).
 * The caller passes the mutation's call and pending state.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useOrgRole } from "@/lib/use-org-role";

export function DeleteRecordButton({
  title,
  description,
  pending,
  onConfirm,
  testId,
}: {
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
  testId?: string;
}) {
  const { isAdmin } = useOrgRole();
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
        disabled={pending}
        data-testid={testId}
      >
        {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
        {tCommon("delete")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        danger
        pending={pending}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
}

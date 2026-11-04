// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The header of a record's own page (a data asset, a processing activity).
 *
 * One pattern for every record: a text link back to the list it belongs to,
 * then the shared PageHeader with the record's icon, its name, its badges
 * under the name, and its actions on the right. The asset and activity pages
 * used to carry two different headers (F5 of the September browser round).
 */

import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/privacy/page-header";

export function RecordHeader({
  back,
  icon,
  title,
  badges,
  actions,
}: {
  /** The list this record belongs to, named in words. */
  back: { href: string; label: string };
  icon: LucideIcon;
  title: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2" data-testid="record-header">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 self-start rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {back.label}
      </Link>
      <PageHeader icon={icon} title={title} meta={badges} actions={actions} />
    </div>
  );
}

"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A record page queries with the organisation selected in the browser
 * (src/lib/organization-context.tsx). A link from a reminder e-mail or from
 * the clients list may name a record of another organisation the same person
 * belongs to; that query answers "not found". When the record is missing, this
 * hook asks the server which of the person's organisations holds it and, if
 * there is one, switches the selection to it, so the page's own query runs
 * again against the right organisation. A record the person cannot reach
 * stays "not found".
 */

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/lib/organization-context";
import type { RecordKind } from "@/server/services/record-locator";
import { shouldSwitchTo } from "@/lib/record-org-switch";

export type { RecordKind };

export interface RecordOrgSwitch {
  /** The server is still being asked which organisation holds the record. */
  checking: boolean;
  /** The name of the organisation being switched to, while the switch happens. */
  switchingTo: string | null;
}

/**
 * @param kind the record's kind, as the server's locator names them
 * @param id the record id from the route
 * @param missing true once the page's own query has settled without a record
 */
export function useRecordOrgSwitch(kind: RecordKind, id: string, missing: boolean): RecordOrgSwitch {
  const { organization, setOrganization } = useOrganization();
  const currentOrgId = organization?.id;
  const enabled = missing && !!currentOrgId;
  const { data: located, isPending } = trpc.organization.locateRecord.useQuery(
    { kind, id },
    { enabled, retry: false, staleTime: Infinity }
  );
  // One switch per record and destination: the selection is changed once,
  // never bounced back and forth if the record is still refused afterwards.
  const switchedRef = useRef<string | null>(null);
  const switching = enabled && shouldSwitchTo(located, currentOrgId);
  useEffect(() => {
    if (!switching || !located) return;
    const key = `${kind}:${id}:${located.id}`;
    if (switchedRef.current === key) return;
    switchedRef.current = key;
    setOrganization(located);
    // setOrganization is recreated on every render of the provider; the
    // ref above makes the effect idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switching, located, kind, id]);

  return {
    checking: enabled && isPending,
    switchingTo: switching && located ? located.name : null,
  };
}

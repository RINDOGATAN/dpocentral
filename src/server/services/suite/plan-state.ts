// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The suite's shared pilot and plan, DPO Central's side (contract in
 * src/lib/suite-plan-state.ts; AI Sentinel runs the mirror image).
 *
 *   - localPlanStateForEmail answers the peer: the groups (umbrella.ts) whose
 *     billing owner has that e-mail, folded as a new organisation of the
 *     group would inherit them: paid when any group is paid, the earliest
 *     pilot start.
 *   - suiteForRequest runs on organisation requests of the billing owner:
 *       * a paid plan on the peer, with this group still on the pilot, puts
 *         the group on the paid plan too, with the peer's renewal date and
 *         payment subscription, so the plan's end (relayed by subscription)
 *         ends it here as well; one PLAN_CHANGE audit entry per
 *         organisation, source "suite-peer";
 *       * the peer's pilot start is offered to recordPilotFirstSignIn, which
 *         uses it only when this group has no start yet: a person who began
 *         the pilot on the peer does not get a second window here. A start
 *         already recorded is never moved, so no running pilot is shortened.
 *       * whether the person has the peer at all, for the pilot bar's line
 *         ("Your Cloud Plan covers DPO Central, AI Sentinel and VendorWatch").
 *
 * Fail safe: on the kit, without the shared secret, with SUITE_PLAN_STATE=off,
 * or when the peer is slow, down or answers anything unexpected, nothing is
 * read from it and everything behaves as before. Nothing here ever removes a
 * plan or ends a pilot. Answers are cached per e-mail for five minutes
 * (failures for one minute), so a request rarely waits on the peer.
 */

import { logger } from "@/lib/logger";
import { isHostedDeployment } from "@/lib/hosted";
import {
  NOT_FOUND,
  SUITE_SIGNATURE_HEADER,
  normalizeEmail,
  parseSuiteState,
  signSuiteRequest,
  suitePlanStateEnabled,
  suiteSecret,
  type SuitePlanState,
} from "@/lib/suite-plan-state";
import { GROUP_STATE_SELECT, groupWhere, inheritedGroupState, type GroupState } from "@/server/services/pilot/umbrella";
import { PAID_PLAN, isPaidPlan, pilotStart } from "@/server/services/pilot/caps";
import { planChangeAuditData, type PlanState } from "@/server/services/pilot/plan";

type Env = Record<string, string | undefined>;

export const DEFAULT_PEER_URL = "https://aisentinel.todo.law";
export const PEER_TIMEOUT_MS = 2500;
const TTL_OK_MS = 5 * 60 * 1000;
const TTL_FAIL_MS = 60 * 1000;

export function peerUrl(env: Env = process.env): string {
  const raw = (env.SUITE_PEER_URL ?? "").trim() || DEFAULT_PEER_URL;
  return `${raw.replace(/\/+$/, "")}/api/suite/plan-state`;
}

// ── Answering the peer ─────────────────────────────────────────────────

type StateRow = GroupState & { id: string };

export interface LocalStateDb {
  organization: {
    findMany(args: {
      where: { billingOwner: { email: { equals: string; mode: "insensitive" } } };
      select: typeof GROUP_STATE_SELECT & { id: true };
    }): Promise<StateRow[]>;
  };
}

export async function localPlanStateForEmail(db: LocalStateDb, email: string): Promise<SuitePlanState> {
  const rows = await db.organization.findMany({
    where: { billingOwner: { email: { equals: email, mode: "insensitive" } } },
    select: { ...GROUP_STATE_SELECT, id: true },
  });
  const state = inheritedGroupState(rows);
  if (!state) return NOT_FOUND;
  // The effective start of each row (never before the pilot went live); the earliest wins.
  const starts = rows
    .map((r) => pilotStart({ pilotStartedAt: r.pilotStartedAt, plan: r.plan }))
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  const paid = state.plan === PAID_PLAN;
  return {
    version: 1,
    found: true,
    paid,
    planRenewsAt: paid && state.planRenewsAt ? new Date(state.planRenewsAt).toISOString() : null,
    subscriptionId: paid ? state.planStripeSubscriptionId : null,
    pilotStartedAt: starts.length ? new Date(Math.min(...starts)).toISOString() : null,
  };
}

// ── Asking the peer ────────────────────────────────────────────────────

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface PeerDeps {
  env?: Env;
  fetch?: FetchLike;
  now?: () => number;
}

const cache = new Map<string, { at: number; value: SuitePlanState | null }>();

/** For tests. */
export function clearSuiteCache(): void {
  cache.clear();
}

/** The peer's answer for this e-mail, or null when it cannot be had (never throws). */
export async function peerPlanState(email: string, deps: PeerDeps = {}): Promise<SuitePlanState | null> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const secret = suiteSecret(env);
  const key = normalizeEmail(email);
  if (!key || !secret || !suitePlanStateEnabled(env)) return null;
  const hit = cache.get(key);
  if (hit && now() - hit.at < (hit.value ? TTL_OK_MS : TTL_FAIL_MS)) return hit.value;
  let value: SuitePlanState | null = null;
  try {
    const body = JSON.stringify({ version: 1, email: key });
    const f = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    const res = await f(peerUrl(env), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SUITE_SIGNATURE_HEADER]: signSuiteRequest(secret, Math.floor(now() / 1000), body),
      },
      body,
      signal: AbortSignal.timeout(PEER_TIMEOUT_MS),
    });
    value = res.ok ? parseSuiteState(await res.json()) : null;
    if (!res.ok) logger.warn("Suite plan state: peer refused", { status: res.status });
  } catch (err) {
    logger.warn("Suite plan state: peer unreachable", { error: err instanceof Error ? err.message : String(err) });
  }
  cache.set(key, { at: now(), value });
  return value;
}

// ── Applying it here ───────────────────────────────────────────────────

export interface SuiteOrg {
  id: string;
  plan?: string | null;
  billingOwnerId?: string | null;
  pilotStartedAt: Date | null;
  planStartedAt?: Date | null;
  planRenewsAt?: Date | null;
  planNote?: string | null;
  planStripeSubscriptionId?: string | null;
}

export interface SuiteUser {
  id?: string | null;
  email?: string | null;
}

export interface SuiteResult {
  /** The person also has the peer product. */
  suite: boolean;
  /** The pilot start to use when this group has none yet. */
  preferredPilotStart: Date | null;
}

const NONE: SuiteResult = { suite: false, preferredPilotStart: null };

type GroupRow = { id: string; plan: string; planStartedAt: Date | null; planRenewsAt: Date | null; planNote: string | null };

export interface ApplyDb {
  organization: {
    findMany(args: { where: object; select: object }): Promise<GroupRow[]>;
    updateMany(args: { where: object; data: object }): Promise<unknown>;
  };
  auditLog: { create(args: { data: object }): Promise<unknown> };
  $transaction<T>(fn: (tx: ApplyDb) => Promise<T>): Promise<T>;
}

/** Whether this request is one the suite looks at: hosted, switched on, the group's billing owner. */
export function suiteApplies(org: SuiteOrg, user: SuiteUser | null | undefined, env: Env = process.env): boolean {
  return (
    isHostedDeployment(env) &&
    suitePlanStateEnabled(env) &&
    !!user?.id &&
    !!org.billingOwnerId &&
    org.billingOwnerId === user.id &&
    normalizeEmail(user.email) !== null
  );
}

/** Never throws: any failure reads as "nothing from the peer". */
export async function suiteForRequest(
  db: ApplyDb,
  org: SuiteOrg,
  user: SuiteUser | null | undefined,
  deps: PeerDeps = {}
): Promise<SuiteResult> {
  try {
    const env = deps.env ?? process.env;
    if (!suiteApplies(org, user, env)) return NONE;
    const peer = await peerPlanState(user!.email!, deps);
    if (!peer || !peer.found) return NONE;
    if (peer.paid && !isPaidPlan(org)) await adoptPeerPlan(db, org, peer, deps.now ?? Date.now);
    return { suite: true, preferredPilotStart: peer.pilotStartedAt ? new Date(peer.pilotStartedAt) : null };
  } catch (err) {
    logger.warn("Suite plan state: not applied", { error: err instanceof Error ? err.message : String(err) });
    return NONE;
  }
}

async function adoptPeerPlan(db: ApplyDb, org: SuiteOrg, peer: SuitePlanState, now: () => number): Promise<void> {
  const where = groupWhere(org);
  const renewsAt = peer.planRenewsAt ? new Date(peer.planRenewsAt) : null;
  const startedAt = new Date(now());
  await db.$transaction(async (tx) => {
    const rows = await tx.organization.findMany({
      where: { ...where, plan: { not: PAID_PLAN } },
      select: { id: true, plan: true, planStartedAt: true, planRenewsAt: true, planNote: true },
    });
    if (rows.length === 0) return;
    await tx.organization.updateMany({
      where: { ...where, plan: { not: PAID_PLAN } },
      data: {
        plan: PAID_PLAN,
        planStartedAt: startedAt,
        planRenewsAt: renewsAt,
        ...(peer.subscriptionId ? { planStripeSubscriptionId: peer.subscriptionId } : {}),
      },
    });
    for (const r of rows) {
      const before: PlanState = {
        plan: r.plan as PlanState["plan"],
        planStartedAt: r.planStartedAt,
        planRenewsAt: r.planRenewsAt,
        planNote: r.planNote,
      };
      const after: PlanState = { plan: PAID_PLAN, planStartedAt: startedAt, planRenewsAt: renewsAt, planNote: r.planNote };
      await tx.auditLog.create({ data: planChangeAuditData(r.id, before, after, { source: "suite-peer" }) });
    }
  });
  org.plan = PAID_PLAN;
  org.planStartedAt = startedAt;
  org.planRenewsAt = renewsAt;
  logger.info("Suite plan state: paid plan adopted from the peer", { organizationId: org.id });
}

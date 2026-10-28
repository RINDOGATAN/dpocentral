// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm team, sent to AI Sentinel (contract in src/lib/suite-firm-team.ts).
 *
 * The list is kept here only (src/server/services/members/firm-team.ts); AI
 * Sentinel applies it to its own organisations. After every change that can
 * alter what AI Sentinel should apply (a person added, a role changed, a
 * person removed, an invitation accepted, a firm organisation gained or
 * lost) the account's FULL list is pushed, and the hourly suite-sync cron
 * pushes every account's list again, so a push lost on the way is made good
 * within the hour.
 *
 * Fire and forget: the push runs after the response (next/server `after`),
 * is logged, and never fails or slows the person's action. Nothing is sent
 * unless SUITE_FIRM_TEAM=on and PLAN_SYNC_SECRET is set.
 */

import { after } from "next/server";
import { logger } from "@/lib/logger";
import { SUITE_SIGNATURE_HEADER, normalizeEmail, suiteSecret } from "@/lib/suite-plan-state";
import {
  FIRM_TEAM_PATH,
  FIRM_TEAM_PUSH_ROLES,
  signFirmTeamPush,
  suiteFirmTeamEnabled,
  type FirmTeamPush,
  type FirmTeamPushRole,
} from "@/lib/suite-firm-team";
import { DEFAULT_PEER_URL, PEER_TIMEOUT_MS } from "@/server/services/suite/plan-state";
import { firmOrganizationsWhere } from "@/server/services/members/firm-team";

type Env = Record<string, string | undefined>;

export function firmTeamPeerUrl(env: Env = process.env): string {
  const raw = (env.SUITE_PEER_URL ?? "").trim() || DEFAULT_PEER_URL;
  return `${raw.replace(/\/+$/, "")}${FIRM_TEAM_PATH}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * The account's full list as of now, or null when there is nothing to say:
 * no usable e-mail, or (unless `includeEmpty`) no firm team at all. An empty
 * list is still sent after a removal, so the last person removed here is
 * removed on AI Sentinel too.
 */
export async function buildFirmTeamPush(
  db: Db,
  ownerUserId: string,
  opts: { includeEmpty?: boolean; now?: () => number } = {}
): Promise<FirmTeamPush | null> {
  const sentAt = new Date((opts.now ?? Date.now)()).toISOString();
  const owner: { email: string | null } | null = await db.user.findUnique({
    where: { id: ownerUserId },
    select: { email: true },
  });
  const ownerEmail = normalizeEmail(owner?.email);
  if (!ownerEmail) return null;
  const rows: Array<{ invitedEmail: string; role: string; acceptedAt: Date | null; memberUserId: string | null }> =
    await db.firmTeamMember.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: "asc" },
      select: { invitedEmail: true, role: true, acceptedAt: true, memberUserId: true },
    });
  if (rows.length === 0 && !opts.includeEmpty) return null;
  const orgs: Array<{ id: string }> = await db.organization.findMany({
    where: firmOrganizationsWhere(ownerUserId),
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const members = rows
    .filter((r) => (FIRM_TEAM_PUSH_ROLES as readonly string[]).includes(r.role))
    .map((r) => ({
      email: normalizeEmail(r.invitedEmail) ?? r.invitedEmail,
      role: r.role as FirmTeamPushRole,
      state: (r.acceptedAt && r.memberUserId ? "accepted" : "pending") as "accepted" | "pending",
    }));
  return { version: 1, sentAt, ownerEmail, firmOrganizationIds: orgs.map((o) => o.id), members };
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number }>;

export interface PushDeps {
  env?: Env;
  fetch?: FetchLike;
  now?: () => number;
}

export type PushOutcome = "off" | "nothing" | "sent" | "refused" | "failed";

/** Sends the account's list now. Never throws. */
export async function pushFirmTeam(
  db: Db,
  ownerUserId: string,
  opts: { includeEmpty?: boolean } & PushDeps = {}
): Promise<PushOutcome> {
  const env = opts.env ?? process.env;
  const secret = suiteSecret(env);
  if (!secret || !suiteFirmTeamEnabled(env)) return "off";
  try {
    const now = opts.now ?? Date.now;
    const push = await buildFirmTeamPush(db, ownerUserId, { includeEmpty: opts.includeEmpty, now });
    if (!push) return "nothing";
    const body = JSON.stringify(push);
    const f = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    const res = await f(firmTeamPeerUrl(env), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SUITE_SIGNATURE_HEADER]: signFirmTeamPush(secret, Math.floor(now() / 1000), body),
      },
      body,
      signal: AbortSignal.timeout(PEER_TIMEOUT_MS),
    });
    if (res.ok) {
      logger.info("Firm team pushed to AI Sentinel", { members: push.members.length });
      return "sent";
    }
    // 409: a newer push for this account was applied first; nothing to do.
    if (res.status !== 409) logger.warn("Firm team push: AI Sentinel refused", { status: res.status });
    return "refused";
  } catch (err) {
    logger.warn("Firm team push failed", { error: err instanceof Error ? err.message : String(err) });
    return "failed";
  }
}

/**
 * Schedules the push to run after the response. Outside a request (a script,
 * a test) it simply starts it. Never throws, never waits.
 */
export function schedulePushFirmTeam(db: Db, ownerUserId: string, opts: { includeEmpty?: boolean } = {}): void {
  if (!suiteFirmTeamEnabled()) return;
  const run = () => pushFirmTeam(db, ownerUserId, opts).then(() => undefined);
  try {
    after(run);
  } catch {
    void run().catch(() => undefined);
  }
}

/** The hourly push: every account that has a firm team. Never throws. */
export async function pushAllFirmTeams(db: Db, deps: PushDeps = {}): Promise<{ owners: number; sent: number; failed: number }> {
  const env = deps.env ?? process.env;
  if (!suiteFirmTeamEnabled(env)) return { owners: 0, sent: 0, failed: 0 };
  let owners: Array<{ ownerUserId: string }> = [];
  try {
    owners = await db.firmTeamMember.findMany({ distinct: ["ownerUserId"], select: { ownerUserId: true } });
  } catch (err) {
    logger.warn("Firm team push: could not list the accounts", { error: err instanceof Error ? err.message : String(err) });
    return { owners: 0, sent: 0, failed: 1 };
  }
  let sent = 0;
  let failed = 0;
  for (const o of owners) {
    const outcome = await pushFirmTeam(db, o.ownerUserId, deps);
    if (outcome === "sent") sent++;
    else if (outcome === "failed") failed++;
  }
  return { owners: owners.length, sent, failed };
}

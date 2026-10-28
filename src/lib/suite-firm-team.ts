// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm team across the suite: DPO Central keeps the one list of an
 * account's firm team, and AI Sentinel applies it. DPO Central pushes the
 * account's FULL list, server to server, after every change and once an hour.
 *
 * The contract (version 1), identical in both apps:
 *   POST <AI Sentinel>/api/suite/firm-team
 *   header x-suite-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(PLAN_SYNC_SECRET,
 *          "suite-firm-team.v1.<t>.<rawBody>")>
 *   body   {"version":1,
 *           "sentAt":"<ISO time of the push, milliseconds>",
 *           "ownerEmail":"<the account's e-mail>",
 *           "firmOrganizationIds":["<DPO Central ids of the account's firm organisations>"],
 *           "members":[{"email":"…","role":"ADMIN|PRIVACY_OFFICER|MEMBER|VIEWER",
 *                       "state":"pending|accepted"}]}
 *   answer 200 {"version":1,"applied":true,...counts}
 *          409 when a push with the same or a later sentAt was already applied
 *              for this account (a replay, or a push overtaken by a newer one).
 *
 * The signature helper is the plan-state one (src/lib/suite-plan-state.ts),
 * with its own "suite-firm-team.v1" prefix, so a signature made for one
 * endpoint never verifies at the other. Five minutes' tolerance.
 *
 * Switched on by SUITE_FIRM_TEAM=on (off when unset) on both sides, and only
 * with the shared secret.
 *
 * Pure leaf module: no Prisma, no Next.
 */

import {
  normalizeEmail,
  signSuiteRequest,
  suiteSecret,
  verifySuiteSignature,
} from "@/lib/suite-plan-state";

export const FIRM_TEAM_PURPOSE = "suite-firm-team.v1";
export const FIRM_TEAM_PATH = "/api/suite/firm-team";
export const FIRM_TEAM_MAX_MEMBERS = 500;
export const FIRM_TEAM_MAX_ORGANIZATIONS = 2000;

type Env = Record<string, string | undefined>;

/** The roles a firm-team person can hold, in DPO Central's words. Never OWNER. */
export const FIRM_TEAM_PUSH_ROLES = ["ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;
export type FirmTeamPushRole = (typeof FIRM_TEAM_PUSH_ROLES)[number];

export type FirmTeamPushState = "pending" | "accepted";

export interface FirmTeamPushMember {
  email: string;
  role: FirmTeamPushRole;
  state: FirmTeamPushState;
}

export interface FirmTeamPush {
  version: 1;
  sentAt: string;
  ownerEmail: string;
  firmOrganizationIds: string[];
  members: FirmTeamPushMember[];
}

/** On only when SUITE_FIRM_TEAM is "on" and the shared secret is set. */
export function suiteFirmTeamEnabled(env: Env = process.env): boolean {
  return (env.SUITE_FIRM_TEAM ?? "").trim().toLowerCase() === "on" && suiteSecret(env) !== null;
}

export function signFirmTeamPush(secret: string, t: number, rawBody: string): string {
  return signSuiteRequest(secret, t, rawBody, FIRM_TEAM_PURPOSE);
}

export function verifyFirmTeamSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  return verifySuiteSignature(header, rawBody, secret, nowSeconds, FIRM_TEAM_PURPOSE);
}

/** AI Sentinel's role for a DPO Central firm-team role; null for anything else (OWNER included). */
export function aiSentinelRoleFor(role: string): "ADMIN" | "AI_OFFICER" | "MEMBER" | "VIEWER" | null {
  switch (role) {
    case "PRIVACY_OFFICER":
      return "AI_OFFICER";
    case "ADMIN":
    case "MEMBER":
    case "VIEWER":
      return role;
    default:
      return null;
  }
}

/**
 * A push, checked field by field; null when it is not a well-formed version 1
 * push. A role outside the firm-team roles (OWNER included) makes the whole
 * push malformed rather than being skipped, so a sender bug is seen. The
 * owner's own address is never a member of their team; a repeated address
 * keeps its first entry.
 */
export function parseFirmTeamPush(raw: unknown): FirmTeamPush | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  if (typeof r.sentAt !== "string" || Number.isNaN(Date.parse(r.sentAt))) return null;
  const ownerEmail = normalizeEmail(typeof r.ownerEmail === "string" ? r.ownerEmail : null);
  if (!ownerEmail) return null;
  if (!Array.isArray(r.firmOrganizationIds) || r.firmOrganizationIds.length > FIRM_TEAM_MAX_ORGANIZATIONS) return null;
  const ids: string[] = [];
  for (const id of r.firmOrganizationIds) {
    if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  if (!Array.isArray(r.members) || r.members.length > FIRM_TEAM_MAX_MEMBERS) return null;
  const members: FirmTeamPushMember[] = [];
  const seen = new Set<string>();
  for (const m of r.members) {
    if (!m || typeof m !== "object") return null;
    const row = m as Record<string, unknown>;
    const email = normalizeEmail(typeof row.email === "string" ? row.email : null);
    if (!email) return null;
    if (typeof row.role !== "string" || !(FIRM_TEAM_PUSH_ROLES as readonly string[]).includes(row.role)) return null;
    if (row.state !== "pending" && row.state !== "accepted") return null;
    if (email === ownerEmail || seen.has(email)) continue;
    seen.add(email);
    members.push({ email, role: row.role as FirmTeamPushRole, state: row.state });
  }
  return { version: 1, sentAt: new Date(r.sentAt).toISOString(), ownerEmail, firmOrganizationIds: ids, members };
}

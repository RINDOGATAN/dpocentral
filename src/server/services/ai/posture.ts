// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Per-organization AI posture gate + metadata-only generation audit.
 *
 * Truth table (requireAi):
 *   org declares a US state            -> PRECONDITION_FAILED "ai_us_jurisdiction"
 *                                         (unless AI_ALLOW_US_JURISDICTIONS=true)
 *   no OrganizationAiSettings row      -> PRECONDITION_FAILED "ai_off"
 *   posture "off"                      -> PRECONDITION_FAILED "ai_off"
 *   posture on, no engine configured   -> PRECONDITION_FAILED "ai_not_configured"
 *   posture on, engine configured      -> returns the settings row
 *
 * "Engine configured": the organisation's own API inference key when one is
 * saved and readable (services/ai/org-key.ts); otherwise the deployment's
 * engine for the posture's lane, unless the deployment requires an
 * organisation key (AI_REQUIRE_ORG_KEY, services/ai/deployment.ts), in which
 * case a missing key is "ai_not_configured" and the UI points to Settings
 * (ORG_KEY_SETTINGS_PATH).
 *
 * requireAi MUST run before any prompt building or door call — posture off
 * (or a missing row) means zero AI network calls, which keeps the "no AI
 * calls by default" promise true. The TRPCError message is a machine code
 * ("ai_off" | "ai_not_configured") the UI maps to i18n strings.
 *
 * AiGeneration stores who/when/feature/model/tokens/duration only — never
 * prompt or output text — and doubles as the per-org hourly rate limiter.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { TRPCError } from "@trpc/server";
import type { OrganizationAiSettings, AiGeneration, AiPosture } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import { isAIConfigured, type AiLane, type DirectEngine } from "./llm-door";
import { orgKeyRequired } from "./deployment";
import { resolveOrgEngine } from "./org-key";

/** Hosted metered-key cap: generations per organization per hour. */
export const AI_RATE_LIMIT_PER_ORG_PER_HOUR = 30;

/**
 * The traffic lane an acknowledged posture routes to. "off" has no lane —
 * callers get `undefined`, which the door treats as the base (unsuffixed)
 * engine. This is the single mapping that makes the recorded posture and the
 * physical traffic lane the same fact.
 */
export function postureLane(posture: AiPosture): AiLane | undefined {
  return posture === "off" ? undefined : (posture as AiLane);
}

/**
 * Engine availability per lane (lane-suffixed env triple, else the base one)
 * for status UIs — so an admin can see which postures actually have an
 * engine behind them before picking one.
 */
export function getLaneAvailability(): Record<AiLane, boolean> {
  return {
    local_gateway: isAIConfigured("local_gateway"),
    cloud_eu: isAIConfigured("cloud_eu"),
    cloud_us: isAIConfigured("cloud_us"),
  };
}

// The subset of the (extended) client these helpers touch — unit tests pass a mock.
type PrismaLike = Pick<Db, "organizationAiSettings" | "aiGeneration" | "organizationJurisdiction">;

/**
 * US state jurisdictions in the catalogue carry a "US-<state>" region
 * (CCPA "US-CA", VCDPA "US-VA", ...). Canada's region is "CA", so the
 * prefix, not the bare state code, is what identifies a US state.
 */
export function declaresUsState(regions: readonly string[]): boolean {
  return regions.some((r) => {
    const region = r.trim().toUpperCase();
    return region === "US" || region.startsWith("US-");
  });
}

/**
 * The AI engine's processing terms on the hosted service do not yet carry
 * the service provider commitments US state privacy laws require, so AI is
 * unavailable to organizations that declare a US state. On by default;
 * a deployment whose engine terms do cover them (for example a local
 * engine on self-host) sets AI_ALLOW_US_JURISDICTIONS=true.
 */
export function usJurisdictionAiBlockActive(): boolean {
  return process.env.AI_ALLOW_US_JURISDICTIONS?.trim().toLowerCase() !== "true";
}

/** True when the organization may not use AI because it declares a US state. */
export async function isAiBlockedForUsJurisdiction(
  prisma: Pick<PrismaLike, "organizationJurisdiction">,
  organizationId: string
): Promise<boolean> {
  if (!usJurisdictionAiBlockActive()) return false;
  const rows = await prisma.organizationJurisdiction.findMany({
    where: { organizationId },
    select: { jurisdiction: { select: { region: true } } },
  });
  return declaresUsState(rows.map((row) => row.jurisdiction.region));
}

/**
 * Gate an AI feature on the organization's posture AND engine availability.
 * Throws PRECONDITION_FAILED ("ai_us_jurisdiction" | "ai_off" |
 * "ai_not_configured") when the
 * feature must not run; returns the settings row when generation may proceed.
 */
export async function requireAi(
  prisma: PrismaLike,
  organizationId: string
): Promise<OrganizationAiSettings> {
  return (await requireAiEngine(prisma, organizationId)).settings;
}

/**
 * requireAi, plus the engine to call: the organisation's own key when one is
 * saved (null means the deployment's engine for the posture's lane). Pass
 * `engine` to chatComplete. The engine holds the decrypted key: keep it in
 * memory, never return it to a client or log it.
 */
export async function requireAiEngine(
  prisma: PrismaLike,
  organizationId: string
): Promise<{ settings: OrganizationAiSettings; engine: DirectEngine | null }> {
  // Checked first and regardless of the stored posture: a posture saved
  // before the organization declared a US state does not reopen AI.
  if (await isAiBlockedForUsJurisdiction(prisma, organizationId)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ai_us_jurisdiction" });
  }

  const settings = await prisma.organizationAiSettings.findUnique({
    where: { organizationId },
  });

  if (!settings || settings.posture === "off") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ai_off" });
  }

  // The organisation's own key first. Without one: where the deployment
  // requires it, nothing else may answer; elsewhere the deployment engine for
  // the POSTURE'S lane (suffixed env triple, else the base one).
  const { engine } = resolveOrgEngine(settings);
  if (engine) return { settings, engine };
  if (orgKeyRequired() || !isAIConfigured(postureLane(settings.posture))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ai_not_configured" });
  }

  return { settings, engine: null };
}

/**
 * Reject when the organization already burned its hourly generation budget.
 * Counts AiGeneration rows (any status) in the last hour.
 */
export async function assertAiRateLimit(
  prisma: PrismaLike,
  organizationId: string
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.aiGeneration.count({
    where: { organizationId, createdAt: { gte: oneHourAgo } },
  });

  if (recent >= AI_RATE_LIMIT_PER_ORG_PER_HOUR) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "ai_rate_limited",
    });
  }
}

export interface RecordGenerationInput {
  organizationId: string;
  userId?: string | null;
  feature: "dpia_narrative" | "breach_notification" | "import_classification";
  entityType?: string | null;
  entityId?: string | null;
  model?: string | null;
  posture: AiPosture;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  durationMs?: number | null;
  status: "ok" | "error";
}

/** Append one metadata-only audit row (no prompt/output text, ever). */
export async function recordGeneration(
  prisma: PrismaLike,
  input: RecordGenerationInput
): Promise<AiGeneration> {
  return prisma.aiGeneration.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      feature: input.feature,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      model: input.model ?? null,
      posture: input.posture,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      durationMs: input.durationMs ?? null,
      status: input.status,
    },
  });
}

/**
 * Stamp acceptedAt when the user Inserts a draft (org-scoped).
 * Returns true when a row was updated.
 */
export async function markAccepted(
  prisma: PrismaLike,
  organizationId: string,
  generationId: string
): Promise<boolean> {
  const result = await prisma.aiGeneration.updateMany({
    where: { id: generationId, organizationId },
    data: { acceptedAt: new Date() },
  });
  return result.count > 0;
}

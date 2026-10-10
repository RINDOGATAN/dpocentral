// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What the two import routes check before reading a file: a signed-in owner
 * or admin of the organisation, within the rate limit, on an organisation
 * that may still be edited (a hosted pilot past its window is read-only).
 */

import { TRPCError } from "@trpc/server";
import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { exportLimiter } from "@/lib/rate-limit";
import { assertPilotWritable } from "@/server/services/pilot/caps";
import { canImportProgramme } from "./access";

export type ImportAccess =
  | { ok: true; organizationId: string; userId: string; organizationName: string }
  | { ok: false; response: Response };

export async function checkImportAccess(
  request: Request,
  organizationId: string | null,
  step: string,
  locale: "en" | "es" = "en",
): Promise<ImportAccess> {
  if (!organizationId) {
    return { ok: false, response: Response.json({ error: "organizationId is required" }, { status: 400 }) };
  }
  const token = await getSessionToken(request);
  const userEmail = token?.email as string | undefined;
  if (!userEmail) return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const limit = exportLimiter.check(`import:${userEmail}`);
  if (!limit.success) {
    return {
      ok: false,
      response: Response.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 }),
    };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, user: { email: userEmail } },
    include: { organization: true },
  });
  if (!membership || !canImportProgramme(membership.role)) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (step === "import") {
    try {
      assertPilotWritable(membership.organization, locale);
    } catch (err) {
      const message = err instanceof TRPCError ? err.message : "This organisation cannot be edited.";
      return { ok: false, response: Response.json({ error: message }, { status: 403 }) };
    }
  }
  return {
    ok: true,
    organizationId,
    userId: membership.userId,
    organizationName: membership.organization.name,
  };
}

/** The uploaded file of a multipart form, as bytes. */
export async function uploadedFile(form: FormData): Promise<{ name: string; bytes: Uint8Array } | null> {
  const file = form.get("file");
  if (!file || typeof file === "string") return null;
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

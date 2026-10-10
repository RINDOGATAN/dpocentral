// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/export/programme?organizationId=...[&locale=en|es][&includeRightsRequests=1&acknowledgePersonalData=1]
 *
 * "Take your programme with you": the whole programme as a ZIP in the open
 * programme format (src/server/services/portability), streamed as it is made.
 * Owners and admins only. Rights requests (personal data of the people who
 * made them) are added only when both flags are sent: the separate box in
 * Settings that says so. The export is recorded in the audit trail
 * (EXPORT_PROGRAMME) before the first byte is sent.
 *
 * A GET route, so it stays available when a hosted pilot organisation has
 * become read-only: leaving must always be possible.
 */

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { isDsarModuleEnabled } from "@/config/features";
import { toReadableStream } from "@/lib/zip-stream";
import { programmeArchive } from "@/server/services/portability/export";
import { PROGRAMME_FORMAT } from "@/server/services/portability/format";
import type { DocumentRow } from "@/server/services/portability/read";
import { canExportProgramme } from "@/server/services/portability/access";
import { exportStamp } from "@/server/services/export/integrity";
import { nameForFile, resolveExportLocale, today } from "@/server/services/export/documents/context";
import { loadDocumentFacts } from "@/server/services/program/document-facts";
import { evaluateRegister, registerFor } from "@/config/document-register";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  if (!organizationId) {
    return Response.json({ error: "organizationId is required" }, { status: 400 });
  }

  const token = await getSessionToken(request);
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  const includeRightsRequests = searchParams.get("includeRightsRequests") === "1";
  const acknowledged = searchParams.get("acknowledgePersonalData") === "1";
  if (includeRightsRequests && !acknowledged) {
    return Response.json(
      { error: "Rights requests hold personal data: tick the box that says so to include them." },
      { status: 400 },
    );
  }

  try {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, user: { email: userEmail } },
      include: { organization: true },
    });
    if (!membership || !canExportProgramme(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const dsarModuleOn = isDsarModuleEnabled();
    const locale = (await resolveExportLocale(searchParams.get("locale"))) === "es" ? "es" : "en";
    const stamp = exportStamp();

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: membership.userId,
        entityType: "Organization",
        entityId: organizationId,
        action: "EXPORT_PROGRAMME",
        changes: {
          format: PROGRAMME_FORMAT,
          rightsRequests: includeRightsRequests && dsarModuleOn,
          locale,
        },
      },
    });

    // The documents' states are information only: if they cannot be worked
    // out, the export goes ahead without them rather than fail half-way.
    const documents = async (): Promise<DocumentRow[]> => {
      try {
        const facts = await loadDocumentFacts(prisma, organizationId);
        return evaluateRegister(registerFor({ dsarEnabled: dsarModuleOn }), facts).map((d) => ({
          id: d.id,
          state: d.status.state,
          gaps: d.status.state === "draft" ? d.status.gaps.map((g) => `${g.key}=${g.count}`) : [],
          input: d.status.state === "needsInput" ? d.status.input : null,
        }));
      } catch (err) {
        logger.warn("Programme export: documents' states left out", {
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    };

    const archive = programmeArchive(prisma, {
      organizationId,
      includeRightsRequests,
      dsarModuleOn,
      locale,
      documents,
      appVersion: stamp.appVersion,
      commit: stamp.commit,
    });
    const logged = (async function* () {
      try {
        yield* archive;
      } catch (err) {
        logger.error("Programme export failed while streaming", err);
        throw err;
      }
    })();

    return new Response(toReadableStream(logged), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Programme-${nameForFile(membership.organization.name)}-${today()}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "programme");
  }
}

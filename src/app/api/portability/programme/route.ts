// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/portability/programme (multipart form)
 *
 *   organizationId           the organisation to import into (new or empty)
 *   file                     the export ZIP, or programme.json
 *   step                     "check" (the dry run, writes nothing) or "import"
 *   includeRightsRequests    "1" to bring rights requests in (personal data),
 *   acknowledgePersonalData  "1" as well: the separate box that says so
 *   locale                   "en" or "es", for refusals
 *
 * Owners and admins only. Everything arrives as drafts for a person to
 * review; nothing is overwritten; running the same file again creates
 * nothing new. The import is recorded in the audit trail (IMPORT_PROGRAMME).
 * See src/server/services/portability/import.ts.
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isDsarModuleEnabled } from "@/config/features";
import { readProgrammeUpload } from "@/server/services/portability/upload";
import { applyImport, ImportRefusedError, planImport, type ImportOptions } from "@/server/services/portability/import";
import { importLimitChecker } from "@/server/services/portability/limits";
import { checkImportAccess, uploadedFile } from "@/server/services/portability/route-access";

export const maxDuration = 60;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the file as a multipart form." }, { status: 400 });
  }
  const step = form.get("step") === "import" ? "import" : "check";
  const locale = form.get("locale") === "es" ? "es" : "en";
  const access = await checkImportAccess(request, form.get("organizationId") as string | null, step, locale);
  if (!access.ok) return access.response;

  const includeRightsRequests = form.get("includeRightsRequests") === "1";
  if (includeRightsRequests && form.get("acknowledgePersonalData") !== "1") {
    return Response.json(
      { error: "Rights requests hold personal data: tick the box that says so to include them." },
      { status: 400 },
    );
  }

  const file = await uploadedFile(form);
  if (!file) return Response.json({ error: "No file was sent." }, { status: 400 });
  const read = readProgrammeUpload(file.bytes);
  if (!read.ok) return Response.json({ error: "invalid_file", problems: read.problems }, { status: 422 });

  const options: ImportOptions = {
    organizationId: access.organizationId,
    userId: access.userId,
    includeRightsRequests,
    dsarModuleOn: isDsarModuleEnabled(),
    requireEmpty: true,
    mode: "programme",
    checkLimits: importLimitChecker(prisma, access.organizationId),
  };

  try {
    if (step === "check") {
      return Response.json({ step, summary: await planImport(prisma, read.programme, options) });
    }
    const result = await applyImport(prisma, read.programme, options);
    return Response.json({ step, summary: result.summary, created: result.created, importId: result.importId });
  } catch (err) {
    if (err instanceof ImportRefusedError) {
      return Response.json({ step, error: "refused", summary: err.summary }, { status: 409 });
    }
    logger.error("Programme import failed", err);
    return Response.json({ error: "The import failed and nothing was written. Try again." }, { status: 500 });
  }
}

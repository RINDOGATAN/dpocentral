// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Download route for generated DPA / standalone TIA PDFs.
 *
 * `[id]` is the VendorContract id created by vendor.generateDpa. The PDFs
 * are re-rendered deterministically from the fact snapshot stored in the
 * contract's metadata (`dpaEngine`), so nothing binary is persisted.
 * `?doc=dpa` (default) or `?doc=tia`.
 */

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { buildDpaExport, dpaInput } from "@/server/services/export/documents/dpa";
import { fileResponse } from "@/server/services/export/documents/context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const doc = searchParams.get("doc") === "tia" ? "tia" : "dpa";

  const token = await getSessionToken(request);
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {
    const contract = await prisma.vendorContract.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { name: true, organizationId: true, organization: { select: { name: true } } },
        },
      },
    });
    if (!contract) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: contract.vendor.organizationId,
        user: { email: userEmail },
      },
    });
    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!dpaInput(contract)) {
      return Response.json(
        { error: "This contract has no generated DPA snapshot" },
        { status: 404 }
      );
    }

    const file = await buildDpaExport(contract, contract.vendor.organization.name, doc);
    if (!file) {
      return Response.json(
        { error: "No standalone TIA applies to this DPA (no third-country transfer, or the TIA was excluded)" },
        { status: 404 }
      );
    }

    return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "dpa");
  }
}

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

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { renderDpaPdf, renderTiaPdf } from "@/server/services/export/dpa/render";
import type { AssembleInput } from "@/lib/dpa-engine";

const partySchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  signatoryName: z.string().optional(),
  signatoryTitle: z.string().optional(),
});

const dpaEngineMetadata = z.object({
  version: z.number(),
  language: z.enum(["en", "es"]),
  governingLaw: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]),
  facts: z.record(z.string(), z.string()),
  selections: z.record(z.string(), z.string()),
  controller: partySchema,
  processor: partySchema,
  dealName: z.string().nullable(),
  effectiveDate: z.string(),
  producedAt: z.string(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const doc = searchParams.get("doc") === "tia" ? "tia" : "dpa";

  const token = await getToken({ req: request as unknown as NextRequest });
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

    const stored = (contract.metadata as { dpaEngine?: unknown } | null)?.dpaEngine;
    const parsed = dpaEngineMetadata.safeParse(stored);
    if (!parsed.success) {
      return Response.json(
        { error: "This contract has no generated DPA snapshot" },
        { status: 404 }
      );
    }
    const snapshot = parsed.data;

    const input: AssembleInput = {
      facts: snapshot.facts,
      selections: snapshot.selections,
      context: {
        language: snapshot.language,
        effectiveDate: new Date(snapshot.effectiveDate),
        governingLaw: snapshot.governingLaw,
        controller: snapshot.controller,
        processor: snapshot.processor,
        dealName: snapshot.dealName ?? undefined,
        producedDate: new Date(snapshot.producedAt),
      },
    };

    const orgName = contract.vendor.organization.name;
    const slug = contract.vendor.name.replace(/[^a-zA-Z0-9]+/g, "-");
    const dateStr = snapshot.effectiveDate.slice(0, 10);

    const rendered =
      doc === "tia"
        ? await renderTiaPdf(input, orgName)
        : await renderDpaPdf(input, orgName);
    if (!rendered) {
      return Response.json(
        { error: "No standalone TIA applies to this DPA (no third-country transfer, or the TIA was excluded)" },
        { status: 404 }
      );
    }

    return new Response(new Uint8Array(rendered.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${doc === "tia" ? "TIA" : "DPA"}-${slug}-${dateStr}.pdf"`,
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "dpa");
  }
}

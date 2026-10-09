// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The vendor register, as PDF or CSV. See ./context.ts. */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { VendorRegisterDocument } from "@/server/services/export/vendor-register/VendorRegisterDocument";
import { vendorsToCSV, type VendorCsvRow } from "@/server/services/export/vendor-register/csv";
import { withDraftGapsPage } from "../draft-gaps-page";
import { CSV, PDF, nameForFile, today, type ExportArgs, type ExportFile } from "./context";

export async function buildVendorRegisterExport(args: ExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const format = args.format ?? "pdf";
  const [t, tCommon, tEnum] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.vendorRegister" }),
    getTranslations({ locale, namespace: "pdf.common" }),
    getTranslations({ locale, namespace: "pdf.enum" }),
  ]);

  const vendors = await prisma.vendor.findMany({
    where: { organizationId },
    include: {
      contracts: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { name: "asc" },
  });

  const data: VendorCsvRow[] = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    website: v.website,
    status: v.status,
    riskTier: v.riskTier,
    riskScore: v.riskScore,
    primaryContact: v.primaryContact,
    contactEmail: v.contactEmail,
    categories: v.categories,
    dataProcessed: v.dataProcessed,
    countries: v.countries,
    certifications: v.certifications,
    lastAssessedAt: v.lastAssessedAt,
    nextReviewAt: v.nextReviewAt,
    contracts: v.contracts.map((c) => ({
      name: c.name,
      type: c.type,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
    })),
  }));

  const base = `Vendor-Register-${nameForFile(orgName)}-${today()}`;

  if (args.audit) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "Vendor",
        entityId: organizationId,
        action: "EXPORT_VENDOR_REGISTER",
        changes: { format, count: data.length },
      },
    });
  }

  if (format === "csv") {
    return { data: vendorsToCSV(data), filename: `${base}.csv`, contentType: CSV };
  }

  const buffer = await renderToBuffer(
    withDraftGapsPage(
      VendorRegisterDocument({ vendors: data, orgName, t, tCommon, tEnum, locale }),
      args.draftNote,
    ),
  );
  return { data: new Uint8Array(buffer), filename: `${base}.pdf`, contentType: PDF };
}

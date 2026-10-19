// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The vendor register, as PDF or CSV. See ./context.ts. */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { VendorRegisterDocument } from "@/server/services/export/vendor-register/VendorRegisterDocument";
import { VENDOR_CSV_KEYS, vendorsToCSV, type VendorCsvRow } from "@/server/services/export/vendor-register/csv";
import { csvLabelsFor } from "@/server/services/export/csv-labels-i18n";
import { withDraftGapsPage } from "../draft-gaps-page";
import { CSV, PDF, nameForFile, fileTitle, today, type ExportArgs, type ExportFile } from "./context";
import { withPdfLocale } from "@/server/services/export/pdf-locale";
import { isDraftRecord } from "@/lib/drafts";

/** The UTF-8 byte order mark, so spreadsheet programs read the accents right. */
const BOM = "\uFEFF";

export async function buildVendorRegisterExport(args: ExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const format = args.format ?? "pdf";
  const [t, tCommon, tEnum, tEnums] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.vendorRegister" }),
    getTranslations({ locale, namespace: "pdf.common" }),
    getTranslations({ locale, namespace: "pdf.enum" }),
    getTranslations({ locale, namespace: "enums" }),
  ]);
  // Categories and data categories as the CSV translates them (csv-labels-i18n.ts):
  // a code, or the catalogue's category name; anything else is printed as stored.
  const label = (kind: "vendorCategory" | "dataCategory", value: string): string => {
    const key = `${kind}.${value}`;
    if (tEnums.has(key as never)) return tEnums(key as never);
    const catalogKey = `vendorCatalogCategory.${value.replace(/[^A-Za-z0-9]+/g, "_")}`;
    if (kind === "vendorCategory" && tEnums.has(catalogKey as never)) return tEnums(catalogKey as never);
    return value;
  };

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
    isDraft: isDraftRecord(v),
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

  const base = `${fileTitle("Vendor-Register", locale)}-${nameForFile(orgName)}-${today()}`;

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
    return {
      data: BOM + vendorsToCSV(data, await csvLabelsFor("vendors", VENDOR_CSV_KEYS, locale)),
      filename: `${base}.csv`,
      contentType: CSV,
    };
  }

  const buffer = await withPdfLocale(locale, () => renderToBuffer(
    withDraftGapsPage(
      VendorRegisterDocument({
        vendors: data,
        orgName,
        t,
        tCommon,
        tEnum,
        locale,
        categoryLabel: (c) => label("vendorCategory", c),
        dataLabel: (d) => label("dataCategory", d),
      }),
      args.draftNote,
    ))
  );
  return { data: new Uint8Array(buffer), filename: `${base}.pdf`, contentType: PDF };
}

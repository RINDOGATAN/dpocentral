import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { VendorRegisterDocument } from "@/server/services/export/vendor-register/VendorRegisterDocument";
import { vendorsToCSV, type VendorCsvRow } from "@/server/services/export/vendor-register/csv";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { locales, defaultLocale } from "@/i18n/config";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0]!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const format = searchParams.get("format") || "pdf";

  if (!organizationId) {
    return Response.json({ error: "organizationId is required" }, { status: 400 });
  }

  const token = await getToken({ req: request as unknown as NextRequest });
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {

  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      user: { email: userEmail },
    },
    include: { organization: true },
  });
  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Locale resolution: ?locale=es → NEXT_LOCALE cookie → default
  const requestedLocale = searchParams.get("locale");
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const resolvedLocale = [requestedLocale, cookieLocale, defaultLocale].find(
    (l): l is string => !!l && (locales as readonly string[]).includes(l)
  ) ?? defaultLocale;
  const [t, tCommon, tEnum] = await Promise.all([
    getTranslations({ locale: resolvedLocale, namespace: "pdf.vendorRegister" }),
    getTranslations({ locale: resolvedLocale, namespace: "pdf.common" }),
    getTranslations({ locale: resolvedLocale, namespace: "pdf.enum" }),
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

  const orgName = membership.organization.name;
  const dateStr = fmtDate(new Date());

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: membership.userId,
      entityType: "Vendor",
      entityId: organizationId,
      action: "EXPORT_VENDOR_REGISTER",
      changes: { format, count: data.length },
    },
  });

  if (format === "csv") {
    const csv = vendorsToCSV(data);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Vendor-Register-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.csv"`,
      },
    });
  }

  const buffer = await renderToBuffer(
    VendorRegisterDocument({ vendors: data, orgName, t, tCommon, tEnum, locale: resolvedLocale })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Vendor-Register-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf"`,
    },
  });
  } catch (err) {
    return pdfErrorResponse(err, "vendor-register");
  }
}

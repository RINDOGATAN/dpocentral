// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What every document builder in this folder takes and returns.
 *
 * The export routes (src/app/api/export/**) and the document pack
 * (../document-pack.ts) produce the same documents from the same builders:
 * the route checks who is asking and answers with one file; the pack checks
 * once and puts many files in one archive. A builder never reads the request,
 * the cookies or the session, so it cannot be called for an organisation the
 * caller has not checked.
 */

import type { Db } from "@/lib/prisma";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { getCookieLocale } from "@/i18n/server-locale";
import { withReaderLanguage } from "@/lib/system-content/runtime";
import type { DraftNote } from "../draft-gaps-page";

export interface ExportArgs {
  prisma: Db;
  organizationId: string;
  /** The organisation's name, as the documents print it. */
  orgName: string;
  /** The member asking, for the audit log. */
  userId: string;
  locale: Locale;
  format?: "pdf" | "csv";
  /**
   * Write the document's own audit entry (the single download does). The pack
   * writes one entry for the whole archive instead.
   */
  audit?: boolean;
  /** A draft's gaps, printed on a first page of their own (PDF only). */
  draftNote?: DraftNote | null;
}

export interface ExportFile {
  data: Uint8Array | string;
  filename: string;
  contentType: string;
}

/** ?locale=, then the language cookie, then the default. */
export async function resolveExportLocale(requested: string | null): Promise<Locale> {
  const cookieLocale = await getCookieLocale();
  return (
    [requested, cookieLocale, defaultLocale].find(
      (l): l is Locale => !!l && (locales as readonly string[]).includes(l),
    ) ?? defaultLocale
  );
}

/**
 * An export route's handler, run in the export's language: the records the
 * app wrote itself (the TODO.LAW processor, its transfer and its TIA) are read
 * in that language (src/lib/system-content/), so the file says what the
 * reader's screen says.
 */
export function withExportLanguage<A extends [Request, ...unknown[]], R>(
  handler: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const locale = await resolveExportLocale(new URL(args[0].url).searchParams.get("locale"));
    return withReaderLanguage(locale, () => handler(...args));
  };
}

/** The organisation's name as it appears in a file name. */
/**
 * An organisation's name as part of a file name: accents dropped rather than
 * turned into dashes ("Ejemplo Logística, S.L." gives "Ejemplo-Logistica-S-L",
 * not "Ejemplo-Log-stica--S-L-"), one dash between words, none at the ends.
 */
export function nameForFile(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "organisation"
  );
}

/**
 * The leading words of an export's file name in the document's language.
 * Spanish names drop accents so the file name stays plain ASCII.
 */
const FILE_TITLES_ES: Record<string, string> = {
  "Assessment": "Evaluacion",
  "Assessment-Portfolio": "Cartera-de-Evaluaciones",
  "Breach-Register": "Registro-de-Brechas",
  "DSAR-Performance": "Rendimiento-Solicitudes-de-Derechos",
  "Privacy-Program": "Programa-de-Privacidad",
  "Regulatory-Landscape": "Panorama-Normativo",
  "ROPA": "RAT-Registro-de-Actividades-de-Tratamiento",
  "ROPA-Processor": "RAT-Encargado-Registro-de-Actividades-de-Tratamiento",
  "Vendor-Register": "Registro-de-Proveedores",
  "rights-requests": "solicitudes-de-derechos",
};

export function fileTitle(title: string, locale: string | null | undefined): string {
  return locale === "es" ? (FILE_TITLES_ES[title] ?? title) : title;
}

export function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

export const PDF = "application/pdf";
export const CSV = "text/csv; charset=utf-8";

/** The file as a download. */
export function fileResponse(file: ExportFile): Response {
  const body = typeof file.data === "string" ? file.data : new Uint8Array(file.data);
  return new Response(body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}

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

/** The organisation's name as it appears in a file name. */
export function nameForFile(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "-");
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

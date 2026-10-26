// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/portability/register/template?register=...&format=csv|xlsx&locale=en|es
 *
 * An empty template for the register import: the headers the import reads,
 * in the reader's language. It holds no organisation data, so any signed-in
 * person may download it. See src/server/services/portability/register-template.ts.
 */

import { getSessionToken } from "@/lib/session-cookie";
import { CSV_REGISTERS, type CsvRegister } from "@/server/services/portability/csv-import";
import { csvTemplate, templateFileName, xlsxTemplate } from "@/server/services/portability/register-template";

export async function GET(request: Request) {
  const token = await getSessionToken(request);
  if (!token?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const register = url.searchParams.get("register") as CsvRegister;
  if (!CSV_REGISTERS.includes(register)) return Response.json({ error: "Unknown register." }, { status: 400 });
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const locale = url.searchParams.get("locale") === "es" ? "es" : "en";
  const headers = {
    "Content-Disposition": `attachment; filename="${templateFileName(register, locale, format)}"`,
    "Cache-Control": "no-store",
  };

  if (format === "xlsx") {
    return new Response(new Uint8Array(xlsxTemplate(register, locale)), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }
  return new Response(csvTemplate(register, locale), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
  });
}

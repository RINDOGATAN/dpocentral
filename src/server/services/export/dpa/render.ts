// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  assembleDpa,
  assembleStandaloneTia,
  formatLongDate,
  type AssembleInput,
} from "@/lib/dpa-engine";
import { DpaDocument } from "./DpaDocument";
import { TiaDocument } from "./TiaDocument";

/** Assemble and render the signature-ready DPA. Also returns the model so
 *  callers can persist warnings/metadata alongside the PDF. */
export async function renderDpaPdf(input: AssembleInput, orgName: string) {
  const model = assembleDpa(input);
  const buffer = await renderToBuffer(
    React.createElement(DpaDocument, { model, orgName })
  );
  return { model, buffer };
}

/** Assemble and render the standalone TIA (§8), or null when Annex IV does
 *  not render for these facts. */
export async function renderTiaPdf(input: AssembleInput, orgName: string) {
  const model = assembleStandaloneTia(input);
  if (!model) return null;
  const date = formatLongDate(
    input.context.producedDate ?? new Date(),
    input.context.language
  );
  const buffer = await renderToBuffer(
    React.createElement(TiaDocument, { model, orgName, date })
  );
  return { model, buffer };
}

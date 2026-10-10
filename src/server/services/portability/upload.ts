// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reading an uploaded programme: the export ZIP (programme.json at its root,
 * or inside one top folder if the archive was unpacked and packed again) or
 * programme.json on its own. Sizes are checked before anything is unpacked,
 * so a small archive that expands enormously is refused rather than read.
 */

import AdmZip from "adm-zip";
import { validateProgramme, type FormatProblem, type ProgrammeDoc } from "./format";

/** Largest upload accepted (the hosted service's own request limit is lower: 4.5 MB). */
export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
/** Largest programme.json read, once unpacked. */
export const MAX_PROGRAMME_JSON_BYTES = 200 * 1024 * 1024;

export type UploadResult =
  | { ok: true; programme: ProgrammeDoc }
  | { ok: false; problems: Array<FormatProblem & { es?: string }> };

const isZip = (bytes: Uint8Array) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

function fail(en: string, es: string, path = ""): UploadResult {
  return { ok: false, problems: [{ path, message: en, es }] };
}

/** The programme in an uploaded file, validated against the format. */
export function readProgrammeUpload(bytes: Uint8Array): UploadResult {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return fail(
      `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      `El archivo pesa más de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }
  let text: string;
  if (isZip(bytes)) {
    let zip: AdmZip;
    try {
      zip = new AdmZip(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length));
    } catch {
      return fail("The ZIP file cannot be read.", "No se puede leer el archivo ZIP.");
    }
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const entry =
      entries.find((e) => e.entryName === "programme.json") ??
      entries.find((e) => /^[^/]+\/programme\.json$/.test(e.entryName));
    if (!entry) {
      return fail(
        "The ZIP file has no programme.json. Upload the archive made by \"Take your programme with you\", or its programme.json.",
        "El archivo ZIP no contiene programme.json. Sube el archivo que genera \"Llévate tu programa\" o su programme.json.",
      );
    }
    if (entry.header.size > MAX_PROGRAMME_JSON_BYTES) {
      return fail(
        `programme.json is larger than ${MAX_PROGRAMME_JSON_BYTES / 1024 / 1024} MB once unpacked.`,
        `programme.json pesa más de ${MAX_PROGRAMME_JSON_BYTES / 1024 / 1024} MB una vez descomprimido.`,
      );
    }
    try {
      text = entry.getData().toString("utf8");
    } catch {
      return fail("programme.json inside the ZIP is damaged.", "El programme.json del ZIP está dañado.");
    }
  } else {
    text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length).toString("utf8");
  }
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return fail("The file is not valid JSON.", "El archivo no es un JSON válido.");
  }
  const result = validateProgramme(value);
  return result.ok ? { ok: true, programme: result.programme } : { ok: false, problems: result.problems };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Export integrity, as AI Sentinel's programme pack does it.
 *
 * An exported document is evidence only if a reader can tell, later, what
 * produced it. The document pack therefore carries a stamp (when it was
 * generated and from which build of the application) and a manifest with a
 * SHA-256 digest per file, so a single altered file inside a delivered
 * archive is detectable.
 *
 * This proves what the application produced, not that nobody altered the file
 * afterwards. Digital signing would be the next step; the manifest is the part
 * that is useful without a key ceremony, because the digests can be quoted in
 * a cover letter or a production log and checked with any standard tool.
 */

import { createHash } from "crypto";
import { version as appVersion } from "../../../../package.json";

export interface ExportStamp {
  generatedAt: string;
  appVersion: string;
  /** Short commit of the running build, where it is known. */
  commit: string | null;
}

export function exportStamp(now: Date = new Date()): ExportStamp {
  // Inlined at build time by next.config.ts (src/lib/build-info.ts).
  const commit = process.env.BUILD_COMMIT || "";
  return {
    generatedAt: now.toISOString(),
    appVersion,
    commit: commit && commit !== "unknown" ? commit.slice(0, 7) : null,
  };
}

/** The stamp as plain lines. */
export function stampLines(stamp: ExportStamp, locale: "en" | "es" = "en"): string[] {
  const build = `${stamp.appVersion}${stamp.commit ? ` (${stamp.commit})` : ""}`;
  return locale === "es"
    ? [`Generado el ${stamp.generatedAt}`, `Versión de la aplicación: ${build}`]
    : [`Generated at ${stamp.generatedAt}`, `Application version: ${build}`];
}

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256")
    .update(typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data))
    .digest("hex");
}

export interface ManifestEntry {
  name: string;
  bytes: number;
  sha256: string;
}

/**
 * The manifest text placed inside an exported archive. Plain text on purpose:
 * it has to be readable by whoever receives the archive, without tooling.
 */
export function renderManifest(stamp: ExportStamp, entries: ManifestEntry[], locale: "en" | "es" = "en"): string {
  const t =
    locale === "es"
      ? {
          title: "MANIFIESTO DE INTEGRIDAD",
          intro:
            "Este archivo enumera cada fichero del paquete con su huella SHA-256. Para comprobar un fichero, calcula su huella (por ejemplo, con `shasum -a 256 <fichero>`) y compárala con la que figura aquí.",
          files: "Ficheros",
          note: "El manifiesto acredita lo que produjo la aplicación. No acredita que el archivo no se haya modificado después: para eso haría falta una firma.",
          cols: ["Huella SHA-256", "Bytes", "Fichero"],
        }
      : {
          title: "INTEGRITY MANIFEST",
          intro:
            "This file lists every file in the pack with its SHA-256 digest. To check a file, compute its digest (for example with `shasum -a 256 <file>`) and compare it with the value here.",
          files: "Files",
          note: "The manifest evidences what the application produced. It does not evidence that the archive was not altered afterwards; that would need a signature.",
          cols: ["SHA-256", "Bytes", "File"],
        };

  const lines: string[] = [];
  lines.push(t.title, "=".repeat(t.title.length), "");
  lines.push(...stampLines(stamp, locale), "");
  lines.push(t.intro, "");
  lines.push(t.files, "-".repeat(t.files.length));
  lines.push(t.cols.join(" | "));
  for (const e of entries) {
    lines.push([e.sha256, String(e.bytes), e.name].join(" | "));
  }
  lines.push("");
  lines.push(t.note);
  return lines.join("\n") + "\n";
}

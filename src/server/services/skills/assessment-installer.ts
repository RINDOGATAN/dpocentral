// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Assessment-skill installer (self-host content delivery).
//
// DPO Central's premium assessment CONTENT (the DPIA/PIA sections + scoring) is
// stripped from the self-host image. A firm buys it on the todo.law storefront,
// downloads a signed assessment `.skill`, and installs it here — this writes the
// system AssessmentTemplate so the type stops being hidden by the
// template-existence filter and the wizard opens with real content.
//
// Format (a signed zip, same envelope as deal-room's contract .skill so one
// signing key + method covers both):
//   manifest.json          { skillId, name, displayName, version, assessmentType,
//                            jurisdictions[], languages[], files{path->sha256} }
//   content/template.json   { type, name, description?, version?, sections[], scoringLogic? }
//   signature.sig           Ed25519 over computePackageHash(all files bar signature.sig)
import AdmZip from "adm-zip";
import { z } from "zod";
import { AssessmentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computePackageHash,
  sha256,
  verifyEd25519Signature,
} from "@/lib/license-crypto";

const ManifestSchema = z.object({
  skillId: z.string().regex(/^com\.(nel|todolaw)\.(dpocentral|skills)\.[a-z0-9.-]+$/),
  name: z.string(),
  displayName: z.string(),
  version: z.string(),
  assessmentType: z.nativeEnum(AssessmentType),
  jurisdictions: z.array(z.string()).default([]),
  languages: z.array(z.string()).default(["en"]),
  files: z.record(z.string(), z.string()),
  createdAt: z.string().optional(),
});

// sections/scoringLogic are opaque JSON to this layer (validated by the
// assessment engine at render time) — keep the shape check shallow but real.
const TemplateSchema = z.object({
  type: z.nativeEnum(AssessmentType),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().default("1.0"),
  sections: z.array(z.record(z.string(), z.unknown())).min(1),
  scoringLogic: z.record(z.string(), z.unknown()).nullish(),
});

export interface AssessmentInstallResult {
  success: boolean;
  assessmentType?: AssessmentType;
  templateId?: string;
  errors: string[];
}

export async function installAssessmentSkillFromBuffer(
  buffer: Buffer,
): Promise<AssessmentInstallResult> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { success: false, errors: ["Invalid package archive (not a .skill zip)"] };
  }

  const read = (name: string): Buffer | null => {
    const e = zip.getEntry(name);
    return e ? e.getData() : null;
  };

  const manifestBuf = read("manifest.json");
  const templateBuf = read("content/template.json");
  const sigBuf = read("signature.sig");
  if (!manifestBuf) return { success: false, errors: ["MISSING_MANIFEST"] };
  if (!templateBuf) return { success: false, errors: ["MISSING_TEMPLATE: content/template.json"] };
  if (!sigBuf || sigBuf.length === 0) return { success: false, errors: ["MISSING_SIGNATURE"] };

  let manifest: z.infer<typeof ManifestSchema>;
  let template: z.infer<typeof TemplateSchema>;
  try {
    manifest = ManifestSchema.parse(JSON.parse(manifestBuf.toString("utf-8")));
  } catch (e) {
    return { success: false, errors: [`INVALID_MANIFEST: ${msg(e)}`] };
  }
  try {
    template = TemplateSchema.parse(JSON.parse(templateBuf.toString("utf-8")));
  } catch (e) {
    return { success: false, errors: [`INVALID_TEMPLATE: ${msg(e)}`] };
  }
  if (template.type !== manifest.assessmentType) {
    return { success: false, errors: ["TYPE_MISMATCH: manifest.assessmentType != template.type"] };
  }

  // Integrity: every file the manifest lists must be present + hash-match.
  const files = new Map<string, Buffer>();
  files.set("manifest.json", manifestBuf);
  files.set("content/template.json", templateBuf);
  for (const [p, h] of Object.entries(manifest.files)) {
    const b = read(p);
    if (!b) return { success: false, errors: [`MISSING_FILE: ${p}`] };
    if (sha256(b) !== h) return { success: false, errors: [`HASH_MISMATCH: ${p}`] };
  }

  // Authenticity: Ed25519 over the package hash, against SKILL_SIGNING_PUBLIC_KEY.
  const packageHash = computePackageHash(files);
  if (!verifyEd25519Signature(Buffer.from(packageHash, "hex"), sigBuf)) {
    return { success: false, errors: ["INVALID_SIGNATURE: Package signature verification failed"] };
  }

  // Upsert the system template, reconciling onto the seed's deterministic id so
  // this REPLACES any coming-soon stub rather than duplicating (mirrors
  // scripts/seed-templates.ts `system-<type>-template`).
  const id = `system-${manifest.assessmentType.toLowerCase()}-template`;
  const data = {
    type: manifest.assessmentType,
    name: template.name,
    description: template.description ?? null,
    version: template.version,
    sections: template.sections as object,
    scoringLogic: (template.scoringLogic ?? undefined) as object | undefined,
    isSystem: true,
    isActive: true,
    organizationId: null,
  };
  const saved = await prisma.assessmentTemplate.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });

  return {
    success: true,
    assessmentType: manifest.assessmentType,
    templateId: saved.id,
    errors: [],
  };
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

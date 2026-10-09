// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The document pack: every document of the register in the "ready" state, in
 * one ZIP and in the reader's language (owner's decisions, 9 October 2026,
 * step 5), built the way AI Sentinel builds its programme pack:
 *
 *   00-INDEX.md            each document, its state, its date and its file;
 *                          then what is not in the pack and why
 *   01-...pdf / .csv       the organisation-wide documents, numbered in
 *                          register order, each in every format it has
 *   NN-assessments/        one report per assessment (approved ones; the
 *                          others too when drafts are asked for)
 *   NN-dpa/                each generated DPA, with its TIA where one applies
 *   99-MANIFEST.txt        a SHA-256 digest per file and the build stamp
 *
 * With the drafts option, a draft goes in with "DRAFT" ("BORRADOR") in its
 * file name and its gaps on its first page: the assessment reports already
 * list what is outstanding on their cover; every other PDF gets a first page
 * of its own (./draft-gaps-page.tsx).
 *
 * The documents are the same as the single downloads: the same builders
 * (./documents/*) render them. The caller has checked who is asking.
 */

import { getTranslations } from "next-intl/server";
import type { Db } from "@/lib/prisma";
import type { Locale } from "@/i18n/config";
import { createZip, type ZipEntry } from "@/lib/zip";
import { evaluateRegister, registerFor, type DocumentGap } from "@/config/document-register";
import { isDsarModuleEnabled } from "@/config/features";
import { planPack, packFileName, fileSlug, type PackPlan } from "@/lib/document-pack";
import { loadDocumentFacts } from "@/server/services/program/document-facts";
import { hasRopaExportAccess } from "@/server/services/licensing/entitlement";
import { exportStamp, renderManifest, sha256, type ManifestEntry } from "./integrity";
import type { DraftNote } from "./draft-gaps-page";
import type { ExportArgs, ExportFile } from "./documents/context";
import { buildRegulatoryLandscapeExport } from "./documents/regulatory-landscape";
import { buildRopaExport } from "./documents/ropa";
import { buildVendorRegisterExport } from "./documents/vendor-register";
import { buildAssessmentPortfolioExport } from "./documents/assessment-portfolio";
import { buildDsarPerformanceExport } from "./documents/dsar-performance";
import { buildBreachRegisterExport } from "./documents/breach-register";
import { buildPrivacyProgramExport } from "./documents/privacy-program";
import { buildBoardReportExport } from "./documents/board-report";
import { ASSESSMENT_EXPORT_INCLUDE, buildAssessmentExport } from "./documents/assessment";
import { buildDpaExport } from "./documents/dpa";

type Builder = (args: ExportArgs) => Promise<ExportFile>;

/** The organisation-wide documents and the builder behind each download. */
const BUILDERS: Record<string, Builder> = {
  regulatoryReport: buildRegulatoryLandscapeExport,
  ropa: buildRopaExport,
  vendorRegister: buildVendorRegisterExport,
  assessmentPortfolio: buildAssessmentPortfolioExport,
  dsarPerformance: buildDsarPerformanceExport,
  breachRegister: buildBreachRegisterExport,
  programmeReport: buildPrivacyProgramExport,
  // The last full quarter, as the dashboard's single download.
  boardReport: buildBoardReportExport,
};

export interface PackRow {
  /** The document's name as the index prints it. */
  name: string;
  state: "ready" | "draft";
  /** The draft's gaps in words. */
  gaps: string[];
  /** YYYY-MM-DD. */
  date: string;
  files: string[];
}

export interface DocumentPack {
  zip: Uint8Array;
  filename: string;
  files: string[];
  rows: PackRow[];
  plan: PackPlan;
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function gapsInWords(tr: T, gaps: readonly DocumentGap[]): string[] {
  return gaps.map((g) => tr(`gaps.${g.key}`, { count: g.count }));
}

const mdCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const day = (d: Date) => d.toISOString().slice(0, 10);

export async function buildDocumentPack(
  prisma: Db,
  args: {
    organizationId: string;
    orgName: string;
    userId: string;
    locale: Locale;
    includeDrafts: boolean;
    /** The member handles rights requests (src/lib/dsar-access.ts). */
    dsarAllowed: boolean;
  },
): Promise<DocumentPack> {
  const { organizationId, orgName, userId, locale, includeDrafts } = args;
  const [t, tr, ta] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.documentPack" }),
    getTranslations({ locale, namespace: "documentRegister" }),
    getTranslations({ locale, namespace: "pdf.assessmentReport" }),
  ]);
  const now = new Date();
  const today = day(now);
  const draftMark = t("draftMark");

  // The same states as the dashboard panel.
  const facts = await loadDocumentFacts(prisma, organizationId);
  const documents = evaluateRegister(registerFor({ dsarEnabled: isDsarModuleEnabled() }), facts);
  const notEntitled = (await hasRopaExportAccess(organizationId)) ? [] : ["ropa"];
  const plan = planPack(documents, { includeDrafts, dsarAllowed: args.dsarAllowed, notEntitled });

  const entries: ZipEntry[] = [];
  const rows: PackRow[] = [];
  const extra: string[] = [];
  let number = 0;

  for (const doc of plan.include) {
    const name = tr(`items.${doc.entry.id}`);
    const draft = doc.state === "draft";
    const gaps = gapsInWords(tr, doc.gaps);

    const builder = BUILDERS[doc.entry.id];
    if (builder) {
      number++;
      const note: DraftNote | null = draft
        ? {
            mark: draftMark,
            title: name,
            intro: t("draftNote.intro"),
            gapsTitle: t("draftNote.gapsTitle"),
            gaps,
            generated: t("draftNote.generated", { date: today }),
          }
        : null;
      const files: string[] = [];
      for (const format of doc.entry.formats) {
        if (format === "screen") continue;
        const file = await builder({
          prisma,
          organizationId,
          orgName,
          userId,
          locale,
          format,
          audit: false,
          draftNote: format === "pdf" ? note : null,
        });
        const fileName = packFileName({ number, name, extension: format, draft, draftMark });
        entries.push({ name: fileName, data: file.data });
        files.push(fileName);
      }
      rows.push({ name, state: doc.state, gaps, date: today, files });
      continue;
    }

    if (doc.entry.id === "assessmentReport") {
      // Approved assessments are ready; the others are drafts, which list
      // what is outstanding on their own cover.
      const assessments = await prisma.assessment.findMany({
        where: {
          organizationId,
          status: includeDrafts ? { not: "ARCHIVED" } : "APPROVED",
        },
        include: ASSESSMENT_EXPORT_INCLUDE,
        orderBy: { name: "asc" },
      });
      if (!includeDrafts) {
        const unapproved = await prisma.assessment.count({
          where: { organizationId, status: { notIn: ["APPROVED", "ARCHIVED"] } },
        });
        if (unapproved > 0) extra.push(t("index.unapprovedLeftOut", { count: unapproved }));
      }
      if (assessments.length === 0) continue;
      number++;
      const dir = `${String(number).padStart(2, "0")}-${t("assessmentsDir")}`;
      const used = new Set<string>();
      for (const assessment of assessments) {
        if (!assessment.template) continue;
        const file = await buildAssessmentExport({ ...assessment, template: assessment.template }, locale);
        const isDraft = assessment.status !== "APPROVED";
        const typeLabel = ta(`assessmentTypes.${assessment.template.type}`);
        let base = `${isDraft ? `${draftMark}-` : ""}${fileSlug(`${typeLabel} ${assessment.name}`)}`;
        for (let i = 2; used.has(base); i++) base = `${base}-${i}`;
        used.add(base);
        const fileName = `${dir}/${base}.pdf`;
        entries.push({ name: fileName, data: file.data });
        rows.push({
          name: t("assessmentName", { type: typeLabel, name: assessment.name }),
          state: isDraft ? "draft" : "ready",
          gaps: isDraft ? [t("assessmentGaps")] : [],
          date: day(assessment.completedAt ?? assessment.updatedAt),
          files: [fileName],
        });
      }
      continue;
    }

    if (doc.entry.id === "dpa") {
      const contracts = await prisma.vendorContract.findMany({
        where: { type: "DPA", vendor: { organizationId } },
        select: { metadata: true, vendor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      const produced: { files: string[]; date: string; vendor: string }[] = [];
      const dirNumber = number + 1;
      const dir = `${String(dirNumber).padStart(2, "0")}-${t("dpaDir")}`;
      const used = new Set<string>();
      for (const contract of contracts) {
        const files: string[] = [];
        let date = today;
        for (const kind of ["dpa", "tia"] as const) {
          const file = await buildDpaExport(contract, orgName, kind);
          if (!file) continue;
          let base = file.filename.replace(/\.pdf$/, "");
          for (let i = 2; used.has(base); i++) base = `${base}-${i}`;
          used.add(base);
          const fileName = `${dir}/${base}.pdf`;
          entries.push({ name: fileName, data: file.data });
          files.push(fileName);
          date = file.effectiveDate;
        }
        if (files.length > 0) produced.push({ files, date, vendor: contract.vendor.name });
      }
      if (produced.length === 0) continue;
      number = dirNumber;
      for (const p of produced) {
        rows.push({ name: t("dpaName", { vendor: p.vendor }), state: "ready", gaps: [], date: p.date, files: p.files });
      }
    }
  }

  // ---- The index ---------------------------------------------------------
  const stateWord = (row: PackRow) =>
    row.state === "draft" && row.gaps.length > 0
      ? `${tr("state.draft")}: ${row.gaps.join("; ")}`
      : tr(`state.${row.state}`);
  const reasonText = (left: PackPlan["leftOut"][number]) => {
    const status = left.doc.status;
    if (left.reason === "needsInput" && status.state === "needsInput") {
      return tr("needs", { input: tr(`inputs.${status.input}`) });
    }
    if (left.reason === "draftsNotRequested" && status.state === "draft") {
      return t("reasons.draftsNotRequested", { gaps: gapsInWords(tr, status.gaps).join("; ") });
    }
    return t(`reasons.${left.reason}`);
  };
  const indexName = t("indexFile");
  const manifestName = t("manifestFile");
  const index = [
    `# ${t("index.title", { org: orgName })}`,
    "",
    t("index.generated", { date: today }),
    "",
    includeDrafts ? t("index.withDrafts") : t("index.readyOnly"),
    "",
    `## ${t("index.contents")}`,
    "",
    `| ${t("index.colDocument")} | ${t("index.colState")} | ${t("index.colDate")} | ${t("index.colFile")} |`,
    "|---|---|---|---|",
    ...rows.map(
      (r) => `| ${mdCell(r.name)} | ${mdCell(stateWord(r))} | ${r.date} | ${r.files.map((f) => `\`${f}\``).join(", ")} |`,
    ),
    ...(rows.length === 0 ? [`| ${t("index.empty")} | | | |`] : []),
    "",
    `## ${t("index.notIncluded")}`,
    "",
    ...plan.leftOut.map((left) => `- ${tr(`items.${left.entry.id}`)}: ${reasonText(left)}`),
    ...extra.map((line) => `- ${line}`),
    "",
    t("index.manifest", { file: manifestName }),
    "",
  ].join("\n");
  entries.unshift({ name: indexName, data: index });

  // The manifest goes in last and covers every other file.
  const stamp = exportStamp(now);
  const manifestEntries: ManifestEntry[] = entries.map((e) => {
    const bytes = typeof e.data === "string" ? new TextEncoder().encode(e.data) : e.data;
    return { name: e.name, bytes: bytes.length, sha256: sha256(bytes) };
  });
  entries.push({ name: manifestName, data: renderManifest(stamp, manifestEntries, locale) });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      entityType: "Organization",
      entityId: organizationId,
      action: "EXPORT_DOCUMENT_PACK",
      changes: {
        format: "zip",
        locale,
        includeDrafts,
        files: entries.length,
        documents: rows.length,
        appVersion: stamp.appVersion,
        commit: stamp.commit,
        generatedAt: stamp.generatedAt,
      },
    },
  });

  const filename = `${t("fileTitle")}-${fileSlug(orgName)}-${today}.zip`;
  return { zip: createZip(entries), filename, files: entries.map((e) => e.name), rows, plan };
}

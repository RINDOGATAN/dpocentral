import React from "react";
import { Document } from "@react-pdf/renderer";
import "../design-system/fonts";
import { CoverSummaryPage } from "./pages/CoverSummaryPage";
import { InventoryPage } from "./pages/InventoryPage";
import { RopaPage } from "./pages/RopaPage";
import { VendorDirectoryPage } from "./pages/VendorDirectoryPage";
import { AIGovernancePage } from "./pages/AIGovernancePage";
import { DataFlowPage, type FlowPageBatch } from "./pages/DataFlowPage";
import type { ProgramInput, PdfT } from "./data-mapping";

export interface PrivacyProgramDocumentProps {
  orgName: string;
  date: string;
  input: ProgramInput;
  /** Scoped to `pdf.privacyProgram` */
  t: PdfT;
  /** Scoped to `pdf.common` */
  tCommon: PdfT;
  /** Scoped to `pdf.enum` */
  tEnum: PdfT;
  /** BCP-47 locale code, e.g. "en" or "es". Applied as PDF metadata. */
  locale?: string;
  flowBatches?: FlowPageBatch[];
  flowOriginalCount?: number;
  flowFilteredCount?: number;
  flowOrphansDropped?: number;
}

export function PrivacyProgramDocument({
  orgName,
  date,
  input,
  t,
  tCommon,
  tEnum,
  locale,
  flowBatches = [],
  flowOriginalCount = 0,
  flowFilteredCount = 0,
  flowOrphansDropped = 0,
}: PrivacyProgramDocumentProps) {
  const hasAi = input.aiSystems.length > 0;
  // Flow Map is section 05 when there's no AI page, else 06. Both keys live in the
  // translation bundle so each locale formats the number word correctly.
  const flowSectionKey = hasAi ? "flowMap.sectionNumber" : "ai.sectionNumber";
  return (
    <Document language={locale}>
      <CoverSummaryPage orgName={orgName} date={date} input={input} t={t} tCommon={tCommon} />
      <InventoryPage orgName={orgName} date={date} input={input} t={t} tEnum={tEnum} />
      <RopaPage orgName={orgName} date={date} input={input} t={t} tEnum={tEnum} />
      <VendorDirectoryPage orgName={orgName} date={date} input={input} t={t} tEnum={tEnum} />
      {hasAi && (
        <AIGovernancePage orgName={orgName} date={date} input={input} t={t} tEnum={tEnum} />
      )}
      {flowBatches.length > 0 && (
        <DataFlowPage
          orgName={orgName}
          date={date}
          batches={flowBatches}
          originalCount={flowOriginalCount}
          filteredCount={flowFilteredCount}
          orphansDropped={flowOrphansDropped}
          sectionNumber={t(flowSectionKey)}
          t={t}
          tEnum={tEnum}
        />
      )}
    </Document>
  );
}

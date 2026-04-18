import React from "react";
import { Document } from "@react-pdf/renderer";
import "../design-system/fonts";
import { CoverSummaryPage } from "./pages/CoverSummaryPage";
import { InventoryPage } from "./pages/InventoryPage";
import { RopaPage } from "./pages/RopaPage";
import { VendorDirectoryPage } from "./pages/VendorDirectoryPage";
import { AIGovernancePage } from "./pages/AIGovernancePage";
import { DataFlowPage, type FlowPageBatch } from "./pages/DataFlowPage";
import type { ProgramInput } from "./data-mapping";

export interface PrivacyProgramDocumentProps {
  orgName: string;
  date: string;
  input: ProgramInput;
  flowBatches?: FlowPageBatch[];
  flowOriginalCount?: number;
  flowFilteredCount?: number;
  flowOrphansDropped?: number;
}

export function PrivacyProgramDocument({
  orgName,
  date,
  input,
  flowBatches = [],
  flowOriginalCount = 0,
  flowFilteredCount = 0,
  flowOrphansDropped = 0,
}: PrivacyProgramDocumentProps) {
  const hasAi = input.aiSystems.length > 0;
  const flowSectionNumber = hasAi ? "06" : "05";
  return (
    <Document>
      <CoverSummaryPage orgName={orgName} date={date} input={input} />
      <InventoryPage orgName={orgName} date={date} input={input} />
      <RopaPage orgName={orgName} date={date} input={input} />
      <VendorDirectoryPage orgName={orgName} date={date} input={input} />
      {hasAi && <AIGovernancePage orgName={orgName} date={date} input={input} />}
      {flowBatches.length > 0 && (
        <DataFlowPage
          orgName={orgName}
          date={date}
          batches={flowBatches}
          originalCount={flowOriginalCount}
          filteredCount={flowFilteredCount}
          orphansDropped={flowOrphansDropped}
          sectionNumber={flowSectionNumber}
        />
      )}
    </Document>
  );
}

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  PageFrame,
  SectionHeading,
  tokens,
  colorForAssetType,
} from "../../design-system";
import {
  FlowGraphImage,
  type RenderedFlowGraph,
} from "../../flow-graph-pdf";
import type { PdfT } from "../data-mapping";

const s = StyleSheet.create({
  notice: {
    fontSize: tokens.typography.size.caption,
    color: tokens.color.text.secondary,
    marginBottom: tokens.space[4],
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
  },
  legendTitle: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: tokens.space[3],
    marginTop: tokens.space[5],
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: tokens.space[4],
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: tokens.space[6],
    marginBottom: tokens.space[2],
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: tokens.space[3],
  },
  legendLabel: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.primary,
  },
  subHeading: {
    fontSize: tokens.typography.size.h4,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: tokens.space[3],
  },
});

export interface FlowPageBatch {
  label: string;
  graph: RenderedFlowGraph | null;
  /** Distinct asset types in this batch, for the legend. */
  assetTypes: string[];
}

export function DataFlowPage({
  orgName,
  date,
  batches,
  filteredCount,
  originalCount,
  orphansDropped,
  sectionNumber,
  t,
  tEnum,
}: {
  orgName: string;
  date: string;
  batches: FlowPageBatch[];
  filteredCount: number;
  originalCount: number;
  orphansDropped: number;
  sectionNumber?: string;
  t: PdfT;
  tEnum: PdfT;
}) {
  if (batches.length === 0 || batches.every((b) => !b.graph)) return null;

  const isMultiBatch = batches.length > 1;
  const orphanPart =
    orphansDropped > 0
      ? ` · ${t("flowMap.orphansDropped", { count: orphansDropped })}`
      : "";

  return (
    <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
      <SectionHeading
        eyebrow={sectionNumber ?? t("flowMap.sectionNumber")}
        title={t("flowMap.title")}
        lead={
          isMultiBatch
            ? t("flowMap.leadMulti", { count: batches.length })
            : t("flowMap.leadSingle")
        }
        first
      />

      <Text style={s.notice}>
        {t("flowMap.showingCount", { filtered: filteredCount, original: originalCount })}
        {orphanPart}.
      </Text>

      {/* Asset type legend (rendered once on the first page) */}
      {batches[0]?.assetTypes && batches[0].assetTypes.length > 0 && (
        <>
          <Text style={s.legendTitle}>{t("flowMap.assetTypes")}</Text>
          <View style={s.legendRow}>
            {batches[0].assetTypes.map((type) => (
              <View key={type} style={s.legendItem}>
                <View
                  style={[s.legendSwatch, { backgroundColor: colorForAssetType(type) }]}
                />
                <Text style={s.legendLabel}>{tEnum(`assetType.${type}`)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {batches.map((b, i) => (
        <View key={i} style={{ marginBottom: tokens.space[6] }} wrap={false}>
          {isMultiBatch && (
            <Text style={s.subHeading}>
              {i + 1}. {b.label}
            </Text>
          )}
          {b.graph && <FlowGraphImage graph={b.graph} width={500} />}
        </View>
      ))}
    </PageFrame>
  );
}

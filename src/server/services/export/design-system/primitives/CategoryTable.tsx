import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { tokens } from "../tokens";

const s = StyleSheet.create({
  wrap: {
    marginBottom: tokens.space[7],
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: tokens.space[3],
  },
  categoryTitle: {
    fontSize: tokens.typography.size.h4,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navy,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
  },
  categoryCount: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.muted,
    marginLeft: tokens.space[3],
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border.hairline,
    paddingBottom: tokens.space[3],
    marginBottom: tokens.space[2],
  },
  headerCell: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navy,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    paddingHorizontal: tokens.space[2],
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: tokens.space[4],
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.color.border.hairline,
  },
  dataCell: {
    fontSize: tokens.typography.size.caption,
    color: tokens.color.text.primary,
    paddingHorizontal: tokens.space[2],
  },
  emptyState: {
    fontSize: tokens.typography.size.body,
    color: tokens.color.text.muted,
    paddingVertical: tokens.space[4],
    paddingHorizontal: tokens.space[2],
    fontStyle: "normal",
  },
});

export type CellAlign = "left" | "right" | "center";

export interface ColumnDef {
  header: string;
  /** flex weight, roughly equivalent to the old DataTable colWidths */
  width: number;
  align?: CellAlign;
}

export function CategoryTable({
  category,
  count,
  columns,
  rows,
  emptyText = "No records.",
}: {
  category?: string;
  count?: number;
  columns: ColumnDef[];
  rows: React.ReactNode[][];
  emptyText?: string;
}) {
  const totalFlex = columns.reduce((n, c) => n + c.width, 0);
  return (
    <View style={s.wrap}>
      {category && (
        <View style={s.categoryHeader}>
          <Text style={s.categoryTitle}>{category}</Text>
          {count !== undefined && <Text style={s.categoryCount}>({count})</Text>}
        </View>
      )}
      <View style={s.headerRow}>
        {columns.map((c, i) => (
          <Text
            key={i}
            style={[
              s.headerCell,
              {
                flex: c.width / totalFlex,
                textAlign: c.align ?? "left",
              },
            ]}
          >
            {c.header}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text style={s.emptyState}>{emptyText}</Text>
      ) : (
        rows.map((row, ri) => (
          <View key={ri} style={s.dataRow} wrap={false}>
            {row.map((cell, ci) => {
              const col = columns[ci]!;
              const isString = typeof cell === "string" || typeof cell === "number";
              return (
                <View
                  key={ci}
                  style={{
                    flex: col.width / totalFlex,
                    paddingHorizontal: tokens.space[2],
                    flexDirection: "row",
                    justifyContent:
                      col.align === "right"
                        ? "flex-end"
                        : col.align === "center"
                          ? "center"
                          : "flex-start",
                  }}
                >
                  {isString ? (
                    <Text style={[s.dataCell, { textAlign: col.align ?? "left" }]}>
                      {cell ?? "—"}
                    </Text>
                  ) : (
                    cell
                  )}
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

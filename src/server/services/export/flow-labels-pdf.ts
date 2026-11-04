// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The words on the PDF flow maps (ROPA and privacy-program report), in the
 * report's language: the asset type under each system's name, and the first
 * data category and the frequency on each flow.
 */
import { getTranslations } from "next-intl/server";
import { frequencyLabel } from "@/components/privacy/data-flow/flow-labels";

export interface PdfFlowLabels {
  typeLabel: (type: string) => string;
  edgeLabel: (categories: string[], frequency: string | null) => string | undefined;
}

export async function pdfFlowLabels(locale: string): Promise<PdfFlowLabels> {
  const [tEnum, tFreq] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.enum" }),
    getTranslations({ locale, namespace: "dataFlow.frequencyOptions" }),
  ]);
  const enumOr = (key: string, fallback: string) => (tEnum.has(key as never) ? tEnum(key as never) : fallback);
  return {
    typeLabel: (type) => enumOr(`assetType.${type}`, type.replace(/_/g, " ").toLowerCase()),
    edgeLabel: (categories, frequency) => {
      const first = categories[0];
      const cat = first ? enumOr(`dataCategory.${first}`, first) : null;
      const freq = frequencyLabel(frequency, (k) => tFreq(k as never));
      return [cat, freq].filter(Boolean).join(" · ") || undefined;
    },
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.security");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/security" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/security",
    },
  };
}

export default function SecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

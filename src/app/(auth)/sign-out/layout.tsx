// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NOINDEX } from "@/config/seo";

// The page is a client component, so its title in the reader's language is set here.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.pageTitles");
  // A step of signing in, not a page to find in search.
  return { title: t("signOut"), robots: NOINDEX };
}

export default function SignOutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

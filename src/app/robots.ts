// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = brand.appUrl;

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs/", "/security"],
        disallow: ["/privacy/", "/admin/", "/api/", "/onboarding/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { isDsarModuleEnabled } from "@/config/features";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = brand.appUrl;

  // No lastModified on any entry. Each page renders text from the shared
  // message catalogs (messages/en.json, messages/es.json), shared components
  // and config, so no single file's history gives the date the page's content
  // last changed, and hosted builds have no full git history to compute it.
  // A request or build timestamp would claim every page changed on every
  // fetch, so the field is left out: crawlers fall back to their own change
  // detection.

  return [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/docs`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/data-inventory`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Not listed when the rights-request module is off (src/config/features.ts).
    ...(isDsarModuleEnabled()
      ? [
          {
            url: `${baseUrl}/docs/dsar`,
                  changeFrequency: "monthly" as const,
            priority: 0.8,
          },
        ]
      : []),
    {
      url: `${baseUrl}/docs/assessments`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/incidents`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/vendors`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/security`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sign-in`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}

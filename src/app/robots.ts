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

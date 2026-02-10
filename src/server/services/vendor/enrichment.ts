import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";

// ============================================================
// Types
// ============================================================

export interface EnrichmentInput {
  vendorName: string;
  website?: string | null;
  trustCenterUrl?: string | null;
  privacyPolicyUrl?: string | null;
  dpaUrl?: string | null;
  securityPageUrl?: string | null;
  // Existing data (used for merge logic)
  existing?: {
    certifications?: string[];
    frameworks?: string[];
    gdprCompliant?: boolean | null;
    ccpaCompliant?: boolean | null;
    hipaaCompliant?: boolean | null;
    dataLocations?: string[];
    hasEuDataCenter?: boolean | null;
    subprocessors?: unknown;
    description?: string | null;
    trustCenterUrl?: string | null;
    privacyPolicyUrl?: string | null;
    dpaUrl?: string | null;
    securityPageUrl?: string | null;
  };
  overwriteExisting?: boolean;
}

export interface EnrichedFields {
  certifications?: string[];
  frameworks?: string[];
  gdprCompliant?: boolean | null;
  ccpaCompliant?: boolean | null;
  hipaaCompliant?: boolean | null;
  dataLocations?: string[];
  hasEuDataCenter?: boolean | null;
  subprocessors?: Array<{ name: string; purpose?: string; location?: string }>;
  description?: string;
  trustCenterUrl?: string;
  privacyPolicyUrl?: string;
  dpaUrl?: string;
  securityPageUrl?: string;
}

export interface EnrichmentResult {
  success: boolean;
  enrichedFields: EnrichedFields;
  discoveredUrls: Record<string, string>;
  pagesScraped: number;
  error?: string;
}

interface ScrapedPage {
  url: string;
  type: string;
  text: string;
}

// ============================================================
// Stage A — Probe well-known URLs
// ============================================================

async function probeUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function getDomain(websiteUrl: string): string {
  try {
    const url = new URL(websiteUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return websiteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

async function probeWellKnownUrls(
  domain: string
): Promise<Record<string, string>> {
  const candidates: Array<{ type: string; url: string }> = [
    { type: "trustCenter", url: `https://trust.${domain}` },
    { type: "trustCenter", url: `https://${domain}/trust` },
    { type: "trustCenter", url: `https://${domain}/security` },
    { type: "privacy", url: `https://${domain}/privacy` },
    { type: "privacy", url: `https://${domain}/privacy-policy` },
    { type: "dpa", url: `https://${domain}/legal/dpa` },
    { type: "dpa", url: `https://${domain}/dpa` },
    { type: "subprocessors", url: `https://${domain}/legal/sub-processors` },
    { type: "subprocessors", url: `https://${domain}/trust/sub-processors` },
    { type: "subprocessors", url: `https://${domain}/subprocessors` },
    { type: "security", url: `https://${domain}/.well-known/security.txt` },
  ];

  const results = await Promise.all(
    candidates.map(async (c) => ({
      ...c,
      reachable: await probeUrl(c.url),
    }))
  );

  const discovered: Record<string, string> = {};
  for (const r of results) {
    if (r.reachable && !discovered[r.type]) {
      discovered[r.type] = r.url;
    }
  }

  return discovered;
}

// ============================================================
// Stage B — Fetch & parse page content
// ============================================================

async function fetchPageContent(url: string): Promise<string> {
  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DPOCentral/1.0; +https://dpocentral.todo.law)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (!res.ok) return "";
    html = await res.text();
  } catch {
    return "";
  }

  // Parse with cheerio — strip non-content elements
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, iframe, svg").remove();
  $("[aria-hidden=true]").remove();

  const text = $("body").text().replace(/\s+/g, " ").trim();

  // If too little text, try Playwright (optional)
  if (text.length < 500) {
    const playwrightText = await tryPlaywrightFetch(url);
    if (playwrightText && playwrightText.length > text.length) {
      return playwrightText.slice(0, 15000);
    }
  }

  return text.slice(0, 15000);
}

async function tryPlaywrightFetch(url: string): Promise<string | null> {
  try {
    // Dynamic import — only works if playwright is installed in the environment
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pw = await (Function('return import("playwright")')() as Promise<{ chromium: { launch: (opts: { headless: boolean }) => Promise<{ newPage: () => Promise<{ goto: (url: string, opts: { waitUntil: string; timeout: number }) => Promise<void>; evaluate: (fn: () => string) => Promise<string> }>; close: () => Promise<void> }> } }>);
    const browser = await pw.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      const text = await page.evaluate(() => document.body.innerText);
      return text.replace(/\s+/g, " ").trim();
    } finally {
      await browser.close();
    }
  } catch {
    // Playwright not installed or failed — graceful fallback
    return null;
  }
}

// ============================================================
// Stage C — Extract structured data with Claude
// ============================================================

async function extractWithClaude(
  pages: ScrapedPage[],
  vendorName: string
): Promise<EnrichedFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment variables to use AI enrichment."
    );
  }

  const client = new Anthropic({ apiKey });

  const pagesText = pages
    .map((p) => `--- ${p.type.toUpperCase()} (${p.url}) ---\n${p.text}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a privacy compliance analyst. Extract structured vendor compliance information from the following scraped web pages for the vendor "${vendorName}".

Return ONLY valid JSON with these fields (use null for unknown values):

{
  "certifications": ["ISO 27001", "SOC 2 Type II", ...],
  "frameworks": ["GDPR", "CCPA", "HIPAA", ...],
  "gdprCompliant": true/false/null,
  "ccpaCompliant": true/false/null,
  "hipaaCompliant": true/false/null,
  "dataLocations": ["US", "EU", "UK", ...],
  "hasEuDataCenter": true/false/null,
  "subprocessors": [{"name": "...", "purpose": "...", "location": "..."}, ...],
  "description": "One-sentence description of what this vendor does"
}

Rules:
- Only include certifications/frameworks you are confident about from the text
- For compliance booleans, only set true if explicitly stated; use null if unclear
- Data locations should use region/country codes (US, EU, UK, DE, etc.)
- Subprocessors: extract name, purpose, and location if available. If a long list, include up to 20.
- Keep the description concise (one sentence, under 200 chars)
- Return ONLY the JSON object, no markdown fences or explanation

SCRAPED PAGES:
${pagesText}`,
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonText = textBlock.text.trim();

  // Strip markdown code fences if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonText);

  return {
    certifications: Array.isArray(parsed.certifications)
      ? parsed.certifications.filter((c: unknown) => typeof c === "string")
      : undefined,
    frameworks: Array.isArray(parsed.frameworks)
      ? parsed.frameworks.filter((f: unknown) => typeof f === "string")
      : undefined,
    gdprCompliant:
      typeof parsed.gdprCompliant === "boolean" ? parsed.gdprCompliant : undefined,
    ccpaCompliant:
      typeof parsed.ccpaCompliant === "boolean" ? parsed.ccpaCompliant : undefined,
    hipaaCompliant:
      typeof parsed.hipaaCompliant === "boolean" ? parsed.hipaaCompliant : undefined,
    dataLocations: Array.isArray(parsed.dataLocations)
      ? parsed.dataLocations.filter((d: unknown) => typeof d === "string")
      : undefined,
    hasEuDataCenter:
      typeof parsed.hasEuDataCenter === "boolean"
        ? parsed.hasEuDataCenter
        : undefined,
    subprocessors: Array.isArray(parsed.subprocessors)
      ? parsed.subprocessors
          .filter(
            (s: unknown) => typeof s === "object" && s !== null && "name" in s
          )
          .map((s: Record<string, unknown>) => ({
            name: String(s.name),
            purpose: s.purpose ? String(s.purpose) : undefined,
            location: s.location ? String(s.location) : undefined,
          }))
      : undefined,
    description:
      typeof parsed.description === "string" && parsed.description.length > 0
        ? parsed.description
        : undefined,
  };
}

// ============================================================
// Merge logic — only populate empty fields
// ============================================================

function mergeFields(
  enriched: EnrichedFields,
  existing: EnrichmentInput["existing"],
  overwrite: boolean
): EnrichedFields {
  if (overwrite || !existing) return enriched;

  const merged: EnrichedFields = {};

  if (
    enriched.certifications?.length &&
    (!existing.certifications || existing.certifications.length === 0)
  ) {
    merged.certifications = enriched.certifications;
  }

  if (
    enriched.frameworks?.length &&
    (!existing.frameworks || existing.frameworks.length === 0)
  ) {
    merged.frameworks = enriched.frameworks;
  }

  if (enriched.gdprCompliant !== undefined && existing.gdprCompliant == null) {
    merged.gdprCompliant = enriched.gdprCompliant;
  }

  if (enriched.ccpaCompliant !== undefined && existing.ccpaCompliant == null) {
    merged.ccpaCompliant = enriched.ccpaCompliant;
  }

  if (enriched.hipaaCompliant !== undefined && existing.hipaaCompliant == null) {
    merged.hipaaCompliant = enriched.hipaaCompliant;
  }

  if (
    enriched.dataLocations?.length &&
    (!existing.dataLocations || existing.dataLocations.length === 0)
  ) {
    merged.dataLocations = enriched.dataLocations;
  }

  if (enriched.hasEuDataCenter !== undefined && existing.hasEuDataCenter == null) {
    merged.hasEuDataCenter = enriched.hasEuDataCenter;
  }

  if (enriched.subprocessors?.length && !existing.subprocessors) {
    merged.subprocessors = enriched.subprocessors;
  }

  if (enriched.description && !existing.description) {
    merged.description = enriched.description;
  }

  return merged;
}

// ============================================================
// Main entry point
// ============================================================

export async function enrichVendor(
  input: EnrichmentInput
): Promise<EnrichmentResult> {
  try {
    const websiteUrl = input.website || input.trustCenterUrl;
    if (!websiteUrl) {
      return {
        success: false,
        enrichedFields: {},
        discoveredUrls: {},
        pagesScraped: 0,
        error: "Vendor has no website or trust center URL",
      };
    }

    const domain = getDomain(websiteUrl);

    // Stage A: Discover URLs
    const discoveredUrls = await probeWellKnownUrls(domain);

    // Merge explicit URLs from input
    if (input.trustCenterUrl) discoveredUrls.trustCenter = input.trustCenterUrl;
    if (input.privacyPolicyUrl) discoveredUrls.privacy = input.privacyPolicyUrl;
    if (input.dpaUrl) discoveredUrls.dpa = input.dpaUrl;
    if (input.securityPageUrl) discoveredUrls.security = input.securityPageUrl;

    // Stage B: Fetch page contents
    const urlsToScrape = Object.entries(discoveredUrls);
    if (urlsToScrape.length === 0) {
      // Fallback: scrape the main website
      urlsToScrape.push(["website", websiteUrl]);
    }

    const pages: ScrapedPage[] = [];
    const scrapeResults = await Promise.all(
      urlsToScrape.map(async ([type, url]) => {
        const text = await fetchPageContent(url);
        return { type, url, text };
      })
    );

    for (const result of scrapeResults) {
      if (result.text.length > 100) {
        pages.push(result);
      }
    }

    if (pages.length === 0) {
      return {
        success: false,
        enrichedFields: {},
        discoveredUrls,
        pagesScraped: 0,
        error: "Could not fetch any content from the vendor's pages",
      };
    }

    // Stage C: Extract with Claude
    const extracted = await extractWithClaude(pages, input.vendorName);

    // Also include discovered URLs as enriched fields
    const urlFields: EnrichedFields = {};
    if (discoveredUrls.trustCenter && !input.existing?.trustCenterUrl) {
      urlFields.trustCenterUrl = discoveredUrls.trustCenter;
    }
    if (discoveredUrls.privacy && !input.existing?.privacyPolicyUrl) {
      urlFields.privacyPolicyUrl = discoveredUrls.privacy;
    }
    if (discoveredUrls.dpa && !input.existing?.dpaUrl) {
      urlFields.dpaUrl = discoveredUrls.dpa;
    }
    if (discoveredUrls.security && !input.existing?.securityPageUrl) {
      urlFields.securityPageUrl = discoveredUrls.security;
    }

    // Merge: only populate empty fields (unless overwrite is set)
    const merged = mergeFields(
      { ...extracted, ...urlFields },
      input.existing,
      input.overwriteExisting ?? false
    );

    return {
      success: true,
      enrichedFields: merged,
      discoveredUrls,
      pagesScraped: pages.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown enrichment error";
    return {
      success: false,
      enrichedFields: {},
      discoveredUrls: {},
      pagesScraped: 0,
      error: message,
    };
  }
}

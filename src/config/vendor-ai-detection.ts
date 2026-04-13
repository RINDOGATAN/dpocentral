/**
 * Vendor AI Detection & Catalog-to-AISystem Mapping
 *
 * Detects AI-capable vendors from VendorCatalog AI fields and maps
 * catalog data to AISystem create payloads for auto-registration
 * during quickstart vendor import.
 */

import type { AIRiskLevel } from "@prisma/client";

// ============================================================
// TYPES
// ============================================================

export interface VendorCatalogAIFields {
  slug: string;
  name: string;
  category: string;
  subcategory?: string | null;
  aiCapabilities: string[];
  aiTechniques: string[];
  euAiActRole?: string | null;
  euAiActCompliant?: boolean | null;
  iso42001Certified?: boolean | null;
  aiModels?: unknown; // Json - [{name, type, source, euAiActRiskTier}]
  euAiActAnnexIIIDomains?: string[];
  tags?: string[];
}

export interface AISystemCreateData {
  name: string;
  description: string;
  purpose: string;
  riskLevel: AIRiskLevel;
  category: string;
  modelType: string | null;
  provider: string;
  vendorId: string;
  aiCapabilities: string[];
  aiTechniques: string[];
  euAiActRole: string | null;
  euAiActCompliant: boolean | null;
  iso42001Certified: boolean | null;
  aiModels: unknown;
  catalogSlug: string;
}

// ============================================================
// AI-RELATED CATEGORIES
// ============================================================

const AI_RELATED_CATEGORIES = new Set([
  "Artificial Intelligence",
  "Machine Learning",
  "AI Infrastructure",
  "AI/ML",
  "Natural Language Processing",
  "Computer Vision",
  "Generative AI",
  "AI Assistants",
  "AI Analytics",
  "AI Security",
  "Conversational AI",
]);

const AI_RELATED_TAGS = new Set([
  "ai", "ml", "machine-learning", "artificial-intelligence",
  "llm", "gpt", "nlp", "computer-vision", "generative-ai",
  "deep-learning", "neural-network",
]);

// ============================================================
// DETECTION
// ============================================================

/**
 * Determines if a vendor from the catalog is AI-capable based on its AI fields.
 */
export function isAiCapableVendor(catalog: VendorCatalogAIFields): boolean {
  if (catalog.aiCapabilities.length > 0) return true;
  if (catalog.aiModels != null) return true;
  if (catalog.euAiActRole != null) return true;
  if (catalog.aiTechniques.length > 0) return true;
  if (AI_RELATED_CATEGORIES.has(catalog.category)) return true;
  if (catalog.subcategory && AI_RELATED_CATEGORIES.has(catalog.subcategory)) return true;
  if (catalog.tags?.some((t) => typeof t === "string" && AI_RELATED_TAGS.has(t.toLowerCase()))) return true;
  return false;
}

// ============================================================
// RISK LEVEL DERIVATION
// ============================================================

const ANNEX_III_HIGH_RISK_DOMAINS = new Set([
  "biometric_identification",
  "critical_infrastructure",
  "education",
  "employment",
  "essential_services",
  "law_enforcement",
  "migration",
  "justice",
]);

function deriveRiskLevel(catalog: VendorCatalogAIFields): AIRiskLevel {
  // If the catalog has Annex III domain tags, it's HIGH_RISK
  if (catalog.euAiActAnnexIIIDomains && catalog.euAiActAnnexIIIDomains.length > 0) {
    for (const domain of catalog.euAiActAnnexIIIDomains) {
      if (typeof domain === "string" && ANNEX_III_HIGH_RISK_DOMAINS.has(domain.toLowerCase())) {
        return "HIGH_RISK";
      }
    }
  }

  // Check AI models for risk tier hints
  if (catalog.aiModels && Array.isArray(catalog.aiModels)) {
    for (const model of catalog.aiModels as Array<{ euAiActRiskTier?: string }>) {
      if (model.euAiActRiskTier === "HIGH_RISK" || model.euAiActRiskTier === "UNACCEPTABLE") {
        return model.euAiActRiskTier as AIRiskLevel;
      }
    }
  }

  // Check capabilities for high-risk signals
  const capsLower = catalog.aiCapabilities.map((c) => c.toLowerCase()).join(" ");
  if (
    capsLower.includes("biometric") ||
    capsLower.includes("recruitment") ||
    capsLower.includes("credit scoring") ||
    capsLower.includes("hiring")
  ) {
    return "HIGH_RISK";
  }

  // Chatbot / conversational → LIMITED
  if (
    capsLower.includes("chatbot") ||
    capsLower.includes("conversational") ||
    capsLower.includes("deepfake") ||
    capsLower.includes("content generation")
  ) {
    return "LIMITED";
  }

  return "MINIMAL";
}

// ============================================================
// MAPPING
// ============================================================

function deriveModelType(catalog: VendorCatalogAIFields): string | null {
  if (catalog.aiModels && Array.isArray(catalog.aiModels) && catalog.aiModels.length > 0) {
    const first = catalog.aiModels[0] as { type?: string };
    if (first.type) return first.type;
  }
  // Infer from techniques
  const techniques = catalog.aiTechniques.map((t) => t.toLowerCase());
  if (techniques.some((t) => t.includes("llm") || t.includes("language model"))) return "LLM";
  if (techniques.some((t) => t.includes("computer vision"))) return "Computer Vision";
  if (techniques.some((t) => t.includes("nlp"))) return "NLP";
  if (techniques.some((t) => t.includes("deep learning"))) return "Deep Learning";
  return null;
}

/**
 * Maps VendorCatalog AI fields to an AISystem create payload.
 * Returns null if the vendor is not AI-capable.
 */
export function buildAISystemFromCatalog(
  catalog: VendorCatalogAIFields,
  vendorId: string,
  vendorName: string,
): AISystemCreateData | null {
  if (!isAiCapableVendor(catalog)) return null;

  const riskLevel = deriveRiskLevel(catalog);
  const capsStr = catalog.aiCapabilities.length > 0
    ? catalog.aiCapabilities.slice(0, 3).join(", ")
    : "AI capabilities";

  return {
    name: `AI System — ${vendorName}`,
    description: `Auto-registered from vendor catalog import. ${vendorName} provides ${capsStr}.`,
    purpose: catalog.aiCapabilities.length > 0
      ? catalog.aiCapabilities.join("; ")
      : `AI-powered ${catalog.category} services`,
    riskLevel,
    category: catalog.subcategory ?? catalog.category,
    modelType: deriveModelType(catalog),
    provider: vendorName,
    vendorId,
    aiCapabilities: catalog.aiCapabilities,
    aiTechniques: catalog.aiTechniques,
    euAiActRole: catalog.euAiActRole ?? null,
    euAiActCompliant: catalog.euAiActCompliant ?? null,
    iso42001Certified: catalog.iso42001Certified ?? null,
    aiModels: catalog.aiModels ?? null,
    catalogSlug: catalog.slug,
  };
}

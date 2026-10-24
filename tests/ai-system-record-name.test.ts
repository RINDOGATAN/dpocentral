// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import {
  aiSystemRecordDescription,
  aiSystemRecordName,
  displayAiSystemDescription,
  displayAiSystemName,
} from "@/lib/record-name";
import {
  buildAISystemFromCatalog,
  displayAiSystemProvider,
  providerCompany,
} from "@/config/vendor-ai-detection";

const LONG_DASH = "—";

const aiVendor = {
  slug: "acme-ai",
  name: "Acme AI",
  category: "Artificial Intelligence",
  aiCapabilities: ["Text generation"],
  aiTechniques: ["LLM"],
};

describe("the name of an auto-registered AI system", () => {
  it("is written in the language of the import", () => {
    expect(aiSystemRecordName("Acme AI", "en")).toBe("AI System: Acme AI");
    expect(aiSystemRecordName("Acme AI", "es")).toBe("Sistema de IA: Acme AI");
    expect(
      buildAISystemFromCatalog(aiVendor, "v1", "Acme AI", "es")?.name,
    ).toBe("Sistema de IA: Acme AI");
    expect(buildAISystemFromCatalog(aiVendor, "v1", "Acme AI")?.name).toBe(
      "AI System: Acme AI",
    );
  });

  it("shows a stored English name in Spanish on a Spanish screen", () => {
    expect(displayAiSystemName("AI System: Acme AI", "es")).toBe(
      "Sistema de IA: Acme AI",
    );
    expect(displayAiSystemName(`AI System ${LONG_DASH} Acme AI`, "es")).toBe(
      "Sistema de IA: Acme AI",
    );
    expect(displayAiSystemName("AI System: Acme AI", "en")).toBe(
      "AI System: Acme AI",
    );
    expect(displayAiSystemName("Sistema de IA: Acme AI", "en")).toBe(
      "AI System: Acme AI",
    );
  });

  it("leaves a name typed by a person as stored", () => {
    expect(displayAiSystemName("Customer support chatbot", "es")).toBe(
      "Customer support chatbot",
    );
    expect(displayAiSystemName("AI System: ", "es")).toBe("AI System: ");
    expect(displayAiSystemName("AI Systems review", "es")).toBe(
      "AI Systems review",
    );
  });
});

describe("the description of an auto-registered AI system", () => {
  const EN =
    "Auto-registered from vendor catalog import. Acme AI provides Text generation.";
  const ES =
    "Registrado automáticamente al importar el proveedor del catálogo. Acme AI ofrece Text generation.";

  it("is written in the language of the import", () => {
    expect(
      buildAISystemFromCatalog(aiVendor, "v1", "Acme AI", "es")?.description,
    ).toBe(ES);
    expect(
      buildAISystemFromCatalog(aiVendor, "v1", "Acme AI")?.description,
    ).toBe(EN);
    expect(aiSystemRecordDescription("Acme AI", [], "es")).toBe(
      "Registrado automáticamente al importar el proveedor del catálogo. Acme AI ofrece capacidades de IA.",
    );
  });

  it("shows a stored description in the viewer's language", () => {
    expect(displayAiSystemDescription(EN, "es")).toBe(ES);
    expect(displayAiSystemDescription(ES, "en")).toBe(EN);
    expect(displayAiSystemDescription(EN, "en")).toBe(EN);
    expect(
      displayAiSystemDescription(
        aiSystemRecordDescription("Acme AI", [], "en"),
        "es",
      ),
    ).toBe(aiSystemRecordDescription("Acme AI", [], "es"));
  });

  it("leaves a description typed by a person as stored", () => {
    expect(displayAiSystemDescription("Chatbot for the help desk.", "es")).toBe(
      "Chatbot for the help desk.",
    );
  });
});

describe("the provider of an auto-registered AI system", () => {
  it("is the company behind the product when the catalogue gives a legal name", () => {
    const vendor = {
      ...aiVendor,
      legalName: "Acme Corporation (EU customers: Acme Ireland Limited)",
    };
    expect(providerCompany(vendor.legalName)).toBe("Acme Corporation");
    expect(buildAISystemFromCatalog(vendor, "v1", "Acme AI")?.provider).toBe(
      "Acme Corporation",
    );
  });

  it("falls back to the product name when the catalogue gives none", () => {
    expect(providerCompany(null)).toBeNull();
    expect(buildAISystemFromCatalog(aiVendor, "v1", "Acme AI")?.provider).toBe(
      "Acme AI",
    );
  });

  it("is shown as the company for records that stored the product name", () => {
    expect(
      displayAiSystemProvider("acme ai", "Acme AI", "Acme Corporation"),
    ).toBe("Acme Corporation");
    expect(
      displayAiSystemProvider(
        "Someone Else Ltd",
        "Acme AI",
        "Acme Corporation",
      ),
    ).toBe("Someone Else Ltd");
    expect(displayAiSystemProvider("Acme AI", "Acme AI", null)).toBe("Acme AI");
  });
});

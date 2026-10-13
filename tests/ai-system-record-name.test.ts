// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { aiSystemRecordName, displayAiSystemName } from "@/lib/record-name";
import { buildAISystemFromCatalog } from "@/config/vendor-ai-detection";

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
    expect(buildAISystemFromCatalog(aiVendor, "v1", "Acme AI", "es")?.name).toBe("Sistema de IA: Acme AI");
    expect(buildAISystemFromCatalog(aiVendor, "v1", "Acme AI")?.name).toBe("AI System: Acme AI");
  });

  it("shows a stored English name in Spanish on a Spanish screen", () => {
    expect(displayAiSystemName("AI System: Acme AI", "es")).toBe("Sistema de IA: Acme AI");
    expect(displayAiSystemName(`AI System ${LONG_DASH} Acme AI`, "es")).toBe("Sistema de IA: Acme AI");
    expect(displayAiSystemName("AI System: Acme AI", "en")).toBe("AI System: Acme AI");
    expect(displayAiSystemName("Sistema de IA: Acme AI", "en")).toBe("AI System: Acme AI");
  });

  it("leaves a name typed by a person as stored", () => {
    expect(displayAiSystemName("Customer support chatbot", "es")).toBe("Customer support chatbot");
    expect(displayAiSystemName("AI System: ", "es")).toBe("AI System: ");
    expect(displayAiSystemName("AI Systems review", "es")).toBe("AI Systems review");
  });
});

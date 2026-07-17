/**
 * LLM Door unit tests — provider selection, env trimming, reasoning-block
 * stripping. Pure: no network, no DB (getProvider/stripReasoning never call
 * fetch; chatComplete is exercised only for the unconfigured no-op path,
 * with fetch stubbed to fail loudly if it were ever reached).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  getProvider,
  isAIConfigured,
  getAIProviderName,
  stripReasoning,
  chatComplete,
} from "@/server/services/ai/llm-door";

const AI_ENV_KEYS = [
  "LLM_GATEWAY_URL",
  "LLM_GATEWAY_KEY",
  "LLM_MODEL_ALIAS",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  // Lane-suffixed engine triples (posture-routed lanes)
  "LLM_GATEWAY_URL_LOCAL",
  "LLM_GATEWAY_KEY_LOCAL",
  "LLM_MODEL_ALIAS_LOCAL",
  "LLM_GATEWAY_URL_EU",
  "LLM_GATEWAY_KEY_EU",
  "LLM_MODEL_ALIAS_EU",
  "LLM_GATEWAY_URL_US",
  "LLM_GATEWAY_KEY_US",
  "LLM_MODEL_ALIAS_US",
] as const;

beforeEach(() => {
  for (const key of AI_ENV_KEYS) vi.stubEnv(key, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getProvider / isAIConfigured", () => {
  it("returns null when nothing is configured", () => {
    expect(getProvider()).toBeNull();
    expect(isAIConfigured()).toBe(false);
    expect(getAIProviderName()).toBeNull();
  });

  it("prefers the gateway when URL + model alias are set", () => {
    vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
    vi.stubEnv("LLM_MODEL_ALIAS", "qwen2.5:7b-instruct");
    vi.stubEnv("OPENAI_API_KEY", "sk-openai");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(getProvider()).toBe("gateway");
    expect(getAIProviderName()).toBe("LLM gateway (qwen2.5:7b-instruct)");
  });

  it("does NOT pick the gateway without a model alias", () => {
    vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
    expect(getProvider()).toBeNull();
  });

  it("falls back to OpenAI, then Anthropic", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(getProvider()).toBe("openai");
    expect(getAIProviderName()).toBe("OpenAI");

    vi.stubEnv("OPENAI_API_KEY", "");
    expect(getProvider()).toBe("anthropic");
    expect(getAIProviderName()).toBe("Anthropic");
  });

  it("trims env values — whitespace-only means unset", () => {
    vi.stubEnv("OPENAI_API_KEY", "   ");
    expect(getProvider()).toBeNull();

    vi.stubEnv("LLM_GATEWAY_URL", "  http://ollama:11434  ");
    vi.stubEnv("LLM_MODEL_ALIAS", "  llama3  \n");
    expect(getProvider()).toBe("gateway");
    // Trimmed alias shows up clean in the display name
    expect(getAIProviderName()).toBe("LLM gateway (llama3)");
  });
});

describe("posture-routed lanes", () => {
  it("the base (unsuffixed) triple answers a lane with no suffixed variables", () => {
    vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
    vi.stubEnv("LLM_MODEL_ALIAS", "qwen2.5:7b-instruct");

    for (const lane of ["local_gateway", "cloud_eu", "cloud_us"] as const) {
      expect(getProvider(lane)).toBe("gateway");
      expect(isAIConfigured(lane)).toBe(true);
      expect(getAIProviderName(lane)).toBe("LLM gateway (qwen2.5:7b-instruct)");
    }
  });

  it("suffixed lane variables beat the base triple — only for their lane", () => {
    vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
    vi.stubEnv("LLM_MODEL_ALIAS", "qwen2.5:7b-instruct");
    vi.stubEnv("LLM_GATEWAY_URL_EU", "https://eu-gateway.example");
    vi.stubEnv("LLM_MODEL_ALIAS_EU", "mistral-large-eu");

    expect(getAIProviderName("cloud_eu")).toBe("LLM gateway (mistral-large-eu)");
    // Other lanes (and the no-lane default) still see the base engine
    expect(getAIProviderName("cloud_us")).toBe("LLM gateway (qwen2.5:7b-instruct)");
    expect(getAIProviderName("local_gateway")).toBe("LLM gateway (qwen2.5:7b-instruct)");
    expect(getAIProviderName()).toBe("LLM gateway (qwen2.5:7b-instruct)");
  });

  it("falls back per VARIABLE: a suffixed URL can pair with the base alias", () => {
    vi.stubEnv("LLM_GATEWAY_URL", "http://ollama:11434");
    vi.stubEnv("LLM_MODEL_ALIAS", "qwen2.5:7b-instruct");
    vi.stubEnv("LLM_GATEWAY_URL_US", "https://us-gateway.example");

    expect(getProvider("cloud_us")).toBe("gateway");
    expect(getAIProviderName("cloud_us")).toBe("LLM gateway (qwen2.5:7b-instruct)");
  });

  it("a lane-only install configures ONLY that lane (no base fallback for others)", () => {
    vi.stubEnv("LLM_GATEWAY_URL_LOCAL", "http://ollama:11434");
    vi.stubEnv("LLM_MODEL_ALIAS_LOCAL", "llama3");

    expect(isAIConfigured("local_gateway")).toBe(true);
    expect(getAIProviderName("local_gateway")).toBe("LLM gateway (llama3)");
    // No base engine and no other suffixed engines
    expect(isAIConfigured()).toBe(false);
    expect(isAIConfigured("cloud_eu")).toBe(false);
    expect(isAIConfigured("cloud_us")).toBe(false);
  });
});

describe("stripReasoning", () => {
  it("removes a closed <think> block and trims", () => {
    expect(stripReasoning("<think>step 1\nstep 2</think>\n\nThe answer.")).toBe(
      "The answer."
    );
  });

  it("removes <thinking> blocks and multiple blocks", () => {
    expect(
      stripReasoning("<thinking>a</thinking>Hello <think>b</think>world")
    ).toBe("Hello world");
  });

  it("drops an unclosed reasoning block that opens at the start", () => {
    expect(stripReasoning("<think>truncated reasoning that never closes")).toBe("");
  });

  it("leaves plain text untouched (apart from trimming)", () => {
    expect(stripReasoning("  Plain narrative.  ")).toBe("Plain narrative.");
  });

  it("is case-insensitive", () => {
    expect(stripReasoning("<THINK>x</THINK>ok")).toBe("ok");
  });
});

describe("chatComplete no-op path", () => {
  it("returns null with zero fetches when nothing is configured", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network call attempted — door not gated"));

    const result = await chatComplete({ system: "s", user: "u" });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

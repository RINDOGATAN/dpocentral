// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The LLM Door — CANONICAL COPY (authored in DPO Central).
 *
 * The suite's single point of contact with any LLM. Ported byte-identically
 * to the sibling apps (Dealroom, AI Sentinel) with this header intact — the
 * same porting doctrine as license-crypto. Evolve it HERE first.
 *
 * Provider selection (all env values are trimmed; blank = unset):
 *   1. LLM_GATEWAY_URL + LLM_MODEL_ALIAS  -> any OpenAI-compatible gateway
 *      (LiteLLM, LQ.AI, Ollama, Groq/Scaleway OpenAI endpoints, ...);
 *      LLM_GATEWAY_KEY optional (local Ollama needs none).
 *   2. ANTHROPIC_API_KEY                  -> api.anthropic.com
 *   3. nothing configured                 -> graceful null, zero network.
 * (A direct OPENAI_API_KEY path existed until 11 Oct 2026; it was removed
 * because no deployment set it and the provider was listed nowhere. An
 * OpenAI endpoint can still be reached through the gateway, option 1.)
 *
 * Organisation keys: a caller may pass `engine`, an organisation's own API
 * inference key resolved by services/ai/org-key.ts (Anthropic, or any
 * OpenAI-compatible base address). It takes precedence over the deployment
 * engines above. Where AI_REQUIRE_ORG_KEY is in force (services/ai/
 * deployment.ts: the default on the shared hosted service) the deployment
 * engines are never used: without `engine` there is no provider and the
 * call is a clean null.
 *
 * Structured output: with `json` (a name and a JSON Schema) the door asks
 * for that shape (Anthropic: one forced tool; OpenAI-compatible:
 * response_format json_schema, retried once without it when the endpoint
 * refuses the field) and returns the JSON text. Callers still validate it.
 *
 * Posture-routed lanes (optional): a deployment may configure DIFFERENT
 * gateway engines per confidentiality lane with suffixed variables —
 * LLM_GATEWAY_URL_EU / LLM_GATEWAY_KEY_EU / LLM_MODEL_ALIAS_EU (cloud_eu),
 * the _US triple (cloud_us) and the _LOCAL triple (local_gateway). When a
 * lane-specific variable is absent, the base (unsuffixed) triple answers —
 * so single-engine installs behave exactly as before. The caller passes the
 * organization's acknowledged posture as the lane, which makes the recorded
 * posture and the physical traffic lane the same fact.
 *
 * HARD RULE: this module is the ONLY file in the codebase allowed to make
 * an outbound AI call (`fetch`). Callers must gate on the per-organization
 * posture (services/ai/posture.ts requireAi) BEFORE building prompts or
 * calling chatComplete. No additional packages; native fetch only.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { logger } from "@/lib/logger";
import { orgKeyRequired } from "./deployment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiProvider = "gateway" | "anthropic";

/** Confidentiality lanes a posture can route to (mirrors AiPosture minus "off"). */
export type AiLane = "local_gateway" | "cloud_eu" | "cloud_us";

const LANE_SUFFIX: Record<AiLane, string> = {
  local_gateway: "_LOCAL",
  cloud_eu: "_EU",
  cloud_us: "_US",
};

export interface ChatUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface ChatResult {
  /** Assistant text with any <think>/<thinking> reasoning blocks stripped. */
  content: string;
  /** Model that actually answered (as reported by the provider when available). */
  model: string;
  usage: ChatUsage | null;
  durationMs: number;
}

/** An engine given by the caller (an organisation's own key), not by the environment. */
export interface DirectEngine {
  kind: "anthropic" | "openai_compatible";
  /** OpenAI-compatible only: the base address up to and including /v1 (no trailing slash). */
  baseUrl: string | null;
  apiKey: string;
  model: string;
  /** For display: provider and model. Never the key. */
  label: string;
}

/** A JSON Schema the answer must follow (structured output). */
export interface JsonShape {
  name: string;
  schema: Record<string, unknown>;
}

export interface ChatParams {
  system: string;
  user: string;
  /** Clamped to 4096. Default 2500 (reasoning models spend tokens thinking). */
  maxTokens?: number;
  /** Default 0.3. */
  temperature?: number;
  /** The organization's acknowledged posture; routes to that lane's engine. */
  lane?: AiLane;
  /** The organisation's own engine; takes precedence over the deployment's. */
  engine?: DirectEngine | null;
  /** Ask for JSON of this shape; the answer's content is that JSON as text. */
  json?: JsonShape;
}

type ResolvedChatParams = Required<Omit<ChatParams, "lane" | "engine" | "json">> & { json?: JsonShape };

const MAX_TOKENS_CEILING = 4096;
const DEFAULT_MAX_TOKENS = 2500;
const DEFAULT_TEMPERATURE = 0.3;

// ---------------------------------------------------------------------------
// Configuration (read at call time so posture changes and tests see fresh env)
// ---------------------------------------------------------------------------

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Lane-aware gateway variable: the lane-suffixed value, else the base one. */
function laneEnv(base: string, lane?: AiLane): string | undefined {
  if (lane) {
    const suffixed = env(base + LANE_SUFFIX[lane]);
    if (suffixed) return suffixed;
  }
  return env(base);
}

/**
 * Which deployment provider would answer (for the given lane), or null when
 * nothing is configured or the deployment's engines may not be used
 * (AI_REQUIRE_ORG_KEY in force).
 */
export function getProvider(lane?: AiLane): AiProvider | null {
  if (orgKeyRequired()) return null;
  if (laneEnv("LLM_GATEWAY_URL", lane) && laneEnv("LLM_MODEL_ALIAS", lane)) return "gateway";
  if (env("ANTHROPIC_API_KEY")) return "anthropic";
  return null;
}

/** True when an AI engine is configured for the lane (posture is checked elsewhere). */
export function isAIConfigured(lane?: AiLane): boolean {
  return getProvider(lane) !== null;
}

/** Human-readable provider name for display in UI. */
export function getAIProviderName(lane?: AiLane): string | null {
  const provider = getProvider(lane);
  if (provider === "gateway") return `LLM gateway (${laneEnv("LLM_MODEL_ALIAS", lane)})`;
  if (provider === "anthropic") return "Anthropic";
  return null;
}

// ---------------------------------------------------------------------------
// Reasoning-block stripping (deepseek-r1 and friends emit <think>…</think>)
// ---------------------------------------------------------------------------

/**
 * Remove chain-of-thought blocks a reasoning model may prepend to its
 * answer. Handles closed <think>/<thinking> blocks anywhere in the text and
 * an unclosed block that opens at the start (truncated reasoning).
 */
export function stripReasoning(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  // Unclosed reasoning block at the start: nothing useful survived it.
  out = out.replace(/^\s*<think(?:ing)?>[\s\S]*$/gi, "");
  return out.trim();
}

// ---------------------------------------------------------------------------
// Provider calls (OpenAI-compatible + Anthropic) — the only fetch sites
// ---------------------------------------------------------------------------

interface OpenAIChatResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

async function callOpenAICompatible(
  url: string,
  apiKey: string | undefined,
  model: string,
  params: ResolvedChatParams,
  label: string
): Promise<{ content: string; model: string; usage: ChatUsage | null } | null> {
  const send = (withSchema: boolean) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        ...(withSchema && params.json
          ? { response_format: { type: "json_schema", json_schema: { name: params.json.name, schema: params.json.schema, strict: false } } }
          : {}),
      }),
    });

  let response = await send(true);
  // Some OpenAI-compatible endpoints refuse response_format: ask once more
  // without it (the prompt still asks for JSON; the caller validates).
  if (params.json && response.status === 400) response = await send(false);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    logger.error(`${label} call failed`, undefined, {
      status: response.status,
      error: errorText.slice(0, 500),
    });
    return null;
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  return {
    content,
    model: data.model || model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? null,
          completionTokens: data.usage.completion_tokens ?? null,
          totalTokens: data.usage.total_tokens ?? null,
        }
      : null,
  };
}

interface AnthropicResponse {
  model?: string;
  content?: { type: string; text?: string; input?: unknown }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-20250514";

async function callAnthropic(
  apiKey: string,
  params: ResolvedChatParams,
  model: string = ANTHROPIC_DEFAULT_MODEL
): Promise<{ content: string; model: string; usage: ChatUsage | null } | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      // Structured output: one tool whose input is the requested shape, forced.
      ...(params.json
        ? {
            tools: [{ name: params.json.name, description: "Return the answer in this shape.", input_schema: params.json.schema }],
            tool_choice: { type: "tool", name: params.json.name },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    logger.error("Anthropic API call failed", undefined, {
      status: response.status,
      error: errorText.slice(0, 500),
    });
    return null;
  }

  const data = (await response.json()) as AnthropicResponse;
  const toolBlock = params.json ? data.content?.find((b) => b.type === "tool_use") : undefined;
  const textBlock = toolBlock
    ? { text: JSON.stringify(toolBlock.input ?? null) }
    : data.content?.find((b) => b.type === "text");
  if (!textBlock?.text) return null;

  const input = data.usage?.input_tokens ?? null;
  const output = data.usage?.output_tokens ?? null;
  return {
    content: textBlock.text,
    model: data.model || model,
    usage:
      input !== null || output !== null
        ? {
            promptTokens: input,
            completionTokens: output,
            totalTokens: input !== null && output !== null ? input + output : null,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * One chat completion through the configured engine.
 *
 * Returns null when no engine is configured, the call fails, or the answer
 * is empty — callers must always treat AI as optional. Never throws for
 * provider errors (they are logged without prompt/output text).
 */
export async function chatComplete(params: ChatParams): Promise<ChatResult | null> {
  const engine = params.engine ?? null;
  const provider = engine ? "organization" : getProvider(params.lane);
  if (!provider) return null;

  const resolved: ResolvedChatParams = {
    system: params.system,
    user: params.user,
    maxTokens: Math.min(Math.max(1, params.maxTokens ?? DEFAULT_MAX_TOKENS), MAX_TOKENS_CEILING),
    temperature: params.temperature ?? DEFAULT_TEMPERATURE,
    json: params.json,
  };

  const startedAt = Date.now();
  try {
    let raw: { content: string; model: string; usage: ChatUsage | null } | null = null;

    if (engine) {
      raw =
        engine.kind === "anthropic"
          ? await callAnthropic(engine.apiKey, resolved, engine.model)
          : await callOpenAICompatible(
              `${(engine.baseUrl ?? "").replace(/\/+$/, "")}/chat/completions`,
              engine.apiKey,
              engine.model,
              resolved,
              "Organization engine"
            );
    } else if (provider === "gateway") {
      const base = laneEnv("LLM_GATEWAY_URL", params.lane)!.replace(/\/+$/, "");
      raw = await callOpenAICompatible(
        `${base}/v1/chat/completions`,
        laneEnv("LLM_GATEWAY_KEY", params.lane),
        laneEnv("LLM_MODEL_ALIAS", params.lane)!,
        resolved,
        "LLM gateway"
      );
    } else {
      raw = await callAnthropic(env("ANTHROPIC_API_KEY")!, resolved);
    }

    if (!raw) return null;

    const content = stripReasoning(raw.content);
    if (!content) return null;

    return {
      content,
      model: raw.model,
      usage: raw.usage,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    logger.error("LLM call threw", undefined, {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

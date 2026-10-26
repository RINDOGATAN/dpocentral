// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * An organisation's own API inference key.
 *
 * Two deployment modes, chosen by AI_REQUIRE_ORG_KEY (./deployment.ts):
 * only the organisation's own key (the default on the shared hosted service,
 * which then never uses its own credentials for a customer's account), or
 * the deployment's engines with an optional organisation key that takes
 * precedence (the default everywhere else).
 *
 * The key is encrypted at rest with AES-256-GCM. The 256-bit key is derived
 * with HKDF-SHA256 from the deployment's existing session secret
 * (NEXTAUTH_SECRET, else AUTH_SECRET) under a label of its own, and the
 * organisation id is bound in as associated data, so a ciphertext copied to
 * another organisation does not decrypt. Rotating the session secret makes
 * saved keys unreadable: AI then reports "not configured" until an owner or
 * administrator saves the key again. The key never leaves the server once
 * saved: status reads give the provider, the model and the last four
 * characters only.
 *
 * Providers mirror the bring-your-own-key choice of the sibling contract app:
 * Anthropic, OpenAI, Groq, Mistral, Together AI, plus any OpenAI-compatible
 * endpoint with its own base address.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { isIP } from "net";
import { orgKeyRequired } from "./deployment";
import { ANTHROPIC_DEFAULT_MODEL, type DirectEngine } from "./llm-door";

export { orgKeyRequired };

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const ORG_AI_PROVIDERS = {
  anthropic: { kind: "anthropic", label: "Anthropic", baseUrl: null, defaultModel: ANTHROPIC_DEFAULT_MODEL, keyPrefix: "sk-ant-" },
  openai: { kind: "openai_compatible", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o", keyPrefix: "sk-" },
  groq: { kind: "openai_compatible", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", keyPrefix: "gsk_" },
  mistral: { kind: "openai_compatible", label: "Mistral", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest", keyPrefix: "" },
  together: { kind: "openai_compatible", label: "Together AI", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", keyPrefix: "" },
  openai_compatible: { kind: "openai_compatible", label: "OpenAI-compatible endpoint", baseUrl: null, defaultModel: null, keyPrefix: "" },
} as const;

export type OrgAiProvider = keyof typeof ORG_AI_PROVIDERS;
export const ORG_AI_PROVIDER_IDS = Object.keys(ORG_AI_PROVIDERS) as OrgAiProvider[];

export function isOrgAiProvider(value: unknown): value is OrgAiProvider {
  return typeof value === "string" && value in ORG_AI_PROVIDERS;
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HKDF_INFO = "dpocentral/org-ai-inference-key/v1";

export class OrgKeySecretMissingError extends Error {
  constructor() {
    super("NEXTAUTH_SECRET (or AUTH_SECRET) is required to store an API inference key.");
  }
}

function encryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) throw new OrgKeySecretMissingError();
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), Buffer.from(HKDF_INFO, "utf8"), 32));
}

/** Encrypt a key for one organisation: base64 ciphertext (with the tag appended) and base64 iv. */
export function encryptOrgKey(plaintext: string, organizationId: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(Buffer.from(organizationId, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext: body.toString("base64"), iv: iv.toString("base64") };
}

/** Decrypt a saved key; null when it cannot be read (other organisation, changed secret, damaged). */
export function decryptOrgKey(ciphertext: string, iv: string, organizationId: string): string | null {
  try {
    const body = Buffer.from(ciphertext, "base64");
    if (body.length <= TAG_LENGTH) return null;
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64"), { authTagLength: TAG_LENGTH });
    decipher.setAAD(Buffer.from(organizationId, "utf8"));
    decipher.setAuthTag(body.subarray(body.length - TAG_LENGTH));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_LENGTH)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** The last four characters, the only part of a key ever shown again. */
export function keyLast4(key: string): string {
  return key.slice(-4);
}

// ---------------------------------------------------------------------------
// Validation of what an administrator saves
// ---------------------------------------------------------------------------

export type OrgKeyProblem =
  | "key_format"
  | "key_prefix"
  | "base_url_required"
  | "base_url_invalid"
  | "base_url_not_allowed"
  | "model_required"
  | "model_invalid";

export class OrgKeyInputError extends Error {
  constructor(public readonly problem: OrgKeyProblem) {
    super(problem);
  }
}

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;

function privateAddress(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(h) === 4) {
    const [a, b] = h.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (isIP(h) === 6) return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  return PRIVATE_HOST.test(h);
}

/**
 * The base address of an OpenAI-compatible endpoint, normalised (no
 * trailing slash). Where only organisation keys are used (the shared hosted
 * service) the address must be public HTTPS: no plain HTTP, no loopback,
 * private or link-local address, no internal host names.
 */
export function checkBaseUrl(raw: string, strict = orgKeyRequired()): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new OrgKeyInputError("base_url_invalid");
  }
  if (url.username || url.password || url.search || url.hash) throw new OrgKeyInputError("base_url_invalid");
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new OrgKeyInputError("base_url_invalid");
  if (strict && (url.protocol !== "https:" || privateAddress(url.hostname))) throw new OrgKeyInputError("base_url_not_allowed");
  return url.toString().replace(/\/+$/, "");
}

const MODEL_ID = /^[A-Za-z0-9][\w.\-:/@]{0,199}$/;

export interface OrgKeyInput {
  provider: OrgAiProvider;
  apiKey: string;
  baseUrl?: string | null;
  model?: string | null;
}

export interface CheckedOrgKey {
  provider: OrgAiProvider;
  apiKey: string;
  baseUrl: string | null;
  model: string | null;
}

/** Check what an administrator typed; throws OrgKeyInputError with a machine code. */
export function checkOrgKeyInput(input: OrgKeyInput, strict = orgKeyRequired()): CheckedOrgKey {
  const def = ORG_AI_PROVIDERS[input.provider];
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey)) throw new OrgKeyInputError("key_format");
  if (def.keyPrefix && !apiKey.startsWith(def.keyPrefix)) throw new OrgKeyInputError("key_prefix");

  const model = input.model?.trim() || null;
  if (model && !MODEL_ID.test(model)) throw new OrgKeyInputError("model_invalid");

  let baseUrl: string | null = null;
  if (input.provider === "openai_compatible") {
    if (!input.baseUrl?.trim()) throw new OrgKeyInputError("base_url_required");
    baseUrl = checkBaseUrl(input.baseUrl, strict);
    if (!model) throw new OrgKeyInputError("model_required");
  }
  return { provider: input.provider, apiKey, baseUrl, model };
}

// ---------------------------------------------------------------------------
// From the saved row to an engine the door can call
// ---------------------------------------------------------------------------

export interface SavedOrgKey {
  organizationId: string;
  keyProvider: string | null;
  keyBaseUrl: string | null;
  keyModel: string | null;
  keyCiphertext: string | null;
  keyIv: string | null;
}

export type OrgKeyState = "none" | "unreadable" | "ready";

/** Whether a saved key exists and can be read, and the engine it gives. */
export function resolveOrgEngine(row: SavedOrgKey | null | undefined): { state: OrgKeyState; engine: DirectEngine | null } {
  if (!row?.keyCiphertext || !row.keyIv || !isOrgAiProvider(row.keyProvider)) return { state: "none", engine: null };
  const apiKey = decryptOrgKey(row.keyCiphertext, row.keyIv, row.organizationId);
  if (!apiKey) return { state: "unreadable", engine: null };
  const def = ORG_AI_PROVIDERS[row.keyProvider];
  const model = row.keyModel || def.defaultModel;
  const baseUrl = def.kind === "openai_compatible" ? row.keyBaseUrl || def.baseUrl : null;
  if (!model || (def.kind === "openai_compatible" && !baseUrl)) return { state: "unreadable", engine: null };
  // A saved address is checked again at use, under the mode in force now.
  if (row.keyProvider === "openai_compatible" && baseUrl) {
    try {
      checkBaseUrl(baseUrl);
    } catch {
      return { state: "unreadable", engine: null };
    }
  }
  return {
    state: "ready",
    engine: { kind: def.kind, baseUrl, apiKey, model, label: `${def.label} (${model})` },
  };
}

/** Where an owner or administrator adds the key. */
export const ORG_KEY_SETTINGS_PATH = "/privacy/settings#ai-inference-key";

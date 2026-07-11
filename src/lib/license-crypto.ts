// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Ed25519 licence-file verification for premium skills.
 *
 * The TODO.LAW storefront signs licence files with a single Ed25519 keypair
 * shared by every app in the family (Dealroom, DPO Central, ...). The licence
 * JSON shape and the canonical signing serialization below MUST stay
 * byte-for-byte identical to the reference implementation in Dealroom's
 * src/lib/crypto.ts — a licence signed for one app must verify in all of them.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "crypto";
import { logger } from "@/lib/logger";

// PEM (SPKI) Ed25519 public key of the storefront signing keypair. The
// placeholder guarantees verification fails (never crashes) until the real
// key is configured. Read lazily so tests and late-injected env both work.
function getPublicKeyPem(): string {
  return (
    process.env.SKILL_SIGNING_PUBLIC_KEY ||
    `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA7VIhH/9tFV23rRAWcQiGalDtND9AkWCJrdKxBfxF3dU=
-----END PUBLIC KEY-----`
  );
}

/**
 * Sign data with an Ed25519 private key (PEM, PKCS8).
 * Used by licence tooling and tests — not by the web app at runtime.
 */
export function signEd25519(data: Buffer, privateKeyPem: string): Buffer {
  const privateKey = createPrivateKey({
    key: privateKeyPem,
    format: "pem",
    type: "pkcs8",
  });
  return sign(null, data, privateKey);
}

/**
 * Generate an Ed25519 key pair (PEM-encoded). Tooling/tests only.
 */
export function generateEd25519KeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

/**
 * Verify an Ed25519 signature against data. Any failure (bad key, bad
 * signature encoding) returns false rather than throwing.
 */
export function verifyEd25519Signature(
  data: Buffer,
  signature: Buffer,
  publicKeyPem?: string
): boolean {
  try {
    const publicKey = createPublicKey({
      key: publicKeyPem || getPublicKeyPem(),
      format: "pem",
      type: "spki",
    });
    return verify(null, data, publicKey, signature);
  } catch (error) {
    logger.error("Licence signature verification failed", error);
    return false;
  }
}

/** Compute SHA-256 hash of data (hex). */
export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Validate storefront licence key format: LIC-XXXX-XXXX-XXXX-XXXX. */
export function isValidLicenseKeyFormat(key: string): boolean {
  return /^LIC-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(key);
}

/**
 * Machine fingerprint from hostname and MAC address, for activation tracking.
 */
export function computeMachineFingerprint(
  hostname: string,
  macAddress: string
): string {
  const combined = `${hostname.toLowerCase()}:${macAddress.toLowerCase().replace(/[:-]/g, "")}`;
  return sha256(combined);
}

/**
 * Offline licence file issued by the TODO.LAW storefront.
 *
 * `customerId` carries the BUYER'S EMAIL — the only identifier shared between
 * the storefront and the apps. `expiresAt` is ABSENT (not null) on perpetual
 * licences: JSON.stringify drops undefined keys, so presence changes the
 * signed bytes.
 */
export interface LicenseFile {
  licenseKey: string;
  customerId: string;
  customerName: string;
  skillId: string;
  jurisdictions: string[];
  licenseType: "TRIAL" | "SUBSCRIPTION" | "PERPETUAL";
  maxActivations: number;
  issuedAt: string;
  expiresAt?: string;
  signature: string; // Ed25519 signature of the above fields, base64
}

/**
 * Canonical signing payload: every field except `signature`, serialized in
 * this exact key order. Shared by verify (here) and sign (storefront/tests).
 */
export function canonicalLicensePayload(
  license: Omit<LicenseFile, "signature">
): Buffer {
  const licenseData = JSON.stringify({
    licenseKey: license.licenseKey,
    customerId: license.customerId,
    customerName: license.customerName,
    skillId: license.skillId,
    jurisdictions: license.jurisdictions,
    licenseType: license.licenseType,
    maxActivations: license.maxActivations,
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
  });
  return Buffer.from(licenseData, "utf-8");
}

/**
 * Verify the signature on an offline licence file.
 */
export function verifyLicenseFile(
  license: LicenseFile,
  publicKeyPem?: string
): boolean {
  try {
    const signature = Buffer.from(license.signature, "base64");
    return verifyEd25519Signature(
      canonicalLicensePayload(license),
      signature,
      publicKeyPem
    );
  } catch (error) {
    logger.error("Licence file verification failed", error);
    return false;
  }
}

/**
 * Check if a licence file is expired. No expiresAt = perpetual.
 */
export function isLicenseExpired(license: LicenseFile): boolean {
  if (!license.expiresAt) {
    return false;
  }
  return new Date(license.expiresAt) < new Date();
}

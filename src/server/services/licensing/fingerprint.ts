// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Machine fingerprint for offline licence activation tracking.
 *
 * The instance id identifies THIS installation against a licence's activation
 * limit. It must be stable across restarts: set DPO_INSTANCE_ID explicitly
 * (recommended for containers, where the virtual MAC can change), otherwise it
 * is derived deterministically from the machine fingerprint (hostname + MAC).
 */

import { hostname, networkInterfaces } from "os";
import { computeMachineFingerprint } from "@/lib/license-crypto";

export interface MachineInfo {
  hostname: string;
  macAddress: string;
  platform: string;
  fingerprint: string;
  instanceId: string;
}

/**
 * Get the primary MAC address of the machine. Prefers non-internal interfaces.
 */
export function getPrimaryMacAddress(): string {
  const interfaces = networkInterfaces();

  const priorities = ["eth0", "en0", "ens", "wlan0", "Wi-Fi", "Ethernet"];

  for (const priority of priorities) {
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (name.toLowerCase().startsWith(priority.toLowerCase())) {
        const addr = addrs?.find(
          (a) => !a.internal && a.mac && a.mac !== "00:00:00:00:00:00"
        );
        if (addr?.mac) {
          return addr.mac;
        }
      }
    }
  }

  for (const [, addrs] of Object.entries(interfaces)) {
    const addr = addrs?.find(
      (a) => !a.internal && a.mac && a.mac !== "00:00:00:00:00:00"
    );
    if (addr?.mac) {
      return addr.mac;
    }
  }

  // Last resort: placeholder combined with hostname in the fingerprint
  return "00:00:00:00:00:00";
}

/**
 * Machine information including fingerprint and stable instance id.
 */
export function getMachineInfo(): MachineInfo {
  const host = hostname();
  const mac = getPrimaryMacAddress();
  const fingerprint = computeMachineFingerprint(host, mac);
  const instanceId =
    process.env.DPO_INSTANCE_ID || `inst_${fingerprint.slice(0, 32)}`;

  return {
    hostname: host,
    macAddress: mac,
    platform: process.platform,
    fingerprint,
    instanceId,
  };
}

/**
 * Human-readable fingerprint (XXXX-XXXX-XXXX-XXXX) for support/licence requests.
 */
export function getDisplayFingerprint(): string {
  const shortHash = getMachineInfo().fingerprint.substring(0, 16).toUpperCase();
  return shortHash.match(/.{4}/g)?.join("-") || shortHash;
}

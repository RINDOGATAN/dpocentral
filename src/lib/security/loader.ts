/**
 * Security Module Loader
 *
 * Dynamically loads @dpocentral/security if installed.
 * Falls back gracefully when the package is absent.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { SecurityModule } from "./types";

const SECURITY_PACKAGE = "@dpocentral/security";

let securityModule: SecurityModule | null = null;
let loaded = false;

/**
 * Attempt to load the security module. Called from instrumentation.ts at startup.
 */
export async function loadSecurityModule(): Promise<SecurityModule | null> {
  if (loaded) return securityModule;
  loaded = true;

  try {
    const mod = await import(/* webpackIgnore: true */ SECURITY_PACKAGE);
    securityModule = mod as SecurityModule;
    console.log("Security module loaded from", SECURITY_PACKAGE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") {
      console.log(
        `${SECURITY_PACKAGE} not installed — security features use open-source defaults`
      );
    } else {
      console.warn(`Failed to load ${SECURITY_PACKAGE}:`, error);
    }
    securityModule = null;
  }

  return securityModule;
}

/**
 * Get the loaded security module (synchronous).
 * Returns null if not installed or not yet loaded.
 */
export function getSecurityModule(): SecurityModule | null {
  return securityModule;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Security module type definitions
 *
 * The contract of an optional security module (src/lib/security/index.ts).
 * When none is installed, the baseline defaults apply.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export type OrgRole = "OWNER" | "ADMIN" | "PRIVACY_OFFICER" | "MEMBER" | "VIEWER";

export interface SecurityModule {
  // Input sanitization
  stripHtml: (input: string) => string;
  sanitizeInput: <T>(input: T) => T;

  // Domain blocklist
  isPublicEmailDomain: (domain: string) => boolean;
}

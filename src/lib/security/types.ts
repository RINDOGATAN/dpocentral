/**
 * Security module type definitions
 *
 * These interfaces define the contract for @dpocentral/security.
 * The security package is optional — when absent, all features degrade gracefully.
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

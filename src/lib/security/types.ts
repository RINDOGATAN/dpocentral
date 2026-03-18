/**
 * Security module type definitions
 *
 * These interfaces define the contract for @dpocentral/security.
 * The security package is optional — when absent, all features degrade gracefully.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { NextResponse } from "next/server";

export type OrgRole = "OWNER" | "ADMIN" | "PRIVACY_OFFICER" | "MEMBER" | "VIEWER";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export interface SecurityModule {
  // Rate limiting
  authLimiter: RateLimiter;
  checkoutLimiter: RateLimiter;
  dsarPublicLimiter: RateLimiter;
  feedbackLimiter: RateLimiter;
  catalogSearchLimiter: RateLimiter;

  // RBAC — middleware handler factory (receives tRPC middleware args)
  createRoleChecker: (...roles: OrgRole[]) => (opts: any) => Promise<any>;

  // Input sanitization
  stripHtml: (input: string) => string;
  sanitizeInput: <T>(input: T) => T;

  // Domain blocklist
  isPublicEmailDomain: (domain: string) => boolean;

  // CSP nonce
  generateNonce: () => string;
  buildCspHeader: (nonce: string) => string;
  applyCspHeaders: (response: NextResponse, nonce: string) => void;
}

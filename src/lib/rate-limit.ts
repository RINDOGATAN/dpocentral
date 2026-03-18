/**
 * Rate limiting stubs
 *
 * When @dpocentral/security is installed, these are replaced with
 * real sliding-window rate limiters. Without it, all requests pass through.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import type { RateLimiter } from "./security/types";

const noopLimiter: RateLimiter = {
  check: () => ({ success: true, remaining: Infinity, limit: 0, reset: 0 }),
};

export const authLimiter: RateLimiter = noopLimiter;
export const dsarPublicLimiter: RateLimiter = noopLimiter;
export const feedbackLimiter: RateLimiter = noopLimiter;
export const catalogSearchLimiter: RateLimiter = noopLimiter;
export const checkoutLimiter: RateLimiter = noopLimiter;

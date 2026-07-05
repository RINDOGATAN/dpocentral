# DPO Central — Security Overview

This document describes the security posture of **the open-source build of DPO
Central** — the code in this repository, which is also what the
`deploy/sovereign` Docker bundle runs. Where the hosted service or the optional
private `@dpocentral/security` package adds protections on top, that is stated
explicitly rather than implied. If a protection is not listed under "enforced
in this build", assume it is not present in your install.

## Enforced in this build

### Authentication

- NextAuth with JWT sessions; no server-side session store.
- Sign-in methods are env-gated: Google OAuth, email magic links (Resend), and
  a local credentials provider (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED`).
- **The local credentials provider is passwordless**: any email address signs
  in and an account is created if none exists. It exists for single-firm
  localhost/LAN installs. Do not expose an instance with it enabled to the
  public internet — see the Hardening section of `deploy/sovereign/README.md`.
- OAuth access/refresh tokens are not persisted; no silent cross-provider
  account linking.

### Authorization

- **Multi-tenancy**: every organization-scoped tRPC procedure resolves the
  caller's membership and scopes database access by `organizationId`. All
  database access goes through Prisma; no raw SQL.
- **Role-based access control is enforced in this build.** The five-tier role
  hierarchy (Owner, Admin, Privacy Officer, Member, Viewer) is checked in the
  open-source core (`src/server/trpc.ts`), not in an optional package:
  - Read access: any organization member
  - Create/update: Members and above
  - Sensitive operations (DSAR management, incidents, assessments): Privacy
    Officers and above
  - Destructive operations (deletes, organization settings): Admins and Owners
  - Member-role changes: Owners only
- **Platform admin gating**: platform-admin endpoints are restricted to the
  email addresses listed in the `ADMIN_EMAILS` environment variable. If it is
  unset, no one has platform-admin access.

### Input validation

- Zod schema validation on every tRPC endpoint.
- Parameterized queries via Prisma — no SQL injection surface.
- **Baseline HTML sanitization is enforced in this build** (`src/lib/sanitize.ts`):
  `sanitizeInput` strips HTML tags and escapes stray angle brackets in string
  inputs on sanitized endpoints (e.g. public DSAR submissions). The optional
  `@dpocentral/security` package layers a stricter allowlist sanitizer on top.
  The baseline is tag-stripping, not a full HTML parser — continue to treat
  free-text fields as untrusted on output.
- **Operator-supplied custom CSS for the public DSAR portal is sanitized**
  (angle brackets CSS-escaped, `@import`/`expression()` removed) both at write
  time and again at render, so it cannot break out of its `<style>` block.

### Transport & browser security

- HSTS (2-year max-age, includeSubDomains, preload), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, strict Referrer-Policy, and a
  Permissions-Policy disabling camera/microphone/geolocation — set on every
  response.
- **An enforcing Content Security Policy is set on every response.** It locks
  scripts to same-origin plus Stripe, disallows plugins, `<base>` hijacking,
  cross-origin form posts, and framing. It deliberately still allows inline
  scripts (`'unsafe-inline'`) because Next.js inline bootstrap scripts are not
  nonce-wired yet; a stricter nonce + `strict-dynamic` policy ships in
  parallel as Report-Only and is the migration target. Treat CSP as a
  second layer, not the primary XSS defense.

### Rate limiting

- Authentication, checkout/billing, and public DSAR submission routes are
  throttled. The limiter is **in-memory and per-instance**: adequate for a
  single-instance self-hosted deployment, not a global limit on
  multi-instance deployments.

### Audit trail

- Create/update/delete operations across modules write audit log entries.
- DSAR audit trails survive redaction (actions and timestamps, no PII).
- Production logs avoid stack traces and sensitive context.

### Billing (only relevant when Stripe is configured)

- Stripe webhook signature verification (HMAC-SHA256); server-side checkout;
  entitlements suspended on payment failure.

## Requires the private `@dpocentral/security` package

These protections are **not active** in a plain checkout or the sovereign
bundle. They apply to the hosted service and commercial arrangements:

- Allowlist-based HTML sanitization of user-submitted content (the baseline
  tag-stripping sanitizer above is always active).
- The public-email-domain blocklist for domain-based auto-join. Without it,
  an organization whose `domain` is set to a public email domain (e.g.
  `gmail.com`) would auto-join every user signing in from that domain —
  **do not set public email domains as organization domains** on open-source
  installs.

## Known limitations of this build

- The enforced CSP allows inline scripts; the strict nonce policy is
  report-only (see above).
- Rate limits are per-instance, in-memory.
- The passwordless local provider must never face the public internet.
- Domain-based auto-join performs no domain-ownership verification.
- The DSAR auto-redaction job (`/api/cron/dsar-redaction`) needs an external
  scheduler and a configured `CRON_SECRET`. The endpoint **fails closed**: if
  `CRON_SECRET` is unset it refuses to run (HTTP 503) rather than accepting
  unauthenticated triggers — but that also means retention-based redaction
  does not run until you configure it.
- There is no automated test suite yet.

## Responsible disclosure

If you discover a security vulnerability, please report it privately to
**support@rindogatan.com**. Do not open a public issue. We will acknowledge
receipt and keep you informed of remediation progress.

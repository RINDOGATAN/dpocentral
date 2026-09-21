# DPO Central — Security Overview

This document describes the security posture of **the open-source build of DPO
Central** — the code in this repository, which is also what the
`deploy/sovereign` Docker bundle runs. Where the hosted service or the optional
private `@dpocentral/security` package adds protections on top, that is stated
explicitly rather than implied. If a protection is not listed under "enforced
in this build", assume it is not present in your install. Known gaps are
listed at the end, not implied.

## Reporting a vulnerability

Report privately to **support@rindogatan.com**. Do not open a public issue. We
acknowledge receipt and keep you informed of remediation progress. Fixes ship
in the next tagged release (see below); a fix for the hosted service goes out
with the next deploy from `main`.

## Supported versions

| Line | What it is | Security fixes |
|---|---|---|
| Latest `vX.Y.Z` tag, published as the `:latest` and `:vX.Y.Z` images on GHCR | What the self-host kit installs and updates to | Yes |
| `main` | Always releasable; the hosted service deploys from it | Yes (it becomes the next tag) |
| Older tags | Previous self-host releases | No backports — update to the latest tag (migrations are append-only, any version upgrades straight to latest) |

## Two postures, one codebase

The same source runs the hosted service and the self-hosted bundle. The
differences are environment-driven, never forked. What that means for
security:

| Concern | Hosted service | Self-hosted bundle (`deploy/sovereign`) |
|---|---|---|
| Sign-in | Google OAuth and e-mail magic links (external providers) | Local passwordless provider by default (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true`), behind the firm's own network; Google/e-mail are optional |
| Session cookie | Shared across the `.todo.law` apps (`AUTH_COOKIE_DOMAIN`) | Host-only, app-prefixed names so sibling apps on the same host cannot overwrite it |
| Transport | TLS terminated by the hosting platform | Plain HTTP on localhost by default; the optional TLS profile (Caddy) for LAN or VPS use |
| Database | Managed Postgres, one dedicated database for this app | Postgres 16 container on the firm's disk |
| Rate limits | Per function instance (see below) | One process, so one global limit; the client address is only known behind the TLS profile or another proxy |
| DSAR retention job | Platform cron with `CRON_SECRET` | A small scheduler container calling the same route with `CRON_SECRET` |
| Backups | The database provider's point-in-time restore | `backup.sh` (encrypted `pg_dump`) and `restore.sh`; the operator sets the schedule |
| Secrets | Platform environment (sensitive values are write-only there) | `.env` next to the compose file, `chmod 600` |
| Premium modules | All included in the free pilot; nothing is sold on the hosted service | Offline Ed25519-signed licence files (€60 a year each); no phone-home |
| Pilot limits | One organization per account; 90 days of editing from the organization's first sign-in, then read-only with export; a records ceiling per organization (`src/server/services/pilot/caps.ts`). No security certification: not for real client data | None |

Who is responsible for what in each posture, with a checklist for the hosted
maintainer and one for the firm running the bundle, is in `docs/security.md`.
Schema changes are forward-only; how they are applied and how an upgrade is
rehearsed on a copy is in `docs/migrations.md`. The inventory of every
environment variable, by name only, is in `docs/secrets-inventory.md`.
Capacity limits and the scaling plan are in `docs/capacity.md`.

## Enforced in this build

### Authentication

- NextAuth with JWT sessions; no server-side session store.
- Sign-in methods are env-gated: Google OAuth, e-mail magic links (Resend), and
  a local credentials provider (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED`).
- **The local credentials provider is passwordless**: any e-mail address signs
  in and an account is created if none exists. It exists for single-firm
  localhost/LAN installs. Do not expose an instance with it enabled to the
  public internet — see the Hardening section of `deploy/sovereign/README.md`.
- OAuth access/refresh tokens are not persisted; no silent cross-provider
  account linking.
- A session token whose user id does not exist locally is re-anchored by
  e-mail (just-in-time provisioning) or cleared; a session without a user id
  is treated as signed out.

### Authorization

- **Multi-tenancy**: every organization-scoped tRPC procedure resolves the
  caller's membership and scopes database access by `organizationId`. All
  request-path database access goes through Prisma's query builder; the only
  raw statement on a request path is the health probe's constant `SELECT 1`.
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
  e-mail addresses listed in the `ADMIN_EMAILS` environment variable. If it is
  unset, no one has platform-admin access.
- **Static-key routes** (the cross-app import routes, the template sync, the
  retention cron) compare their key in constant time and refuse every request
  when the key is not configured.

### Input validation

- Zod schema validation on every tRPC endpoint.
- Parameterized queries via Prisma — no SQL injection surface on request paths.
- **Baseline HTML sanitization is enforced in this build** (`src/lib/sanitize.ts`):
  `sanitizeInput` strips HTML tags and escapes stray angle brackets in string
  inputs on sanitized endpoints (e.g. public DSAR submissions). The optional
  `@dpocentral/security` package layers a stricter allowlist sanitizer on top.
  The baseline is tag-stripping, not a full HTML parser — continue to treat
  free-text fields as untrusted on output.
- **Operator-supplied custom CSS for the public DSAR portal is sanitized**
  (angle brackets CSS-escaped, `@import`/`expression()` removed) both at write
  time and again at render, so it cannot break out of its `<style>` block.

### Transport and browser security

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

Applied in the middleware to the public and static-key API surface, one bucket
per route class, keyed by client address (`src/lib/rate-limit.ts`,
`src/lib/rate-limit-routes.ts`):

| Route class | Default ceiling |
|---|---|
| Sign-in steps (credential and OAuth callbacks, magic-link consumption) | 10 per minute |
| Magic-link e-mail requests | 5 per 15 minutes |
| Other `/api/auth` traffic (session, csrf, providers, sign-out) | 30 per minute |
| Checkout and billing portal | 10 per minute |
| Public DSAR intake and withdrawal | 5 per 10 minutes |
| `/api/health` (its database probe is also cached for 10 seconds) | 60 per minute |
| `/api/import/*` and `/api/admin/sync-templates` | 60 per minute |
| `/api/cron/*` | 10 per minute |
| PDF exports (inside the route, keyed by user) | 10 per minute |

Every ceiling is configurable (`RATE_LIMIT_<NAME>="<count>/<seconds>"`) and
`RATE_LIMIT_DISABLED=true` switches the limiter off for installs whose reverse
proxy already limits. The Stripe webhook is not limited (signature-verified;
refusing retries would only delay settlement).

**The counters are in memory and per process.** On the self-hosted bundle that
is one global limit. On the hosted service every function instance keeps its
own counters, so the effective ceiling is the limit multiplied by the number
of instances, and a counter resets when an instance is recycled. The client
address is read from `x-forwarded-for`, which is only trustworthy behind a
proxy that sets it; an install reached directly puts every client in one
bucket and lets a client forge the header.

### Audit trail

- Create/update/delete operations across modules write audit log entries;
  DSAR requests carry their own per-request trail.
- DSAR audit trails survive redaction (actions and timestamps, no PII).
- The shared logger writes error messages only in production (no stack traces).

### Billing (only relevant when Stripe is configured)

- Stripe webhook signature verification (HMAC-SHA256); server-side checkout;
  entitlements suspended on payment failure.

### Tests and continuous integration

- An automated suite runs on every push and pull request (`npm test`, Vitest):
  tenant isolation, the role gate, the public DSAR intake, catalog seeding,
  the cross-app import, just-in-time provisioning, offline licence
  verification, the rate limits per route, the health cache and the
  static-key routes.
- CI also runs `npm audit --audit-level=high` and fails on any high or
  critical advisory, then lint, typecheck and a production build.

## Requires the private `@dpocentral/security` package

These protections are **not active** in a plain checkout or the sovereign
bundle. They apply to the hosted service and commercial arrangements:

- Allowlist-based HTML sanitization of user-submitted content (the baseline
  tag-stripping sanitizer above is always active).
- The public-e-mail-domain blocklist for domain-based auto-join. Without it,
  an organization whose `domain` is set to a public e-mail domain (e.g.
  `gmail.com`) would auto-join every user signing in from that domain —
  **do not set public e-mail domains as organization domains** on open-source
  installs.

## Known gaps

Stated so they can be weighed, not implied.

1. **Rate limits are per process** and depend on a trustworthy
   `x-forwarded-for` (see above). There is no shared store yet.
2. **The enforced CSP allows inline scripts**; the strict nonce policy is
   report-only.
3. **The passwordless local provider has no build-time guard.** It is off on
   the hosted service by configuration (the variable is not set), not by
   construction: setting `NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true` in the hosted
   environment and rebuilding would enable it. The rule is documented; the
   guard is not written.
4. **Domain-based auto-join rests on the owner's sign-in address, not on a
   DNS proof.** An organisation carries a domain only when it equals the
   domain of its owner's own proven sign-in address and is not a public mail
   provider (the list is in the open-source core, `src/lib/org-domain.ts`);
   the auto-join re-checks this at every sign-in and joins nobody where two
   organisations store one domain. Any one employee of a company can still be
   the first to claim its domain.
5. **Audit logs have no retention or export path.** Rows are kept
   indefinitely; reads and sign-ins are not logged; "available on request"
   means an operator query.
6. **The DSAR auto-redaction job** (`/api/cron/dsar-redaction`) needs an
   external scheduler and a configured `CRON_SECRET`. The endpoint **fails
   closed**: if `CRON_SECRET` is unset it refuses to run (HTTP 503) rather
   than accepting unauthenticated triggers — which also means retention-based
   redaction does not run until you configure it.
7. **Dependency advisories below "high" are not blocking.** On 19 September
   2026 two moderate advisories are open, both in the test runner (a mock
   package and the runner that depends on it; development only, the fix is a
   major upgrade); the CI gate fails only on high or critical.
8. **A restore rehearsal is not recorded in this repository.** The scripts
   exist for the bundle and the procedure is written down
   (`docs/migrations.md`); whether and when a restore was last rehearsed is
   the operator's record, not the tree's.
9. **The health endpoint is public** and discloses the application version.
   It exposes nothing else.

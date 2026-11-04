# DPO Central community edition: security

This document describes what the code in this repository enforces, as it runs
from the Docker stack in `deploy/docker` or from `npm start`. If a protection
is not listed under "Enforced in this edition", assume it is not present in
your install. Known gaps are listed at the end.

## Reporting a vulnerability

Report privately to **support@rindogatan.com**. Do not open a public issue. We
acknowledge receipt and keep you informed of remediation progress. Fixes ship
in the next release.

## Supported versions

Security fixes go into the latest release. Older releases get no backports:
update to the latest one (migrations are append-only, so any version upgrades
straight to the latest).

## Enforced in this edition

### Authentication

- NextAuth with JWT sessions; no server-side session store; a session lasts
  12 hours.
- Sign-in methods are set by environment: a local passwordless form
  (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED`), e-mail links (Resend) and Google OAuth
  with your own client.
- **The local form is passwordless**: any e-mail address signs in and an
  account is created if none exists. It is meant for a single machine or a
  network you trust. Do not expose an instance with it switched on to the
  public internet (see the hardening section of `deploy/docker/README.md`).
- OAuth access and refresh tokens are not stored; no silent cross-provider
  account linking.
- A session whose user does not exist locally is re-anchored by e-mail or
  cleared; a session without a user id is treated as signed out.

### Authorization

- **Multi-tenancy**: every organization-scoped tRPC procedure resolves the
  caller's membership and scopes database access by `organizationId`. All
  request-path database access goes through Prisma's query builder; the only
  raw statement on a request path is the health probe's constant `SELECT 1`.
- **Role-based access control** with five roles (Owner, Admin, Privacy
  Officer, Member, Viewer) is checked in `src/server/trpc.ts`:
  - Read access: any organization member
  - Create and update: Members and above
  - Rights requests and incidents: Privacy Officers and above
  - Deletes and organization settings: Admins and Owners
  - Member-role changes: Owners only
- **Static-key routes** (the daily cron routes) compare their key in constant
  time and refuse every request when the key is not configured.

### Input validation

- Zod schema validation on every tRPC endpoint.
- Parameterized queries through Prisma.
- Baseline HTML sanitization (`src/lib/sanitize.ts`): string inputs on
  sanitized endpoints (for example public rights-request submissions) have
  HTML tags stripped and stray angle brackets escaped. It is tag-stripping,
  not a full HTML parser: treat free-text fields as untrusted on output.
- Custom CSS for the public rights-request form is sanitized when it is saved
  and again when it is rendered.

### Transport and browser security

- HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict
  Referrer-Policy and a Permissions-Policy on every response.
- An enforcing Content Security Policy locks scripts to the same origin and
  disallows plugins, `<base>` hijacking, cross-origin form posts and framing.
  It still allows inline scripts; a stricter nonce policy runs in parallel as
  Report-Only.

### Rate limiting

Applied in the middleware, one bucket per route class, keyed by client
address (`src/lib/rate-limit.ts`, `src/lib/rate-limit-routes.ts`):

| Route class | Default ceiling |
|---|---|
| Sign-in steps (callbacks, e-mail link consumption) | 10 per minute |
| E-mail link requests | 5 per 15 minutes |
| Session, CSRF and provider reads | 600 per minute |
| Other `/api/auth` traffic | 30 per minute |
| Public rights-request submission and withdrawal | 5 per 10 minutes |
| Other public procedures (request status, public form) | 30 per minute |
| `/api/health` (its database probe is cached for 10 seconds) | 60 per minute |
| `/api/cron/*` | 10 per minute |
| PDF exports (inside the route, keyed by user) | 10 per minute |

Every ceiling is configurable (`RATE_LIMIT_<NAME>="<count>/<seconds>"`), and
`RATE_LIMIT_DISABLED=true` switches the limiter off behind a reverse proxy
that already limits. The counters are in memory, per process. The client
address is read from `x-forwarded-for`, which is only trustworthy behind a
proxy that sets it.

The public rights-request form has shared limits on top, counted in the
database: a hidden field people never fill, a signed form token that refuses
a submission sent less than 3 seconds after the page loaded or more than a
day later, 10 submissions a day per client address, 50 a day per
organization, and at most 3 acknowledgement e-mails a day to one recipient.
Addresses are stored only as a keyed hash. If the counters cannot be written,
the form lets the request through (a rights request is a legal obligation).

### Audit trail

- Create, update and delete operations write audit log entries; rights
  requests carry their own per-request trail, which survives redaction
  (actions and timestamps, no personal data).
- The logger writes error messages only in production (no stack traces).

### Tests

- `npm test` (Vitest) covers tenant isolation, the role gate, the public
  rights-request form, just-in-time provisioning, the rate limits per route,
  the health cache and the static-key routes.

## Known gaps

1. **Rate limits are per process** and depend on a trustworthy
   `x-forwarded-for`. Only the public rights-request form has a shared store.
2. **The enforced CSP allows inline scripts**; the strict nonce policy is
   report-only.
3. **Domain-based auto-join rests on the owner's sign-in address, not on a
   DNS proof.** An organization carries a domain only when it equals the
   domain of its owner's own proven sign-in address and is not a public mail
   provider (`src/lib/org-domain.ts`). Any one employee of a company can still
   be the first to claim its domain.
4. **Audit logs have no retention rule.** Rows are kept until the
   organization is deleted.
5. **The rights-request redaction job** (`/api/cron/dsar-redaction`) needs a
   scheduler and `CRON_SECRET`. Without the secret the endpoint refuses to run,
   which also means redaction does not run until you configure it.
6. **The health endpoint is public** and discloses the application version.

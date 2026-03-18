# DPO Central — Security Overview

DPO Central is built with security as a foundational requirement. As a privacy management platform handling assessment results, incident records, vendor contracts, and data subject requests, we apply defense-in-depth across every layer.

## Authentication

- **Multi-provider auth** via NextAuth with Google OAuth and email magic links
- **JWT-based sessions** — no server-side session state to compromise
- **No unnecessary token storage** — OAuth tokens are not persisted
- **Account isolation** — each sign-in method is isolated; no silent cross-provider account linking
- **Cross-app SSO** via secure, scoped session cookies across `*.todo.law` subdomains

## Authorization

- **Strict multi-tenancy** — every database query is scoped to the authenticated user's organization via middleware. No raw SQL.
- **Role-based access control** — five-tier role hierarchy (Owner, Admin, Privacy Officer, Member, Viewer) enforces least-privilege on all mutations
  - Read access: any organization member
  - Create/update: Members and above
  - Sensitive operations (DSAR, incidents, assessments): Privacy Officers and above
  - Destructive operations (delete, org settings): Admins and Owners only
- **Platform admin gating** — admin panel access restricted to designated email addresses via environment configuration

## Input Validation

- **Schema validation** on every API endpoint via Zod
- **HTML sanitization** on all public-facing inputs (DSAR submissions, vendor questionnaire responses)
- **Parameterized queries** — all database access via Prisma ORM; no SQL injection surface

## Transport & Browser Security

- **HSTS** with 2-year max-age, includeSubDomains, and preload
- **Content Security Policy** with per-request nonces — no `unsafe-inline` scripts
- **X-Frame-Options: DENY** — clickjacking protection
- **X-Content-Type-Options: nosniff** — MIME sniffing prevention
- **Strict Referrer-Policy** — cross-origin referrer information limited
- **Permissions-Policy** — camera, microphone, and geolocation disabled

## Rate Limiting

- **Authentication endpoints** — throttled to prevent credential stuffing and magic link abuse
- **Checkout and billing** — throttled to prevent payment fraud
- **Public submission endpoints** — throttled to prevent spam

## API Security

- **Timing-safe API key comparison** on administrative endpoints
- **Payload size validation** on batch operations
- **Token expiry enforcement** on all vendor questionnaire operations
- **Public DSAR portal** validates active intake form configuration before accepting submissions

## Audit Trail

- **Comprehensive audit logging** for all create, update, and delete operations across every module
- **Administrative action logging** — template sync, checkout, and webhook events are logged with metadata
- **Structured logging** — production logs contain no stack traces or sensitive context

## Data Minimization

- **Selective query responses** — API detail endpoints return only the fields needed by the UI, not entire database records
- **License key masking** in administrative interfaces
- **Domain-based join protection** — public email domains (Gmail, Outlook, etc.) cannot trigger automatic organization membership

## Stripe Integration

- **Webhook signature verification** via HMAC-SHA256
- **Server-side checkout** — no client-side price manipulation possible
- **Subscription lifecycle management** — entitlements are automatically suspended on payment failure

## Premium Security Features

The following advanced security capabilities are available with a DPO Central commercial license:

- Advanced vendor risk scoring and assessment scoring algorithms
- DPIA, PIA, and TIA assessment templates with compliance-grade scoring
- Extended audit and compliance reporting

For details on premium features, contact us or visit the billing section in your dashboard.

## Responsible Disclosure

If you discover a security vulnerability, please report it responsibly. Do not open a public issue. Contact us directly at the email listed in the repository.

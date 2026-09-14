# Secrets and configuration inventory

**Names only. No value appears in this file, ever.** One row per environment
variable the tree reads, cross-checked against every `process.env` read in
`src/`, `scripts/`, `prisma/`, `tests/`, the sovereign bundle
(`deploy/sovereign/`) and the CI workflows. Re-check after adding a variable:
the list is only useful while it is complete.

Columns:

- **Secret**: yes = grants access or signs something, must never be logged,
  committed or shown; no = configuration, harmless if disclosed. Every
  `NEXT_PUBLIC_*` variable is inlined into the browser bundle at build time and
  is therefore public by construction.
- **Where it lives**: *Hosted env* = the hosting platform's environment for the
  hosted service (sensitive values are write-only there); *Kit .env* =
  `deploy/sovereign/.env` on a self-host box (`chmod 600`, git-ignored);
  *Build arg* = baked into the self-host image by `deploy/sovereign/Dockerfile`
  (published images carry the localhost defaults); *CI* = GitHub Actions;
  *Local dev* = `.env.local` on a developer machine; *Operator* = passed on the
  command line to a script.
- **Who rotates**: the *hosted operator* (the team running the hosted service)
  or the *self-host administrator* (the firm running the bundle). Where the
  value is issued by another party, that party is named by role.
- **Last rotation**: what the tree records. The tree records almost nothing
  here; "not recorded" means the date, if any, lives outside this repository.

## Secrets

| Variable | Secret | Where it lives | What it unlocks | Who rotates | Last rotation |
|---|---|---|---|---|---|
| `DATABASE_URL` | yes (contains the database password) | Hosted env; Kit .env via `POSTGRES_PASSWORD`; Local dev; CI uses a dummy value for the build | Full read/write on the application database | Hosted operator (database provider console); self-host administrator | not recorded |
| `POSTGRES_PASSWORD` | yes | Kit .env | The bundled Postgres superuser for this app; composed into `DATABASE_URL` for the app and the migrator | Self-host administrator | not recorded |
| `NEXTAUTH_SECRET` | yes | Hosted env; Kit .env | Signs and verifies every session token; rotating it signs every user out. On the hosted service it is shared with the sibling apps for cross-app single sign-on | Hosted operator (coordinated across the suite); self-host administrator | not recorded |
| `GOOGLE_CLIENT_SECRET` | yes | Hosted env (optional on Kit .env) | Google OAuth sign-in | Hosted operator, in the OAuth provider console | not recorded |
| `RESEND_API_KEY` | yes | Hosted env (optional on Kit .env) | Sending magic-link, DSAR and billing e-mails through the mail provider | Hosted operator, in the mail provider console | not recorded |
| `CRON_SECRET` | yes | Hosted env; Kit .env | Triggers the DSAR retention auto-redaction route (`Authorization: Bearer`); the route refuses to run without it | Hosted operator; self-host administrator | not recorded |
| `DPC_IMPORT_API_KEYS` | yes (comma-separated list) | Hosted env; Kit .env (optional) | Accepts portfolio pushes on `/api/import/*` from the vendor-intelligence sibling app; must match that app's outbound key | Hosted operator together with the sibling app's operator | not recorded |
| `TEMPLATE_SYNC_API_KEY` | yes | Hosted env (not in either env example; unset = route disabled) | `POST /api/admin/sync-templates` (assessment template upsert) | Hosted operator | not recorded |
| `VENDORWATCH_CATALOG_API_KEY` | yes | Hosted env; Kit .env (optional, for a one-off catalog refresh) | Pulls the vendor catalog from the sibling app's sync endpoint (`npm run db:sync-vendor-catalog`) | Issued by the sibling app's operator | not recorded |
| `AI_SENTINEL_API_KEY` | yes | Hosted env; Kit .env (optional) | Pushes AI systems to the AI-governance sibling app and reads its AI-Act status | Issued by the sibling app's operator | not recorded |
| `DEALROOM_API_KEY` | yes | Hosted env (optional; unset = mock expert directory) | Reads the contract-negotiation sibling app's expert directory | Issued by the sibling app's operator | not recorded |
| `LLM_GATEWAY_KEY` (and the lane variants `_EU`, `_US`, `_LOCAL`) | yes | Hosted env; Kit .env | Authenticates to the OpenAI-compatible AI gateway for narrative generation | Whoever runs the gateway; self-host administrator | not recorded |
| `OPENAI_API_KEY` | yes | Hosted env (optional fallback provider) | Direct AI provider access when no gateway is configured | Hosted operator, in the provider console | not recorded |
| `ANTHROPIC_API_KEY` | yes | Hosted env (optional fallback provider) | Direct AI provider access when no gateway is configured | Hosted operator, in the provider console | not recorded |
| `STRIPE_SECRET_KEY` | yes | Hosted env (Kit .env keeps it empty) | Creating checkout sessions, customer portal sessions, price verification; dormant while `NEXT_PUBLIC_STRIPE_ENABLED` is false | Hosted operator, in the payment provider dashboard | not recorded |
| `STRIPE_WEBHOOK_SECRET` | yes | Hosted env (Kit .env keeps it empty) | Verifies webhook signatures on `/api/webhooks/stripe` | Hosted operator, in the payment provider dashboard | not recorded |
| `BACKUP_PASSPHRASE` | yes | Kit .env | Encrypts and decrypts `backup.sh` / `restore.sh` dumps (AES-256); losing it loses the backups | Self-host administrator | not recorded |
| `GITHUB_TOKEN` | yes (issued per run) | CI (automatic) | Pushes the self-host images to the container registry in `publish-image.yml` | Rotated by the platform on every run | automatic |

## Configuration (not secret)

| Variable | Secret | Where it lives | What it unlocks | Who rotates | Last rotation |
|---|---|---|---|---|---|
| `NEXTAUTH_URL` | no | Hosted env; Kit .env via `PUBLIC_URL` | Canonical origin for auth callbacks and links in e-mails | n/a | n/a |
| `AUTH_COOKIE_DOMAIN` | no | Hosted env only | Opts into the cross-app session cookie on the parent domain; empty = host-only cookies (every self-host) | n/a | n/a |
| `GOOGLE_CLIENT_ID` | no (public OAuth client id) | Hosted env | Pairs with the client secret | With the secret | n/a |
| `ADMIN_EMAILS` | no, but sensitive (grants platform-admin) | Hosted env; Kit .env | Who may use the platform-admin routes; unset = nobody | Hosted operator; self-host administrator | n/a |
| `SKILL_SIGNING_PUBLIC_KEY` | no (a public key) | Hosted env; Kit .env; a baked-in default in code | Verifies offline licence files; the private half never touches this tree | The storefront operator, on key rotation only | set in the hosted environment in July 2026 |
| `DPO_INSTANCE_ID` | no | Kit .env (optional); Hosted env (optional) | Stable install id for licence activation limits; defaults to a machine fingerprint | n/a | n/a |
| `VENDORWATCH_CATALOG_API_URL` | no | Hosted env; Kit .env | Where the catalog sync pulls from | n/a | n/a |
| `AI_SENTINEL_API_URL` | no | Hosted env; Kit .env | Server-to-server endpoint of the AI-governance sibling | n/a | n/a |
| `DEALROOM_API_URL`, `DEALROOM_MOCK_EXPERTS` | no | Hosted env | Expert directory endpoint; explicit opt-in to the mock directory | n/a | n/a |
| `LLM_GATEWAY_URL`, `LLM_MODEL_ALIAS` (and `_EU`, `_US`, `_LOCAL` lane variants) | no | Hosted env; Kit .env | Which AI gateway and model answer, per confidentiality lane | n/a | n/a |
| `STRIPE_PRICE_ID`, `STRIPE_PRICE_DPIA`, `STRIPE_PRICE_PIA`, `STRIPE_PRICE_TIA`, `STRIPE_PRICE_VENDOR`, `STRIPE_PRICE_VENDOR_CATALOG`, `STRIPE_PRICE_ROPA_EXPORT`, `STRIPE_PRICE_ID_USD` | no (price identifiers) | Hosted env, read by the seed and the checkout route | Which price each module is sold at | n/a | n/a |
| `RATE_LIMIT_DISABLED`, `RATE_LIMIT_SIGNIN`, `RATE_LIMIT_MAGIC_LINK`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_CHECKOUT`, `RATE_LIMIT_DSAR_PUBLIC`, `RATE_LIMIT_EXPORT`, `RATE_LIMIT_HEALTH`, `RATE_LIMIT_IMPORT`, `RATE_LIMIT_CRON` | no | Hosted env (optional); Kit .env (optional) | Rate-limit ceilings per route class and the disable switch for proxied installs (`src/lib/rate-limit.ts`) | n/a | n/a |
| `HEALTH_CACHE_MS` | no | Hosted env (optional); Kit .env (optional) | How long `/api/health` caches its database probe | n/a | n/a |
| `DEMO_SEED` | no | Kit .env; Operator on a hosted seed run | Seeds the demo organization and sample records; keeps an existing demo organization from being removed | n/a | n/a |
| `SEED_CONTENT_ONLY` | no | Operator; the kit's migrator sets it on every boot after first install | Restricts the seed to built-in content (catalog, templates), never users or organizations | n/a | n/a |
| `ENABLE_PREVIEW_ROUTES` | no | Local dev | Enables the flow-map preview page outside development | n/a | n/a |
| `NODE_ENV`, `NEXT_RUNTIME`, `NEXT_OUTPUT_STANDALONE`, `NEXT_TELEMETRY_DISABLED`, `VERCEL_GIT_COMMIT_SHA` | no | Set by the platform, the Dockerfile or CI | Runtime mode, standalone build for the bundle, telemetry off, the deployed commit for the source link | n/a | n/a |
| `PUBLIC_URL`, `BIND_ADDR`, `PORT`, `TLS_DOMAIN`, `BACKUP_RCLONE_REMOTE` | no | Kit .env (compose and the backup scripts only) | The bundle's origin, bind address and port, the optional TLS hostname, the optional off-machine backup remote | n/a | n/a |

### Public build-time variables (`NEXT_PUBLIC_*`)

All inlined into the browser bundle at build time: changing one requires a
rebuild (the kit's `docker compose up -d --build app`). None is secret.

| Group | Variables | What they set |
|---|---|---|
| Posture switches | `NEXT_PUBLIC_LOCAL_AUTH_ENABLED`, `NEXT_PUBLIC_EMAIL_AUTH_ENABLED`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, `NEXT_PUBLIC_STRIPE_ENABLED`, `NEXT_PUBLIC_SELF_SERVICE_UPGRADE` | Which sign-in methods show; whether hosted billing is on (and with it the paywall) |
| Feature flags | `NEXT_PUBLIC_EXPERT_DIRECTORY_ENABLED`, `NEXT_PUBLIC_NOTIFICATIONS_ENABLED`, `NEXT_PUBLIC_COMPLIANCE_DASHBOARD_ENABLED`, `NEXT_PUBLIC_DPIA_AUTO_FILL_ENABLED`, `NEXT_PUBLIC_TRANSFER_COMPLIANCE_ENABLED`, `NEXT_PUBLIC_REGULATORY_TRACKER_ENABLED`, `NEXT_PUBLIC_AI_GOVERNANCE_ENABLED`, `NEXT_PUBLIC_AI_SENTINEL_ENABLED`, `NEXT_PUBLIC_AI_ASSIST_ENABLED` | Module visibility |
| Locale | `NEXT_PUBLIC_I18N_ENABLED`, `NEXT_PUBLIC_AVAILABLE_LOCALES`, `NEXT_PUBLIC_DEFAULT_LOCALE` | Locale routing and the language list |
| Links | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_AI_SENTINEL_URL`, `NEXT_PUBLIC_MARKETPLACE_URL`, `NEXT_PUBLIC_SOURCE_URL`, `NEXT_PUBLIC_SOURCE_PUBLIC`, `NEXT_PUBLIC_COMMIT_SHA`, `NEXT_PUBLIC_TERMS_URL`, `NEXT_PUBLIC_PRIVACY_URL`, `NEXT_PUBLIC_COMPANY_WEBSITE` | Deep links, the storefront, the corresponding-source link |
| Brand | `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_NAME_UPPER`, `NEXT_PUBLIC_BRAND_TAGLINE`, `NEXT_PUBLIC_BRAND_DESCRIPTION`, `NEXT_PUBLIC_BRAND_ACCENT`, `NEXT_PUBLIC_BRAND_LOGO_URL`, `NEXT_PUBLIC_LOGO_PATH`, `NEXT_PUBLIC_FAVICON_PATH`, `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_TRADEMARK`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_EMAIL_FROM` | White-label text, logo, sender |
| Colours | `NEXT_PUBLIC_COLOR_PRIMARY`, `NEXT_PUBLIC_COLOR_PRIMARY_FG`, `NEXT_PUBLIC_COLOR_BACKGROUND`, `NEXT_PUBLIC_COLOR_FOREGROUND`, `NEXT_PUBLIC_COLOR_CARD`, `NEXT_PUBLIC_COLOR_CARD_FG`, `NEXT_PUBLIC_COLOR_BORDER`, `NEXT_PUBLIC_COLOR_MUTED`, `NEXT_PUBLIC_COLOR_MUTED_FG`, `NEXT_PUBLIC_COLOR_ACCENT`, `NEXT_PUBLIC_COLOR_ACCENT_FG` | Theme tokens |
| Payment (public half) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | The browser-side payment key; public by design |

## Rules

1. A secret is set in the platform environment or the kit's `.env`, never in
   a tracked file. `.env`, `.env*.local` and `STATUS.md` are git-ignored.
2. A new `process.env` read adds a row here in the same change.
3. Rotation of a shared secret (`NEXTAUTH_SECRET` on the hosted service,
   `DPC_IMPORT_API_KEYS`, the sibling-app keys) is coordinated with the other
   side first; the tree cannot tell you the other side's schedule.
4. Rotating `NEXTAUTH_SECRET` signs every user out; rotating
   `BACKUP_PASSPHRASE` makes older backups unreadable unless the old value is
   kept with them.

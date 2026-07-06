# DPO Central — Sovereign bundle

The full DPO Central stack on firm hardware, one command. Same app code as
the cloud deployment — only environment differs (portability doctrine: one
codebase, two postures, switched by env, never forked).

```
Postgres 16      firm privacy-program data      db
migrator         prisma migrate deploy + first-boot seed (one-shot)
Next.js app      the SAME app the cloud runs    app  → http://localhost:8485
```

Posture differences from cloud, all env-driven:

- **Auth:** local credentials login (email, no password, no external
  services) via `NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true`. Google OAuth and
  Resend magic links are cloud-tier options, off by default.
- **Stripe:** off. The $9 modules are the cloud tier; the app boots and
  functions fully with empty `STRIPE_*` vars.
- **AI:** one door only — `LLM_GATEWAY_URL` / `LLM_GATEWAY_KEY` /
  `LLM_MODEL_ALIAS` (any OpenAI-compatible endpoint, e.g. LQ.AI's gateway).
  Empty = AI narrative generation is a clean no-op.
- **Brand:** `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_ACCENT`,
  `NEXT_PUBLIC_BRAND_LOGO_URL` (plus the fine-grained `NEXT_PUBLIC_COLOR_*`
  set in `src/config/brand.ts`). Same UI, your name on it — no clones.

## First run

```sh
cd deploy/sovereign
cp .env.example .env       # set POSTGRES_PASSWORD, NEXTAUTH_SECRET, PUBLIC_URL
chmod 600 .env
docker compose up -d --build
docker compose logs migrator   # wait for "[migrate] done."
open http://localhost:8485
```

Sign in at `/sign-in` with the local login box (any email creates an
account; the seed also provides `demo@privacysuite.example` with a demo
organization attached). Port 8485 is the suite convention for DPO Central
(change `PORT` in `.env` if it collides with something on your host).

## Day-2 operations

- **Schema after `git pull`:** `docker compose run --rm migrator` — applies
  any new committed migrations (`prisma migrate deploy`; installs created
  before the migrations era are baselined automatically). The seed is
  skipped once the instance has users.
- **Health:** `GET /api/health` returns `200 {status:"ok"}` when the app and
  database are up (503 when the DB is unreachable); the compose file wires
  it as the app container's healthcheck, so `docker compose ps` shows real
  readiness.
- **DSAR retention auto-redaction:** the `redaction-cron` service triggers
  `/api/cron/dsar-redaction` daily. Set `CRON_SECRET` in `.env` (openssl
  rand -hex 32) — with it empty, the endpoint refuses to run (fails closed)
  and the cron container logs a warning instead.
- **Rebuild after an update or brand/posture change:**
  `docker compose up -d --build app`. All `NEXT_PUBLIC_*` vars are baked in
  at build time — editing them in `.env` without a rebuild does nothing.
- **Backups:** `./backup.sh` — encrypted (AES-256) pg_dump, 14-day local
  retention, optional off-machine push via `BACKUP_RCLONE_REMOTE`. Set
  `BACKUP_PASSPHRASE` in `.env`. Schedule daily:
  `crontab -e` → `15 3 * * * cd <this dir> && ./backup.sh >> backups/backup.log 2>&1`
  (No storage volume: DPO Central keeps everything in Postgres.)
- **Restore:** `./restore.sh <db.enc>` — wipes the target instance and
  restores (type RESTORE to confirm).

## Sync & travel replica (cloud + local copies)

**Local is primary.** The replica is this same compose stack elsewhere,
seeded with `./restore.sh` from the latest backup, one active side at a
time. Two-way merge of concurrent edits is deliberately unsupported.

## Hardening (beyond localhost)

Apply your firm's standard host-hardening checklist (firewall, SSH keys
only, unattended security updates, disk encryption). The DPO Central
specifics:

1. **Network:** default `BIND_ADDR=127.0.0.1` needs nothing. Office LAN:
   `BIND_ADDR=0.0.0.0` + firewall the box to the office subnet. Never expose
   8485 to the internet raw.
2. **TLS:** `TLS_DOMAIN=dpo.firm.example`, `PUBLIC_URL=https://dpo.firm.example`,
   then `docker compose --profile tls up -d --build app` (PUBLIC_URL is baked
   into the app). Public DNS → Let's Encrypt; LAN hostname → Caddy internal CA.
3. **Auth:** the local login creates an account for ANY email typed into it —
   that is fine behind 127.0.0.1 or a firewalled LAN, and exactly why this
   port must never face the internet. For a public-facing replica, disable it
   (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED=false`) and use the Resend/Google
   cloud-tier options instead.
4. **Secrets:** `chmod 600 .env`. Rotating `NEXTAUTH_SECRET` signs everyone
   out (JWT sessions) — rotate deliberately.
5. **Data:** nightly `./backup.sh` on cron; quarterly, actually run
   `./restore.sh` somewhere disposable. An untested backup is a hope, not a
   backup.
6. **Updates:** `git pull` → `docker compose run --rm migrator` →
   `docker compose up -d --build app`. Images are version-pinned; bump
   deliberately, snapshot a backup first.

## Notes & limits

- Single-firm posture. The demo organization (`Acme Corporation (Demo)`) is
  seeded for orientation; real work goes in your own organization.
- The premium modules (`@dpocentral/premium-skills`, `@dpocentral/security`)
  are private packages and are not part of this build — the app's loaders
  degrade to open-source defaults automatically.
- License: AGPL-3.0-or-later (see repo LICENSE) — self-hosting your own
  instance is exactly the intended use.

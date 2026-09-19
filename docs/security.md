# Security by posture: hosted service and self-hosted bundle

`SECURITY.md` at the repository root is the policy: how to report a
vulnerability, which versions receive fixes, what the code enforces, and the
numbered known gaps. This document is the operating side. It separates the two
postures the same code runs in, and says for each one who is responsible for
what and what must be configured. Dated 19 September 2026.

The code is the same in both postures. Every difference below comes from
environment variables and from who runs the machine, never from a separate
branch.

## Who is responsible for what

| Area | Hosted service | Self-hosted bundle (`deploy/sovereign`) |
|---|---|---|
| Machine, operating system, network | The hosting platform | The firm that installs it |
| Database, its backups and restores | The managed database provider (point-in-time restore); the maintainer decides a restore | The firm: `backup.sh` and `restore.sh`, on the firm's schedule |
| Application updates | The maintainer: every merge to `main` deploys | The firm: `./suite.sh update` or `docker compose pull`, when it chooses |
| Schema changes | Applied by the hosted build (`prisma migrate deploy`) | Applied by the one-shot migrator on the next boot |
| Secrets | Platform environment, set by the maintainer | `.env` beside the compose file, set by the firm (`chmod 600`) |
| Who can sign in | Anyone with a Google account or an e-mail address | Whoever reaches the port; the firm's network is the outer gate |
| Data it is meant to hold | Demonstration and training data only: no security certification, not for real client data | The firm's real records |

## Hosted service

**Sign-in.** Google OAuth and e-mail magic links. The passwordless local
provider must stay off: `NEXT_PUBLIC_LOCAL_AUTH_ENABLED` is not set in the
hosted environment. Nothing in the build refuses it if it were set (known gap
3 in `SECURITY.md`), so this is a configuration rule the maintainer keeps.

**Session cookie.** Shared with the other suite apps through
`AUTH_COOKIE_DOMAIN=".todo.law"`. This is the only posture where that variable
is set.

**Pilot limits.** One organisation per account, 90 days of editing from the
organisation's first sign-in, then read-only with export, and a records
ceiling per organisation (`src/server/services/pilot/caps.ts`). These limits
exist because the hosted service is a shared demonstration, not a place for
client data.

**Scheduled work.** The platform cron calls `/api/cron/dsar-redaction` daily
with `CRON_SECRET`. Without the secret the route refuses to run.

**Rate limits.** Counters are per function instance (see `SECURITY.md`), so
the real ceiling is higher than the configured one when the platform runs
several instances.

**Checklist for the maintainer**

- `NEXT_PUBLIC_LOCAL_AUTH_ENABLED` absent; `NEXTAUTH_SECRET`, `CRON_SECRET`
  and `DPC_IMPORT_API_KEYS` set; `ADMIN_EMAILS` limited to the maintainers.
- `DATABASE_URL` points at this app's own database, never at a shared one.
- A restore from the provider's point-in-time history is rehearsed on a
  branch database once a quarter and the date recorded.
- The CI audit gate (`npm audit --audit-level=high`) is green before merging.

## Self-hosted bundle

**Sign-in.** The local passwordless provider is on by default
(`NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true`): anyone who can reach the port can
sign in with any e-mail address. That is acceptable on `127.0.0.1` or a
firewalled office network and nowhere else. An instance reachable from the
internet must turn it off and use Google or e-mail sign-in instead
(`deploy/sovereign/README.md`, Hardening).

**Session cookie.** Host-only, with names prefixed by the app, so the sibling
suite apps on the same machine cannot overwrite it. Leave `AUTH_COOKIE_DOMAIN`
unset.

**Transport.** Plain HTTP on localhost by default. For office-network or
server use, start the TLS profile (Caddy) so the traffic and the client
address used by the rate limits come from a trusted proxy.

**No limits, no phone-home.** The pilot limits do not apply. Premium modules
are unlocked by Ed25519-signed licence files verified offline; the instance
reports to nobody.

**Backups.** `./backup.sh` writes an AES-256 encrypted `pg_dump`
(`BACKUP_PASSPHRASE` in `.env`). Keep the passphrase outside the machine: a
backup cannot be restored without it. `./restore.sh` wipes the instance and
restores a backup.

**Checklist for the firm**

- The port is not reachable from the internet, or the local provider is off.
- `.env` is `chmod 600` and holds a generated `NEXTAUTH_SECRET` and
  `CRON_SECRET`.
- `backup.sh` runs nightly; once a quarter a backup is restored on a
  disposable machine and the date recorded.
- Take a backup before every update; updates are forward-only (see
  `docs/migrations.md`).

## Where each topic lives

| Topic | Document |
|---|---|
| Reporting, supported versions, enforced controls, known gaps | `SECURITY.md` |
| Every environment variable, by name | `docs/secrets-inventory.md` |
| Capacity and what breaks first | `docs/capacity.md` |
| Schema changes and upgrade rehearsal | `docs/migrations.md` |
| Installing and hardening the bundle | `deploy/sovereign/README.md` |

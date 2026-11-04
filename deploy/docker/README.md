# DPO Central community edition: Docker install

The whole stack on your own machine or server, with one command:

```
PostgreSQL 16    the privacy-program data                       db
migrator         prisma migrate deploy + seed (one-shot)        migrator
Next.js app      DPO Central                                    app  -> http://localhost:8485
cron             daily rights-request redaction and reminders   cron
Caddy            optional TLS (profile "tls")                   tls
```

## First run

```sh
cd deploy/docker
cp .env.example .env       # set POSTGRES_PASSWORD, NEXTAUTH_SECRET, PUBLIC_URL
chmod 600 .env
docker compose up -d --build
docker compose logs migrator   # wait for "[migrate] done."
open http://localhost:8485
```

Sign in at `/sign-in` with the local sign-in box (any e-mail address creates
an account) and create your organization. Then, in Settings, choose where it
operates: the laws of those places set the deadlines for rights requests and
breach notifications.

No sample data is seeded. For an evaluation instance only, set
`DEMO_SEED=true` in `.env` before the first boot to get a sample
organization. Change `PORT` in `.env` if 8485 is taken on your host.

## Day-to-day operations

- **After an update** (`git pull`): `docker compose run --rm migrator` applies
  any new migrations, then `docker compose up -d --build app` rebuilds the app.
- **Settings that start with `NEXT_PUBLIC_`** are built into the app: after
  changing one in `.env`, rebuild with `docker compose up -d --build app`.
- **Health:** `GET /api/health` returns `200 {status:"ok"}` when the database
  answers within 2 seconds and its last applied migration is the app's last
  migration; otherwise `503`. The compose file uses it as the app's
  healthcheck, so `docker compose ps` shows real readiness.
- **Daily jobs:** the `cron` service calls `/api/cron/dsar-redaction` (removes
  the personal data of closed rights requests after the retention period set
  on the request form) and `/api/cron/dsar-reminders` (deadline reminder
  e-mails, sent only when `RESEND_API_KEY` is set). Set `CRON_SECRET` in `.env`
  (`openssl rand -hex 32`); with it empty the endpoints refuse to run and the
  service logs a warning.
- **Backups:** `./backup.sh` writes an encrypted (AES-256) database dump and
  keeps the newest 14; `BACKUP_RCLONE_REMOTE` pushes each one off the machine.
  Set `BACKUP_PASSPHRASE` in `.env`. To run it daily:
  `crontab -e` -> `15 3 * * * cd <this folder> && ./backup.sh >> backups/backup.log 2>&1`
  (DPO Central keeps everything in PostgreSQL: there is no file volume.)
- **Restore:** `./restore.sh <backup file>` wipes this instance and restores
  the backup (type RESTORE to confirm).

## Hardening (beyond localhost)

Apply your usual host-hardening checklist (firewall, SSH keys only, security
updates, disk encryption). Specific to DPO Central:

1. **Network:** the default `BIND_ADDR=127.0.0.1` keeps the app on this
   machine. For an office network: `BIND_ADDR=0.0.0.0` and a firewall that
   admits only that network. Never expose port 8485 to the internet directly.
2. **TLS:** set `TLS_DOMAIN=dpo.example.com` and
   `PUBLIC_URL=https://dpo.example.com`, then
   `docker compose --profile tls up -d --build app`. A public DNS name gets a
   Let's Encrypt certificate; a LAN name gets Caddy's internal CA.
3. **Sign-in:** the local sign-in creates an account for any e-mail address
   typed into it. That is acceptable on 127.0.0.1 or a firewalled network, and
   the reason the port must never face the internet. For an instance reachable
   from outside, switch it off (`NEXT_PUBLIC_LOCAL_AUTH_ENABLED=false`) and use
   e-mail links (Resend) or Google sign-in with your own OAuth client.
4. **Secrets:** `chmod 600 .env`. Changing `NEXTAUTH_SECRET` signs everyone
   out.
5. **Data:** run `./backup.sh` every night, and test `./restore.sh` on a
   spare machine from time to time.

## License

AGPL-3.0-or-later (see the LICENSE file at the root of the repository).

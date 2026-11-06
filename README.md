# DPO Central community edition

Open-source software for the records a privacy program runs on, for data
protection officers and the people who support them. You install it and run
it yourself. English and Spanish throughout.

- **Data inventory**: systems, data elements, processing activities, data
  flows and a data map; cross-border transfers with their mechanism and
  status.
- **Records of processing (GDPR Art. 30)**: the controller record and the
  processor record, exported as PDF, CSV, XLSX or JSON.
- **Rights requests (DSAR)**: a public request form per organization,
  deadlines by jurisdiction, tasks, messages, and redaction of personal data
  after a retention period you set.
- **Vendors**: vendor register, contracts and periodic reviews.
- **Breach register**: incidents, timelines and notification deadlines by
  jurisdiction.
- **Organizations**: members with five roles (owner, administrator, privacy
  officer, member, viewer), departments, and an audit trail.

## Install with Docker (recommended)

Requires Docker with Compose. The stack is PostgreSQL, a one-shot migrator
and the app:

```sh
cd deploy/docker
cp .env.example .env       # set POSTGRES_PASSWORD, NEXTAUTH_SECRET, PUBLIC_URL
chmod 600 .env
docker compose up -d --build
docker compose logs -f migrator   # wait for "[migrate] done."
```

Then open <http://localhost:8485>, sign in with any e-mail address in the
local sign-in box and create your organization. The details, backups and a
hardening guide are in [deploy/docker/README.md](deploy/docker/README.md).

The default local sign-in has no password: anyone who can reach the app can
sign in. Keep it on your own machine or a network you trust, or switch it
off and use e-mail links or Google sign-in (see `.env.example`).

## Run with Node.js (development or a plain server)

Requires Node.js 20.9 or later and PostgreSQL 16 (the included
`docker-compose.yml` starts one on port 5434).

```sh
npm ci
docker compose up -d              # PostgreSQL for development, port 5434
cp .env.example .env              # the defaults match that database
npx prisma migrate deploy         # create the tables
npm run db:seed                   # the jurisdiction catalogue
npm run dev                       # http://localhost:3001
```

For a production server: `npm run build` and `npm start`, with
`NODE_ENV=production`, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` set. Add
`DEMO_SEED=true` to the seed command for a sample organization.

Quality checks: `npm run typecheck`, `npm run lint`, `npm test` and
`npm run build`.

## Configuration

Every setting is an environment variable, listed with an explanation in
[.env.example](.env.example). An empty optional setting switches its
feature off; the app never needs an outside service to start. Sign-in can
use the local passwordless form, e-mail links (a Resend key) or your own
Google OAuth client. The deadline reminders and the redaction of closed
rights requests run from two routes that a daily job calls with
`CRON_SECRET` (the Docker stack includes that job).

## Security

See [SECURITY.md](SECURITY.md) for what this edition enforces, and how to
report a vulnerability.

## Other ways to run it

[todo.law](https://www.todo.law) offers the same software in other forms: a
consultant mode for professionals who manage privacy for several clients, an
isolated instance run for you, and a licensed self-hosted build with every
module.

## License

AGPL-3.0-or-later, see [LICENSE](LICENSE). Copyright (C) 2025-2026
Rindogatan LLC. If you run a modified version as a network service, the
AGPL (section 13) requires you to offer its users the corresponding source of
your version; set `NEXT_PUBLIC_SOURCE_URL` to where it is published, and the
licence page (`/licenses`) links to it.

Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md).

## Not legal advice

DPO Central ships jurisdiction deadlines and compliance workflows as a
starting point. They are informational tools, not legal advice; laws change
and their application depends on the facts. Verify outputs with qualified
counsel before relying on them.

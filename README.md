# DPO Central

Open-source privacy-program management for data protection officers and the
firms that advise them. One place for the records and workflows a privacy
program actually runs on:

- **Data inventory / RoPA** — processing activities, assets, data flows
  (GDPR Art. 30 records)
- **DSARs** — a public, brandable intake portal per organization, deadline
  tracking by jurisdiction, task workflow, communications log, and
  retention-based PII auto-redaction
- **Assessments** — DPIA, Legitimate Interest (LIA), and Transfer Impact
  (TIA) templates with scoring
- **Incidents** — breach register, timelines, notification deadline tracking
- **Vendors** — contracts, DPAs, a vendor questionnaire, and a starter
  catalog of common processors (a starting point, not an audit — assess
  before relying)
- **AI governance** — AI system register with risk classification
- **Multi-tenant** — organizations with five-tier role-based access; full
  English and Spanish localization

## Install (self-hosted, recommended)

The supported install is the Docker bundle in
[`deploy/sovereign/`](deploy/sovereign/README.md) — Postgres + one-shot
migrator + the app, with generated secrets, first-boot seeding, encrypted
backups, and a hardening guide:

```sh
cd deploy/sovereign
cp .env.example .env       # set POSTGRES_PASSWORD, NEXTAUTH_SECRET, PUBLIC_URL
docker compose up -d --build
open http://localhost:8485
```

Read the hardening section of that README before exposing an instance
beyond localhost — the default sovereign login is passwordless by design
and is only appropriate on trusted networks.

## Development setup

Requires Node.js >= 20.9 and Docker (for the dev database).

```sh
npm install
docker compose up -d              # dev Postgres on localhost:5434
cp .env.example .env.local        # defaults match the dev database
npx prisma db push
npm run db:seed                   # demo org, templates, starter vendor catalog
npm run dev                       # http://localhost:3001
```

`npm run lint`, `npm test`, and `npm run build` are the local quality
gates; CI runs the same three.

## Deployment postures

One codebase, two postures, switched by environment only:

- **Sovereign** (self-hosted): local passwordless auth, no Stripe, optional
  OpenAI-compatible LLM gateway, your brand via `NEXT_PUBLIC_BRAND_*`.
- **Cloud**: Google OAuth / magic links, Stripe-gated premium modules.

If a feature's environment variables are empty, the feature is a clean
no-op — the app never requires an external service to boot.

## Security

See [SECURITY.md](SECURITY.md) for an honest statement of what this build
enforces (and what it does not), plus the responsible-disclosure address.

## License

AGPL-3.0-or-later — see [LICENSE](LICENSE). If you run a modified version
of DPO Central as a network service, the AGPL (section 13) requires you to
offer its users the corresponding source of your modified version.

## Not legal advice

DPO Central ships templates, jurisdiction deadlines, and compliance
workflows as a starting point. They are informational tools, not legal
advice; laws change and their application is fact-specific. Verify outputs
with qualified counsel before relying on them.

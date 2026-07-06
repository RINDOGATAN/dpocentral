# Contributing to DPO Central

Thanks for considering a contribution. This document covers the practical
ground rules.

## Ground rules

- **License**: DPO Central is AGPL-3.0-or-later. By contributing you agree
  your contribution is licensed under the same terms. Do not submit code
  you don't have the right to license this way.
- **Security issues**: never open a public issue for a vulnerability —
  email **support@rindogatan.com** (see [SECURITY.md](SECURITY.md)).
- **Legal content** (jurisdiction data, templates, deadlines): cite your
  source in the PR description (statute, regulator guidance, official
  gazette). Uncited legal-content changes will not be merged. The single
  source of truth for operative jurisdiction numbers is
  `src/config/jurisdiction-data.ts` — do not fork deadlines into other
  files.

## Development setup

See the [README](README.md#development-setup). Short version: Node >= 20.9,
`docker compose up -d` for the dev database, `npx prisma migrate dev`,
`npm run db:seed`, `npm run dev`.

## Before you open a PR

All three gates must pass locally — CI runs the same:

```sh
npm run lint
npm test
npm run build
```

- **Schema changes** must come with a migration (`npx prisma migrate dev
  --name <change>`) — never a bare edit to `schema.prisma`.
- **Multi-tenancy**: every org-scoped query must filter by
  `ctx.organization.id`; every mutation must use the correct procedure
  level (`writerProcedure` / `officerProcedure` / `adminOrgProcedure` — see
  `src/server/trpc.ts`). Tests in `tests/` enforce the known regressions;
  add one for any new org-scoped surface.
- **i18n**: `src/messages/en.json` and `es.json` must keep exact key
  parity. If you add a key to one, add it to both (machine-translated
  Spanish is acceptable in a PR; flag it for native review).
- **Posture doctrine**: one codebase, two postures (cloud / sovereign),
  switched by environment only. No hosted-service hardcodes in shipped
  code; a feature whose env vars are empty must be a clean no-op.

## Commit style

Plain, descriptive messages in the imperative ("security: scope member
lookups to caller org"), body explaining *why* when it isn't obvious.

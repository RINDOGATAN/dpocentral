# Contributing to DPO Central

Thanks for considering a contribution. This document covers the practical
ground rules.

## Ground rules

- **Licensing**: this project is published under **AGPL-3.0-or-later**, and
  Rindogatan also offers it under a separate commercial licence. So that both
  are possible, every contribution is covered by the
  [Contributor License Agreement](CLA.md) and certified per commit with the
  [Developer Certificate of Origin](DCO.txt). Do not submit code you don't have
  the right to license this way.
- **Security issues**: never open a public issue for a vulnerability —
  email **support@rindogatan.com** (see [SECURITY.md](SECURITY.md)).
- **Legal content** (jurisdiction data, templates, deadlines): cite your
  source in the PR description (statute, regulator guidance, official
  gazette). Uncited legal-content changes will not be merged. The single
  source of truth for operative jurisdiction numbers is
  `src/config/jurisdiction-data.ts` — do not fork deadlines into other
  files.

## Licensing your contribution

Two things travel with every contribution:

1. **Sign off each commit (DCO).** Add `Signed-off-by: Your Name
   <you@example.com>` to every commit — `git commit -s` does it for you. This
   certifies you wrote the code or have the right to submit it (see
   [DCO.txt](DCO.txt)). Use your real name.
2. **Sign the CLA once.** The first time you open a PR, accept the
   [Contributor License Agreement](CLA.md): add your name to [AUTHORS](AUTHORS)
   in the same PR and state in the PR description that you have read and accept
   the CLA. The CLA grants Rindogatan the relicensing right that makes the dual
   licence (AGPL + commercial) possible. You keep the copyright to your work; it
   is a licence, not an assignment. Contributing on behalf of an employer? Have
   them execute a Corporate CLA (email legal@rindogatan.com).

PRs without a DCO sign-off, or from a contributor who has not accepted the CLA,
cannot be merged.

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

## SPDX headers

Every source file carries a machine-readable licence header as its first lines
(after a shebang or a `"use client"` / `"use server"` directive, if present):

```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
```

New source files must include it. These headers survive copy-paste into other
codebases and make the licence and its owner unambiguous. Do not remove or alter
them. `scripts/add-spdx-headers.mjs` adds the header to any file missing it.

## Commit style

Plain, descriptive messages in the imperative ("security: scope member
lookups to caller org"), body explaining *why* when it isn't obvious.

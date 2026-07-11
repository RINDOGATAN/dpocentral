# Notices — third-party components and provenance

DPO Central is © 2025–2026 Rindogatan LLC, licensed AGPL-3.0-or-later
(see [LICENSE](LICENSE)). It builds on the following third-party work.
npm dependency licenses are declared in each package's manifest under
`node_modules/` after install; the table lists the components that are
vendored, embedded, or foundational.

| Component | Use | License |
|---|---|---|
| Next.js, React | application framework | MIT |
| Prisma + @prisma/client | ORM / migrations | Apache-2.0 |
| tRPC, TanStack Query/Table | API and data layer | MIT |
| NextAuth (next-auth, @auth/prisma-adapter) | authentication | ISC |
| Radix UI primitives | UI primitives | MIT |
| shadcn/ui patterns (`src/components/ui/*`) | component code generated into this repo, modified | MIT |
| Tailwind CSS v4 | styling | MIT |
| lucide-react | icons | ISC |
| Zod, superjson, date-fns, clsx, class-variance-authority, tailwind-merge | utilities | MIT |
| @react-pdf/renderer | PDF generation | MIT |
| @resvg/resvg-js | server-side SVG rasterizing (flow diagrams) | MPL-2.0 |
| @hpcc-js/wasm-graphviz | flow-graph layout (WASM) | Apache-2.0 |
| @xyflow/react + elkjs | data-flow diagrams | MIT / EPL-2.0 |
| Inter font (vendored, `src/server/services/export/fonts/`) | PDF text rendering | SIL OFL 1.1 |
| Noto Sans font (vendored, same dir, Latin subset) | PDF text rendering | SIL OFL 1.1 |
| Jost, Archivo Black fonts | web UI (self-hosted at build via `next/font`) | SIL OFL 1.1 |
| next-intl | localization | MIT |
| Stripe SDK | payments (cloud posture only) | MIT |
| PostgreSQL 16 (Docker images) | database (deploy bundles) | PostgreSQL License |
| Caddy (optional `tls` compose profile) | TLS termination | Apache-2.0 |

## Data provenance

- `vendors/catalog-snapshot.json` — the global vendor catalog, generated from
  vendor.watch (the catalog system of record) in the same shape as its live
  `/catalog/sync` payload and refreshed per release. Entries are compiled from
  public sources; where vendor.watch's pipeline has assessed a vendor its
  compliance fields are populated, otherwise they are **not assessed** (`null`).
  A fresh install seeds from this snapshot; between releases it can be topped up
  via `db:sync-vendor-catalog`. See `docs/vendor-data-sourcing.md`.
- Jurisdiction data (`src/config/jurisdiction-data.ts`,
  `src/config/jurisdiction-catalog.ts`) — editorial summaries of public
  legislation, maintained by hand; each correction should cite its source
  in the commit message (see CONTRIBUTING.md).

## Amending this file

Add a row when a dependency is vendored/embedded (not merely listed in
package.json), when a font or dataset ships in the repo, or when license
terms require attribution. Keep entries alphabetically grouped by area and
state: component, how it is used, license.

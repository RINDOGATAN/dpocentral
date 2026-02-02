# Privacy Suite

Next.js 16 + tRPC + Prisma + PostgreSQL + NextAuth

## Modules
- **Data Inventory** - Assets, elements, processing activities (ROPA)
- **DSAR** - Subject access requests, SLA tracking, public portal
- **Assessments** - DPIA/PIA/TIA/Vendor with templates & approvals
- **Incidents** - Breach tracking, DPA notifications, timeline
- **Vendors** - Contracts, questionnaires, risk tiers

## Structure
```
prisma/schema.prisma          # ~25 models
src/server/routers/privacy/   # tRPC routers (org, dataInventory, dsar, assessment, incident, vendor)
src/app/(dashboard)/privacy/  # Dashboard pages
src/app/dsar/                 # Public DSAR portal
```

## Multi-tenancy
All models have `organizationId`. Use `organizationProcedure` for org-scoped routes.

Demo org: `demo` slug, user: `demo@privacysuite.example`

## Commands
```bash
npm run dev                    # Port 3001
npx prisma db seed             # Seed jurisdictions, templates, demo data
npm run db:studio              # Prisma Studio
```

## Roles
OWNER > ADMIN > PRIVACY_OFFICER > MEMBER > VIEWER

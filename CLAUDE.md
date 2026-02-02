# Privacy Suite

Privacy Program Management Suite - A comprehensive 5-block privacy management system.

**Stack:** Next.js 16 | TypeScript | tRPC | PostgreSQL + Prisma | NextAuth

## Modules

1. **Data Inventory** - Data assets, elements, processing activities (ROPA), data flows, transfers
2. **DSAR Management** - Data subject access requests with SLA tracking, public intake portal
3. **Assessment Automation** - DPIA/PIA/TIA/Vendor assessments with templates, scoring, approvals
4. **Incident Management** - Breach tracking, notifications, timeline, response tasks
5. **Vendor Management** - Third-party vendors, contracts, questionnaires, risk tiers

## Key Paths

```
prisma/schema.prisma                    # Data model (~25 models)
src/server/trpc.ts                      # tRPC setup with org context middleware
src/server/routers/                     # tRPC routers
src/server/routers/privacy/             # Privacy-specific routers
  - organization.ts                     # Org CRUD, members, jurisdictions
  - dataInventory.ts                    # Assets, elements, activities, flows
  - dsar.ts                             # Requests, tasks, communications, SLA
  - assessment.ts                       # Templates, assessments, approvals
  - incident.ts                         # Incidents, notifications, timeline
  - vendor.ts                           # Vendors, contracts, questionnaires
src/app/(dashboard)/privacy/            # Dashboard pages
src/app/dsar/                           # Public DSAR portal
```

## Quick Reference

**Multi-tenancy:** All privacy models include `organizationId`. Use `organizationProcedure` in routers.

**Jurisdictions:** GDPR (30d DSAR, 72h breach), CCPA (45d), LGPD (15d), etc.

**Risk Levels:** LOW, MEDIUM, HIGH, CRITICAL

**DSAR Types:** ACCESS, RECTIFICATION, ERASURE, PORTABILITY, OBJECTION, RESTRICTION

**Assessment Types:** DPIA, PIA, TIA, LIA, VENDOR, CUSTOM

**Incident Severity:** LOW, MEDIUM, HIGH, CRITICAL

## Commands

```bash
npm install                              # Install dependencies
npm run dev                              # Start dev server (port 3001)
npx prisma generate && npx prisma db push  # Schema changes
npx prisma db seed                       # Seed jurisdictions & templates
npm run db:studio                        # Open Prisma Studio
```

## Environment

```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM=noreply@yourdomain.com
```

## Organization Roles

- **OWNER** - Full access, can delete org
- **ADMIN** - Manage members, settings
- **PRIVACY_OFFICER** - Manage all privacy features
- **MEMBER** - Standard access
- **VIEWER** - Read-only access

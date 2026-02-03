# Privacy Suite

Next.js 16 + tRPC + Prisma + PostgreSQL + NextAuth

**Production**: https://privacysuite-ten.vercel.app

## Modules
- **Data Inventory** - Assets, elements, processing activities, data flow visualization
- **DSAR** - Subject access requests, SLA tracking, public portal
- **Assessments** - DPIA/PIA/TIA/Vendor with templates & approvals
- **Incidents** - Breach tracking, DPA notifications, timeline
- **Vendors** - Contracts, questionnaires, risk tiers

## Structure
```
prisma/schema.prisma          # ~25 models
src/server/routers/privacy/   # tRPC routers
src/app/(dashboard)/privacy/  # Dashboard pages
src/app/dsar/                 # Public DSAR portal
scripts/                      # Verification & testing scripts
```

## Multi-tenancy
All models have `organizationId`. Use `organizationProcedure` for org-scoped routes.

Demo org: `demo` slug, user: `demo@privacysuite.example`

## Commands
```bash
npm run dev                    # Local dev (port 3001)
npx prisma db seed             # Seed demo data
npm run db:studio              # Prisma Studio
python3 scripts/verify-app.py  # Run verification agent
```

## Auth
- Google OAuth + Email Magic Link (Resend)
- Callback: `/api/auth/callback/google`

## Roles
OWNER > ADMIN > PRIVACY_OFFICER > MEMBER > VIEWER

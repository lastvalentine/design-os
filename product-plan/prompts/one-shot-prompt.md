# One-Shot Implementation Prompt

Use this prompt when working with a coding agent to implement the Feel August Platform.

---

## Full Backend Implementation

For implementing the complete backend (infrastructure, services, database):

```
I need you to implement the **Feel August Platform clinical operations backend** —
a HIPAA-compliant data sync system for a telehealth psychiatry clinic.

**Context:**
- This replaces a fragile Google Sheets pipeline with proper cloud infrastructure
- DrChrono is the EHR (source of truth), Coda is the staff UI
- Deep Cura provides AI-extracted clinical notes via encrypted webhooks
- See the attached product-overview.md for full context

**Before you begin, please confirm:**

1. **GCP project setup** — Do you have a GCP project ready with BAA signed?
2. **Deployment approach** — Terraform for infrastructure? Cloud Build for CI/CD?
3. **Service preferences** — Express.js vs Hono? pnpm vs npm?
4. **DrChrono API access** — Do you have OAuth credentials ready?

**Implementation Order:**

1. **Infrastructure** — Set up VPC, Cloud SQL, IAM, Pub/Sub using `infrastructure/gcp-setup.md`
2. **Database** — Deploy schema using `database/schema.sql`
3. **DrChrono Sync Service** — Build using `backend/drchrono-sync.md`
4. **Coda Push Service** — Build using `backend/coda-push.md`
5. **Cutover** — Disable Google Sheets, verify data integrity

**Key files to reference:**
- `database/schema.sql` — Complete PostgreSQL DDL
- `backend/drchrono-sync.md` — Sync service implementation
- `backend/coda-push.md` — Coda push implementation
- `integrations/drchrono-api.md` — DrChrono API reference
- `integrations/deepcura-api.md` — Deep Cura Gridhook decryption
- `compliance/success-criteria.md` — What "done" looks like

**Tech stack:**
- Node.js 20, Express.js or Hono, Zod, raw SQL with pg library
- GCP: Cloud Run, Cloud SQL (Postgres 16), Pub/Sub
- Terraform for infrastructure

Phase 1 is complete when all patients/appointments are synced, webhooks flow
through the new pipeline, Coda receives data from Postgres, and audit logs
capture all changes.
```

---

## Admin Dashboard Only

For implementing just the monitoring dashboard (when backend already exists):

```
I need you to implement **the admin dashboard** for the Feel August Platform.

**Context:**
- This is a monitoring dashboard for a healthcare data sync system
- Shows sync health, errors, and manual action triggers
- Uses Google Cloud IAP for authentication
- See attached product-overview.md for full context

**Before you begin, please ask me:**

1. **Tech stack**: What frameworks? (Components assume React 18+, TypeScript, Tailwind CSS v4)
2. **Authentication**: How to handle auth? (Mock for dev? Real IAP? Other?)
3. **Backend API**: REST endpoints built? Mock data?
4. **Routing**: React Router? Next.js? Other?
5. **State management**: React Context? Zustand? React Query?

**Once I answer, implement:**

1. Application shell with sidebar navigation
2. Overview Dashboard with service health cards
3. Sync Logs view with filtering and pagination
4. Errors view with severity grouping and Deep Cura notes table
5. Actions view with confirmation modals
6. Auto-refresh (30-60 second intervals)
7. Role-based UI visibility

**Design tokens:**
- Primary: `amber` (Tailwind)
- Neutral: `slate` (Tailwind)
- Fonts: Inter (headings/body), JetBrains Mono (code/timestamps)
- Dark mode support required

**Key files:**
- `instructions/one-shot-instructions.md` — Complete implementation guide
- `sections/monitoring-compliance/types.ts` — TypeScript interfaces
- `sections/monitoring-compliance/data.json` — Sample data for testing
- `sections/monitoring-compliance/tests.md` — Test plan
- `shell/components/` and `sections/monitoring-compliance/components/` — React components

All components are props-based. Follow the TypeScript types and component patterns provided.
```

---

## Incremental Implementation

For step-by-step implementation, use `section-prompt.md` with the milestone-specific instructions from `instructions/incremental/`.

---

## What to Attach

When using these prompts, attach:

**For backend:**
- `product-overview.md`
- `database/schema.sql`
- Relevant backend guide (`backend/drchrono-sync.md`, etc.)
- Relevant integration guide (`integrations/drchrono-api.md`, etc.)

**For admin dashboard:**
- `product-overview.md`
- `instructions/one-shot-instructions.md`
- `sections/monitoring-compliance/types.ts`
- `sections/monitoring-compliance/data.json`

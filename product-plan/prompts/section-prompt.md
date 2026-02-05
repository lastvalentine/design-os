# Section Implementation Prompt Template

Use this template when implementing the platform incrementally, one milestone at a time.

---

## Backend Milestones

### Milestone 1: GCP Infrastructure

```
I need you to set up **GCP infrastructure** for the Feel August Platform.

**Context:**
- See attached product-overview.md for full context
- This is a HIPAA-compliant healthcare data platform
- BAA must be signed before storing any PHI

**For this milestone, implement:**

[Paste contents of `infrastructure/gcp-setup.md`]

**Completion criteria:**
- [ ] GCP project created with BAA signed
- [ ] Organization policies applied
- [ ] VPC with Private Service Connect configured
- [ ] Cloud SQL instance provisioned (private IP only)
- [ ] Service accounts created with least-privilege roles
- [ ] Secret Manager secrets created
- [ ] Pub/Sub topics and subscriptions configured
```

---

### Milestone 2: Database Schema

```
I need you to deploy **the database schema** for the Feel August Platform.

**Context:**
- See attached product-overview.md for full context
- PostgreSQL 16 on Cloud SQL
- Must include audit triggers for HIPAA compliance

**For this milestone:**

1. Connect to Cloud SQL instance
2. Run the schema from `database/schema.sql`
3. Verify all tables created
4. Test audit triggers with sample INSERT/UPDATE/DELETE

**Schema file:** [Paste contents of `database/schema.sql`]

**Completion criteria:**
- [ ] All tables created
- [ ] Indexes applied
- [ ] Audit triggers functioning
- [ ] change_log populated on test operations
```

---

### Milestone 3: DrChrono Sync Service

```
I need you to implement **the DrChrono sync service** for the Feel August Platform.

**Context:**
- See attached product-overview.md for full context
- This service syncs data from DrChrono EHR to Postgres
- Also receives Deep Cura Gridhooks

**For this milestone, implement:**

[Paste contents of `backend/drchrono-sync.md`]

**API reference:** [Paste contents of `integrations/drchrono-api.md`]

**Completion criteria:**
- [ ] OAuth token refresh working
- [ ] Webhook signature verification working
- [ ] Patient sync working (webhook + full)
- [ ] Appointment sync working
- [ ] Deep Cura Gridhook decryption working
- [ ] Change events publishing to Pub/Sub
- [ ] Audit logs populated
```

---

### Milestone 4: Coda Push Service

```
I need you to implement **the Coda push service** for the Feel August Platform.

**Context:**
- See attached product-overview.md for full context
- This service pushes database changes to Coda tables
- Triggered by Pub/Sub events

**For this milestone, implement:**

[Paste contents of `backend/coda-push.md`]

**API reference:** [Paste contents of `integrations/coda-api.md`]

**Completion criteria:**
- [ ] Pub/Sub handler working
- [ ] Message deduplication working
- [ ] Coda upsertRows working
- [ ] Column mappings documented
- [ ] Batch handling for full syncs
```

---

## Admin Dashboard Milestones

### Milestone A: Foundation

```
I need you to set up **the project foundation** for the Feel August Platform admin dashboard.

**Context:**
- See attached product-overview.md for full context
- This is milestone 1 of 3 for the dashboard

**For this milestone, implement:**

[Paste contents of `instructions/incremental/01-foundation.md`]

**Completion criteria:**
- [ ] Project created with React + TypeScript
- [ ] Tailwind CSS v4 configured
- [ ] Google Fonts loading
- [ ] Types file copied
- [ ] Dark mode working
```

---

### Milestone B: Application Shell

```
I need you to implement **the application shell** for the Feel August Platform admin dashboard.

**Context:**
- See attached product-overview.md for full context
- This is milestone 2 of 3
- Foundation is complete: types, design tokens, project structure

**For this milestone, implement:**

[Paste contents of `instructions/incremental/02-shell.md`]

**Completion criteria:**
- [ ] Fixed left sidebar (240px)
- [ ] Collapsible sidebar with toggle
- [ ] Mobile hamburger menu
- [ ] Sync status indicator
- [ ] Navigation with active states
- [ ] Error badge on Errors nav item
```

---

### Milestone C: Monitoring & Compliance Section

```
I need you to implement **the Monitoring & Compliance section** for the Feel August Platform admin dashboard.

**Context:**
- See attached product-overview.md for full context
- This is milestone 3 of 3
- Shell is complete with sidebar navigation working

**For this milestone, implement:**

[Paste contents of `instructions/incremental/03-monitoring-compliance.md`]

**Test plan:**

[Paste contents of `sections/monitoring-compliance/tests.md`]

**Completion criteria:**
- [ ] Overview Dashboard with service health cards
- [ ] Sync Logs view with filtering
- [ ] Errors view with severity grouping
- [ ] Actions view with confirmation modals
- [ ] Auto-refresh working
- [ ] Role-based UI visibility working
```

---

## Tips for Incremental Implementation

1. **Complete prerequisites first** — Each milestone assumes prior milestones are done
2. **Test after each milestone** — Use the completion checklist
3. **Commit at milestone boundaries** — Clear save points
4. **Reference the types file** — Ensures consistency across milestones
5. **Follow the component patterns** — Props-based, no direct data imports

# Feel August Platform — Technical Specification

## For: Tech Lead / Engineering Team

**Version:** 1.0
**Date:** February 2026
**Status:** Ready for Implementation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Infrastructure](#infrastructure)
5. [Database Schema](#database-schema)
6. [Services](#services)
7. [API Integrations](#api-integrations)
8. [Security & Compliance](#security--compliance)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Development Workflow](#development-workflow)
11. [Phased Implementation](#phased-implementation)
12. [Testing Requirements](#testing-requirements)
13. [Operational Procedures](#operational-procedures)
14. [Reference Documents](#reference-documents)

---

## System Overview

### Purpose

Replace the existing Google Sheets + App Scripts data pipeline with a HIPAA-compliant cloud-native architecture. The system syncs clinical data from DrChrono (EHR) and Deep Cura (AI notes) into a PostgreSQL database, then pushes to Coda for staff workflows.

### Scope

This spec covers the **Clinical Operations Backend** — one of four planned application layers:

1. **Clinical Ops Backend** ← THIS SPEC
2. Patient API Gateway (future)
3. Website + Booking (separate codebase)
4. Policy Manager (future)

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| PostgreSQL as system of record | DrChrono is clinical truth, but we need a queryable local store with audit capabilities |
| `drchrono_id` as natural key | Eliminates row ID coupling, enables idempotent upserts |
| Event-driven architecture | Webhooks for real-time, reconciliation for reliability |
| Raw SQL (no ORM) | Maximum control for healthcare data, audit triggers, JSONB operations |
| Coda as replaceable UI layer | Future custom frontend reads same Postgres, no migration needed |

---

## Architecture

### High-Level Data Flow

```
┌─────────────────┐         ┌─────────────────┐
│    DrChrono     │         │    Deep Cura    │
│      (EHR)      │         │   (AI Notes)    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ Webhooks                  │ Gridhooks (AES-encrypted)
         │                           │
         ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│                    GCP (BAA-covered)                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              drchrono-sync (Cloud Run)             │  │
│  │                                                    │  │
│  │  POST /webhooks/drchrono   ← DrChrono events       │  │
│  │  POST /webhooks/deepcura   ← Deep Cura Gridhooks   │  │
│  │  POST /sync/*              ← Cloud Scheduler       │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│                         ▼                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │           Cloud SQL (PostgreSQL 16)                │  │
│  │                                                    │  │
│  │  patients, appointments, clinical_notes,           │  │
│  │  deepcura_notes, medications, problems,            │  │
│  │  allergies, insurance_records, line_items          │  │
│  │  ─────────────────────────────────────             │  │
│  │  intake_checklists, post_appointment_tasks,        │  │
│  │  prior_authorizations, questionnaire_responses     │  │
│  │  ─────────────────────────────────────             │  │
│  │  sync_log, change_log, access_log                  │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│                         │ Pub/Sub (change events)        │
│                         ▼                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │              coda-push (Cloud Run)                 │  │
│  │                                                    │  │
│  │  Receives change events, pushes to Coda via API   │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
└─────────────────────────│────────────────────────────────┘
                          │
                          ▼
                ┌─────────────────┐
                │      Coda       │
                │  (Staff UI)     │
                └─────────────────┘
```

### Service Topology

| Service | Runtime | Trigger | Min Instances |
|---------|---------|---------|---------------|
| `drchrono-sync` | Cloud Run | Webhooks, Scheduler | 1 (warm for webhooks) |
| `coda-push` | Cloud Run | Pub/Sub | 0 |
| `writeback-api` | Cloud Run | Coda automations | 0 |
| `admin-dashboard` | Cloud Run | User requests | 0 |

---

## Technology Stack

| Layer | Choice | Version | Notes |
|-------|--------|---------|-------|
| Language | TypeScript | 5.x | Strict mode enabled |
| Runtime | Node.js | 20 LTS | Cloud Run default |
| Framework | Express.js or Hono | Latest | Lightweight, well-understood |
| Validation | Zod | 3.x | Runtime type checking |
| Database | PostgreSQL | 16 | Cloud SQL managed |
| Query | pg (node-postgres) | 8.x | Raw SQL, no ORM |
| Cloud | GCP | - | BAA-covered |
| IaC | Terraform | 1.5+ | All infrastructure as code |
| CI/CD | Cloud Build | - | Dockerfile-based |
| Package Manager | pnpm | 8.x | Workspaces for monorepo |

### Why No ORM?

- Audit triggers require precise control over transactions
- JSONB operations are poorly abstracted by ORMs
- Healthcare data demands explicit query visibility
- Performance tuning requires raw SQL access

---

## Infrastructure

### GCP Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Cloud SQL | PostgreSQL database | db-custom-2-7680, 50GB SSD, private IP |
| Cloud Run | Stateless services | VPC connector, min 0-1 instances |
| Pub/Sub | Event messaging | DLQ enabled, 5 retry attempts |
| Cloud Scheduler | Periodic jobs | Every 15 minutes reconciliation |
| Secret Manager | Credentials | OAuth tokens, API keys |
| Cloud Storage | Audit log archive | 7-year retention |
| VPC | Network isolation | Private Service Connect |
| IAM | Access control | Workload Identity (no keys) |
| Cloud Monitoring | Observability | Custom dashboards, alerting |
| Security Command Center | Threat detection | Standard tier |

### Network Architecture

```
┌─────────────────────────────────────────────────────┐
│                 feel-august-vpc                      │
│                                                     │
│  ┌─────────────────┐    ┌─────────────────────┐    │
│  │  Cloud Run      │    │  Cloud SQL          │    │
│  │  Services       │◄───│  (Private IP)       │    │
│  │                 │    │  10.x.x.x           │    │
│  └────────┬────────┘    └─────────────────────┘    │
│           │                                         │
│  ┌────────▼────────┐                               │
│  │  VPC Connector  │                               │
│  │  (Serverless)   │                               │
│  └─────────────────┘                               │
│                                                     │
└─────────────────────────────────────────────────────┘
         │
         │ HTTPS only
         ▼
    Internet (webhooks, API calls)
```

### Organization Policies

```hcl
# Enforce private Cloud SQL
sql.restrictPublicIp = true

# No service account keys
iam.disableServiceAccountKeyCreation = true

# US locations only
gcp.resourceLocations = ["in:us-locations"]

# Uniform bucket access
storage.uniformBucketLevelAccess = true
```

### Cost Estimate

| Resource | Monthly |
|----------|---------|
| Cloud SQL (db-custom-2-7680) | ~$85 |
| Cloud Run (3 services) | ~$25 |
| VPC Connector | ~$7 |
| Pub/Sub, Scheduler, Secrets | ~$5 |
| Cloud Storage (audit logs) | ~$3 |
| **Total** | **~$125** |

*Add ~$85/month for HA in Phase 4*

---

## Database Schema

### Entity Relationship Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  patients   │────<│appointments │────<│clinical_notes│
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │                   │                    │
      ▼                   ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ medications │     │intake_check │     │deepcura_note│
│ problems    │     │line_items   │     └─────────────┘
│ allergies   │     │post_appt_   │
│ insurance   │     │  tasks      │
└─────────────┘     └─────────────┘
```

### Table Summary

| Table | Source | Natural Key | Sync Direction |
|-------|--------|-------------|----------------|
| `patients` | DrChrono | `drchrono_id` | DrChrono → PG |
| `providers` | DrChrono | `drchrono_id` | DrChrono → PG |
| `appointments` | DrChrono | `drchrono_id` | DrChrono → PG |
| `clinical_notes` | DrChrono | `drchrono_id` | DrChrono → PG |
| `deepcura_notes` | Deep Cura | `id` (UUID) | Deep Cura → PG |
| `medications` | DrChrono | `drchrono_id` | DrChrono → PG |
| `problems` | DrChrono | `drchrono_id` | DrChrono → PG |
| `allergies` | DrChrono | `drchrono_id` | DrChrono → PG |
| `insurance_records` | DrChrono | `(patient_id, type)` | DrChrono → PG |
| `line_items` | DrChrono | `drchrono_id` | DrChrono → PG |
| `intake_checklists` | Coda | `appointment_id` | Bidirectional |
| `post_appointment_tasks` | Coda | `id` (UUID) | Bidirectional |
| `prior_authorizations` | Coda | `id` (UUID) | Bidirectional |
| `questionnaire_responses` | Email/App | `id` (UUID) | Inbound |
| `sync_log` | System | `id` (UUID) | Internal |
| `change_log` | System | `id` (UUID) | Internal |
| `access_log` | System | `id` (UUID) | Internal |
| `staff_roles` | Manual | `email` | Internal |

### Audit Infrastructure

Every table has an audit trigger that logs to `change_log`:

```sql
-- Trigger fires on INSERT, UPDATE, DELETE
-- Captures: table_name, record_id, drchrono_id, operation,
--           changed_fields[], old_values, new_values, actor, timestamp
```

Actor context is set before operations:
```sql
SET LOCAL app.actor = 'drchrono_sync';
```

### Key Schema Patterns

**JSONB for raw payloads:**
```sql
drchrono_raw JSONB NOT NULL  -- Full API response preserved
```

**Upsert on natural key:**
```sql
INSERT INTO patients (...) VALUES (...)
ON CONFLICT (drchrono_id)
DO UPDATE SET ...;
```

**Linking Deep Cura notes:**
```sql
-- Link by appointment ID or patient + date
UPDATE deepcura_notes
SET clinical_note_id = cn.id, linked_at = NOW()
FROM clinical_notes cn
WHERE deepcura_notes.drchrono_appt_id = cn.drchrono_appt_id;
```

**Full schema:** See `database/schema.sql` (500+ lines)

---

## Services

### drchrono-sync

**Purpose:** Receive webhooks and sync data from DrChrono and Deep Cura to PostgreSQL.

**Endpoints:**

| Endpoint | Method | Trigger | Auth |
|----------|--------|---------|------|
| `/webhooks/drchrono` | POST | DrChrono | Signature verification |
| `/webhooks/deepcura` | POST | Deep Cura | Shared secret |
| `/sync/patients` | POST | Scheduler | OIDC |
| `/sync/appointments` | POST | Scheduler | OIDC |
| `/sync/clinical-notes` | POST | Scheduler | OIDC |
| `/sync/medications` | POST | Scheduler | OIDC |
| `/sync/all` | POST | Scheduler | OIDC |
| `/health` | GET | Monitoring | None |

**Key Responsibilities:**
- OAuth token refresh and management
- Webhook signature verification
- Deep Cura Gridhook AES decryption
- Idempotent upserts on `drchrono_id`
- Deep Cura note linking (appointment ID or patient + date)
- Publish change events to Pub/Sub
- Log all operations to `sync_log` and `access_log`

**Configuration:**
- Min instances: 1 (warm for webhook latency)
- Timeout: 300s (for bulk sync)
- Memory: 512Mi

### coda-push

**Purpose:** Receive Pub/Sub change events and push records to Coda tables.

**Trigger:** Pub/Sub subscription on `change-events` topic

**Key Responsibilities:**
- Message deduplication via `processed_messages` table
- Fetch full record from PostgreSQL
- Map Postgres columns → Coda column IDs
- Call Coda `upsertRows` with `drchrono_id` as merge key
- Handle rate limiting with exponential backoff
- Batch up to 500 rows for full syncs

**Configuration:**
- Min instances: 0
- Timeout: 60s
- Memory: 256Mi

### writeback-api (Phase 3)

**Purpose:** Receive updates from Coda and write back to PostgreSQL.

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/intake/:appointmentId` | PATCH | Update intake checklist |
| `/api/tasks/:taskId` | PATCH | Update task status |
| `/api/prior-auth/:authId` | PATCH | Update prior auth |

**Key Responsibilities:**
- Validate Coda webhook secret
- Zod schema validation on payloads
- Update PostgreSQL with proper audit context
- Trigger downstream notifications if needed

---

## API Integrations

### DrChrono API

| Aspect | Details |
|--------|---------|
| Auth | OAuth 2.0 with refresh tokens |
| Base URL | `https://drchrono.com/api` |
| Rate Limit | 100 req/min |
| Bulk APIs | `patients_list`, `appointments_list` (1000/page) |
| Webhooks | HMAC-SHA256 signed |

**Webhook Events:**
- `PATIENT_CREATE`, `PATIENT_MODIFY`
- `APPOINTMENT_CREATE`, `APPOINTMENT_MODIFY`
- `CLINICAL_NOTE_MODIFY`, `CLINICAL_NOTE_LOCK`

**Token Management:**
- Store in Secret Manager
- Auto-refresh on expiry
- Alert on 401 (requires manual re-auth)

### Deep Cura Gridhooks

| Aspect | Details |
|--------|---------|
| Auth | Shared secret header |
| Encryption | AES-256-CBC |
| Payload | JSON with SOAP, ICD-10, CPT, medications |

**Decryption:**
```typescript
const key = crypto.createHash('sha256').update(sharedSecret).digest();
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
```

**Linking Strategy:**
1. Match on `drchrono_appt_id` (primary)
2. Match on `patient_id` + `session_date` (fallback)
3. Flag for manual review if unlinked

### Coda API

| Aspect | Details |
|--------|---------|
| Auth | Bearer token |
| Base URL | `https://coda.io/apis/v1` |
| Rate Limit | 100 req/min (Enterprise higher) |
| Key Method | `upsertRows` with merge key |

**Column Mapping:**
- Map by column ID (e.g., `c-abc123`), not name
- Names can change; IDs are stable
- Document mappings in code

---

## Security & Compliance

### HIPAA Technical Safeguards

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | Cloud SQL AES-256 (Google-managed) |
| Encryption in transit | TLS 1.2+ everywhere |
| Access controls | IAM + Workload Identity |
| Audit logging | `change_log` + Cloud Audit Logs |
| Unique user IDs | Google Workspace SSO |

### Access Control

| Principal | Access |
|-----------|--------|
| `drchrono-sync-sa` | Cloud SQL Client, Secret Manager, Pub/Sub Publisher |
| `coda-push-sa` | Cloud SQL Client (read), Secret Manager, Pub/Sub Subscriber |
| `writeback-api-sa` | Cloud SQL Client, Secret Manager |
| Staff (via IAP) | Admin dashboard only |

### Secrets

| Secret | Purpose |
|--------|---------|
| `db-password` | PostgreSQL password |
| `drchrono-client-id` | OAuth client ID |
| `drchrono-client-secret` | OAuth client secret |
| `drchrono-access-token` | Current access token |
| `drchrono-refresh-token` | Refresh token |
| `deepcura-shared-secret` | Gridhook AES key |
| `coda-api-token` | Coda API token |

### Data Retention

| Data Type | Retention |
|-----------|-----------|
| Clinical data | Indefinite (mirrors DrChrono) |
| Audit logs (`change_log`, `sync_log`, `access_log`) | 7 years |
| Processed messages | 7 days |

---

## Monitoring & Alerting

### Dashboards

1. **Sync Health** — Success/failure rates, latency, record counts
2. **Service Health** — Cloud Run metrics, error rates
3. **Database** — Connections, CPU, storage

### Alert Policies

| Alert | Condition | Severity |
|-------|-----------|----------|
| Sync Failure | `sync_log.status = 'failed'` | Critical |
| DrChrono Auth Error | `access_log.status_code = 401` | Critical |
| High Error Rate | > 5% in 15 minutes | High |
| No Recent Sync | > 30 minutes since success | High |
| DLQ Depth | Messages in dead letter queue | High |
| Database Storage | > 80% capacity | Medium |

### Log Export

```
Cloud Logging → Log Sink → Cloud Storage (7-year retention)
```

---

## Development Workflow

### Repository Structure

```
feel-august-platform/
├── terraform/
│   ├── modules/
│   │   ├── networking/
│   │   ├── cloud-sql/
│   │   ├── cloud-run/
│   │   ├── iam/
│   │   ├── pubsub/
│   │   └── monitoring/
│   └── environments/
│       ├── production/
│       └── staging/
├── services/
│   ├── drchrono-sync/
│   ├── coda-push/
│   └── writeback-api/
├── db/
│   └── migrations/
├── docs/
│   ├── RUNBOOK.md
│   └── INCIDENT-RESPONSE.md
└── scripts/
    ├── backfill.ts
    └── verify-sync.ts
```

### Local Development

```bash
# Run Postgres locally
docker run -d --name feel-august-db \
  -e POSTGRES_DB=clinical \
  -e POSTGRES_PASSWORD=localpassword \
  -p 5432:5432 postgres:16

# Apply schema
psql -h localhost -U postgres -d clinical -f db/migrations/001_initial.sql

# Run service
cd services/drchrono-sync
npm run dev
```

### Deployment

```bash
# Build and push
gcloud builds submit --tag gcr.io/$PROJECT/drchrono-sync

# Deploy
gcloud run deploy drchrono-sync \
  --image=gcr.io/$PROJECT/drchrono-sync \
  --region=us-west1 \
  --service-account=drchrono-sync-sa@$PROJECT.iam.gserviceaccount.com \
  --vpc-connector=feel-august-connector \
  --min-instances=1
```

---

## Phased Implementation

### Phase 1: Foundation & Core Sync (Week 1)

**Day 1-2: Infrastructure**
- [ ] Create GCP project, sign BAA
- [ ] Apply organization policies
- [ ] Set up VPC, Cloud SQL, IAM
- [ ] Configure Secret Manager
- [ ] Set up Pub/Sub topics

**Day 2-3: Database**
- [ ] Run schema migration
- [ ] Verify audit triggers
- [ ] Test with sample data

**Day 3-4: DrChrono Sync**
- [ ] Implement OAuth client
- [ ] Implement webhook handler
- [ ] Implement sync logic for all tables
- [ ] Implement Deep Cura Gridhook handler
- [ ] Run initial backfill

**Day 5: Coda Push & Cutover**
- [ ] Implement Pub/Sub handler
- [ ] Implement Coda client with column mappings
- [ ] Run full push to Coda
- [ ] Disable Google Sheets webhooks
- [ ] Monitor for 24 hours

### Phase 2: Monitoring & Compliance (Week 2)

- [ ] Set up Cloud Monitoring dashboards
- [ ] Configure alerting policies
- [ ] Build admin dashboard
- [ ] Write operational runbooks
- [ ] Document incident response
- [ ] Enable Security Command Center

### Phase 3: Bidirectional Sync (Weeks 3-4)

- [ ] Build writeback-api
- [ ] Configure Coda automations
- [ ] Implement Deep Cura enrichment
- [ ] Build email processor (if needed)
- [ ] Test bidirectional flows

### Phase 4: Hardening (Month 2+)

- [ ] Enable Cloud SQL HA
- [ ] Set up staging environment
- [ ] Performance tuning
- [ ] Load testing
- [ ] Coordinate with website backend

---

## Testing Requirements

### Unit Tests

- OAuth token refresh logic
- Webhook signature verification
- Deep Cura decryption
- Upsert logic (INSERT vs UPDATE detection)
- Column mapping transformations

### Integration Tests

- DrChrono API pagination
- Pub/Sub message handling
- Coda upsertRows
- Database audit triggers

### End-to-End Tests

- Webhook → Postgres → Coda flow
- Full reconciliation cycle
- Deep Cura note linking
- Write-back from Coda

### Data Verification

```sql
-- Compare counts with DrChrono
SELECT 'patients' as table_name, COUNT(*) FROM patients
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
-- Compare with DrChrono API counts
```

---

## Operational Procedures

### Daily

- Review sync health dashboard
- Check for failed syncs
- Verify no DLQ messages

### Weekly

- Review access patterns
- Check audit log growth
- Verify backup success

### Monthly

- Review and rotate secrets
- Audit IAM permissions
- Update risk register

### Incident Response

1. **Detect** — Alert fires or anomaly identified
2. **Contain** — Revoke credentials, disable service
3. **Assess** — Query audit logs, determine scope
4. **Notify** — Per HIPAA requirements (60 days)
5. **Remediate** — Patch, rotate, harden
6. **Document** — Full incident report

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `database/schema.sql` | Complete DDL |
| `backend/drchrono-sync.md` | Service implementation |
| `backend/coda-push.md` | Service implementation |
| `backend/writeback-api.md` | Service implementation |
| `infrastructure/gcp-setup.md` | GCP setup steps |
| `infrastructure/terraform-guide.md` | Terraform modules |
| `integrations/drchrono-api.md` | DrChrono API reference |
| `integrations/deepcura-api.md` | Deep Cura reference |
| `integrations/coda-api.md` | Coda API reference |
| `compliance/hipaa-checklist.md` | Compliance checklist |
| `compliance/incident-response.md` | Incident playbook |
| `compliance/risk-register.md` | Risk tracking |
| `compliance/success-criteria.md` | Definition of done |

---

## Questions / Clarifications Needed

Before starting implementation, confirm:

1. **DrChrono OAuth credentials** — Do we have client ID/secret?
2. **Deep Cura Gridhook configuration** — Is the shared secret available?
3. **Coda doc ID and table structure** — Current Coda setup?
4. **GCP project** — Existing project or create new?
5. **Cutover timing** — Preferred window for transition?

---

*Full implementation details in the `product-plan/` folder. This document provides the technical overview for planning and coordination.*

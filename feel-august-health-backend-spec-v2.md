# Feel August Health — Backend Data Platform

## Implementation Specification & Phased Build Plan

**Prepared for:** Bobby (Co-owner, Feel August Health)
**Date:** February 3, 2026
**Version:** 2.0 — Pre-Development Specification
**Changes from v1.0:** Added platform topology, Deep Cura first-class ingestion, legacy script replacement roadmap, website backend compatibility analysis, future frontend migration path.

---

## Executive Summary

Feel August Health is a California-based telehealth psychiatry clinic currently operating DrChrono as its EHR and Deep Cura for AI-assisted clinical note-taking. Clinical operations workflows live in Coda. Today, data flows from DrChrono through Google Sheets via fragile webhooks and App Scripts into Coda, producing row ID mismatches, stale data, no audit trail, and HIPAA compliance gaps. Additional scripts handle email-triggered document processing (travel letters, ASRS assessments) and website ROI form tracking — all routed through the same brittle Google Sheets intermediary.

This specification defines the **clinical ops backend** — one of four application layers in a unified GCP platform. The clinical ops backend replaces the Google Sheets pipeline with a HIPAA-compliant architecture: Cloud SQL (Postgres) as the system of record, Cloud Run microservices for sync orchestration, and direct Coda API integration. A separate but complementary website/booking/portal backend (built with Next.js, tRPC, and Drizzle) shares the same GCP project and infrastructure.

The clinical ops build is organized into four phases across approximately 4–6 weeks, with the critical path (Phase 1: DrChrono → Postgres → Coda) targeted for completion in the first week.

---

## Platform Topology

The Feel August Health technology platform consists of four application layers sharing one GCP infrastructure foundation. Each layer has its own security boundary and data scope but benefits from unified compliance, monitoring, and deployment infrastructure.

```
GCP Project: feel-august-platform (BAA-covered)
│
├── 1. Clinical Ops Backend ← THIS SPEC
│   ├── drchrono-sync service (Cloud Run)
│   ├── coda-push service (Cloud Run)
│   ├── writeback-api service (Cloud Run)
│   └── Cloud SQL: clinical schema
│       ├── patients, appointments, clinical_notes, medications, insurance_records
│       ├── deepcura_notes (first-class Deep Cura ingestion)
│       ├── intake_checklists, post_appointment_tasks, prior_authorizations
│       └── change_log, sync_log, access_log (audit infrastructure)
│
├── 2. Patient API Gateway (patient-facing)
│   ├── patient-api service (Cloud Run)
│   │   ├── /me/appointments
│   │   ├── /me/medications
│   │   ├── /me/notes (provider-released summaries only)
│   │   ├── /me/progress (mood tracking, goals — patient-authored data)
│   │   ├── /me/tasks (intake forms, consent, questionnaires)
│   │   └── /me/recommendations (links to Shopify products)
│   ├── Firebase Auth (patient identity, MFA, passwordless, biometric)
│   └── Cloud SQL: patient_app schema
│       ├── progress_entries (mood, sleep, goals — patient-authored)
│       ├── questionnaire_responses (PHQ-9, GAD-7, ASRS, Y-BOCS)
│       ├── push_notification_preferences
│       └── app_sessions
│
├── 3. Website + Booking (public-facing) ← SEPARATE SPEC / CODEBASE
│   ├── Next.js 14 app (Cloud Run)
│   │   ├── Landing page, triage quiz, provider grid
│   │   ├── Booking flow with Redis slot locking
│   │   ├── Journey Orchestrator (state machine)
│   │   ├── Crisis Firewall (safety-critical)
│   │   └── Financial state machine (insurance verification)
│   ├── Background workers (insurance verifier, analytics, care-gap monitor)
│   ├── NextAuth (website user sessions)
│   ├── Cloud SQL: app schema (users, bookings, appointment_cache, audit_logs)
│   ├── Upstash Redis (slot locking, session cache)
│   └── External integrations:
│       ├── Stripe (payments, SetupIntents)
│       ├── Twilio (SMS)
│       ├── Resend (email)
│       ├── Google Cloud Vision (insurance OCR)
│       ├── Vertex AI (chat concierge)
│       ├── Sanity (headless CMS)
│       └── Shopify (supplements/swag, Storefront API — no PHI)
│
├── 4. Policy Manager (internal, compliance) — Month 3+
│   ├── policy-manager service (Cloud Run)
│   └── Cloud SQL: policies schema
│       ├── documents (metadata)
│       ├── document_versions (git-like revision history)
│       ├── review_workflows (approval chains)
│       └── publications (currently-live documents)
│
└── Shared Infrastructure
    ├── VPC + Private Service Connect (network isolation)
    ├── IAM + Workload Identity (no service account keys)
    ├── Secret Manager (OAuth tokens, API keys — shared across layers)
    ├── Cloud Logging → Cloud Storage (7-year retention)
    ├── Cloud Monitoring + Alerting (unified dashboards)
    ├── Cloud Audit Logs (GCP-level audit trail)
    ├── Security Command Center (Standard tier)
    └── Terraform (single codebase, multiple modules)
```

### Design Principles (Cross-Platform)

1. **Postgres is the system of record** for all clinical data. DrChrono is the clinical source of truth. Coda is a downstream UI/workflow layer. The website backend has its own database for booking-flow state.
2. **Security boundaries are explicit.** Clinical data lives in the `clinical` schema accessible only to staff-facing services. Patient-facing services read through scoped APIs with patient-identity-scoped access. Public-facing services never touch clinical data directly.
3. **Shared infrastructure, independent applications.** One GCP project, one VPC, one set of audit logs, one BAA. But each application layer deploys independently with its own service accounts and least-privilege IAM roles.
4. **Coda is a replaceable presentation layer.** Every row in Coda is a projection of a Postgres record. When the time comes to build a custom staff-facing frontend, it reads from the same Postgres via a new `staff-api` service, and the Coda Push Service is simply turned off. No data migration required.
5. **Patient identity will need a linking strategy.** A patient who books through the website (NextAuth-based session) and later uses the patient portal/mobile app (Firebase Auth) must have a unified identity. Both systems link to the DrChrono patient record via `drchrono_id`. The website user record should store a `firebase_uid` field, and both should reference the same `drchrono_patient_id`. Design this linkage now even though the patient portal is months away.

---

## Current State & Problems

### Existing Data Flow

```
DrChrono (EHR)
    │
    ├─── Webhooks ──→ Google Sheets (fragile intermediary)
    │                      │
    │                      └─── App Scripts ──→ Coda (clinical ops)
    │
    └─── Deep Cura integration (clinical notes pushed back to DrChrono)
```

### Current Google Sheets + App Scripts Inventory

The following scripts and sheets currently handle the data pipeline. Each will be replaced by a specific component in the new architecture.

| Script | Function | Replacement |
|--------|----------|-------------|
| **Master Script** | Receives DrChrono webhooks (patient data, appointment data, webhook payloads). Transforms data and pushes to Google Sheets. Pulls Deep Cura notes from DrChrono. Multiple sheets call this script. Writes to 3 spreadsheets: main data (`1FmTXvqx8...`), DrChrono analysis (`1lqhRDhJk...`), DrChrono dashboard (`1-Qcqgtj...`). | **Phase 1: drchrono-sync service** — Direct DrChrono → Postgres pipeline replaces this entirely. |
| **Travel Letter Script** | Monitors inbox for flagged emails containing travel-level details. Extracts data, saves to Google Sheets, uploads to Coda. | **Phase 3–4: email-processor service** — Gmail API polling → Cloud Run → Postgres → Coda. |
| **ASRS Tracker** | Monitors inbox for emails labeled "ASRS". Extracts assessment data and saves to patient's Google Drive folder. | **Phase 3–4: email-processor service** → Postgres `questionnaire_responses` table. Eventually replaced by in-app questionnaire administration (Patient API Gateway). |
| **ROI Tracker** | Tracks ROI (Release of Information) requests from the website. Ports data into Coda. | **Phase 2–3: Replaced naturally** when website backend exists. Form submissions → web-api → Postgres → Coda (or custom frontend). |

### Pain Points

- **Row ID instability:** When rows are modified or deleted in Google Sheets, the row IDs that Coda references become misaligned, breaking downstream lookups.
- **No audit trail:** There is no record of what data changed, when, or by whom — a HIPAA requirement for PHI.
- **Fragile glue code:** App Scripts are brittle, hard to debug, and lack error handling, retry logic, and alerting.
- **No transactional integrity:** Partial failures leave data in inconsistent states across Sheets and Coda.
- **Compliance risk:** PHI transiting through Google Sheets without dedicated access controls, encryption-at-rest guarantees, or audit logging.
- **Email-based workflows are fragile:** Travel letters and ASRS assessments depend on Gmail label matching and App Script triggers with no retry or error visibility.
- **Assessment data scattered:** ASRS data goes to patient Google Drive folders rather than a queryable structured store. No trending, no scoring automation, no longitudinal view.

---

## Target Architecture

### High-Level Data Flow

```
DrChrono (EHR)                      Deep Cura
    │                                    │
    │  webhooks + polling                │ Gridhooks (AES-encrypted)
    ▼                                    ▼
┌─────────────────────────────────────────────────┐
│              GCP (BAA-covered)                   │
│                                                  │
│  Cloud Run: drchrono-sync                        │
│  ┌─────────────────────┐                         │
│  │ /webhooks/drchrono   │──── DrChrono webhooks  │
│  │ /webhooks/deepcura   │──── Deep Cura Gridhooks│
│  │ /sync/*              │──── Scheduled full sync │
│  └──────────┬──────────┘                         │
│             ▼                                    │
│  Cloud SQL (Postgres 16)                         │
│  ┌──────────────────────────────────┐            │
│  │ patients                         │            │
│  │ appointments                     │            │
│  │ clinical_notes                   │            │
│  │ deepcura_notes  ← NEW           │            │
│  │ medications                      │            │
│  │ insurance_records                │            │
│  │ ─────────────────────            │            │
│  │ intake_checklists                │            │
│  │ post_appointment_tasks           │            │
│  │ prior_authorizations             │            │
│  │ ─────────────────────            │            │
│  │ sync_log                         │            │
│  │ change_log                       │            │
│  │ access_log                       │            │
│  └──────────┬───────────────────────┘            │
│             │                                    │
│             ▼ Pub/Sub (change events)            │
│  Cloud Run: coda-push                            │
│             │                                    │
│             ▼                                    │
│  Coda (Enterprise, BAA)                          │
│  ┌──────────────────────┐                        │
│  │ Scheduling Ops       │                        │
│  │ Patient Intake       │                        │
│  │ Post-Appt Tasks      │                        │
│  │ Prior Auths          │                        │
│  │ eRx, Referrals       │                        │
│  └──────────┬───────────┘                        │
│             │ (Phase 3+)                         │
│             ▼                                    │
│  Cloud Run: writeback-api                        │
│             │                                    │
│             ▼                                    │
│  Cloud SQL (Postgres) — bidirectional            │
│                                                  │
│  ──────────────────────────────────              │
│  Also in this GCP project:                       │
│  • Website/Booking backend (separate codebase)   │
│  • Patient API Gateway (future)                  │
│  • Policy Manager (future)                       │
└──────────────────────────────────────────────────┘
```

### Design Principles (Clinical Ops Backend)

1. **Postgres is the system of record** for all synced data. Coda is a UI/workflow layer, not a data store. DrChrono remains the clinical source of truth.
2. **Idempotent sync operations.** Every sync can be safely re-run. DrChrono record IDs serve as natural keys; upserts prevent duplicates.
3. **Event-driven, not polling-only.** DrChrono webhooks trigger near-real-time sync. Deep Cura Gridhooks push structured note data. Periodic full reconciliation catches anything webhooks miss.
4. **Audit everything.** Every record change, every API call, every sync operation is logged with timestamps, actor, and before/after state.
5. **Future-proof for bidirectional sync.** The schema and service architecture anticipate Coda→Postgres→DrChrono write-back without requiring a rewrite.
6. **Deep Cura as a first-class data source.** In addition to the transitive DrChrono integration, Deep Cura's Gridhooks push structured clinical data (transcript, SOAP sections, ICD-10 codes, CPT suggestions, medication mentions) directly into Postgres. This gives access to the AI's raw extraction and provenance for quality assurance, patient bio generation, and billing workflows.
7. **Claude Code maintainability.** Infrastructure as Code (Terraform), clear service boundaries, comprehensive logging, and a monorepo structure optimized for AI-assisted development.

---

## GCP Infrastructure

### Services Used (All BAA-Covered)

| Service | Purpose | HIPAA Notes |
|---------|---------|-------------|
| Cloud SQL (Postgres 16) | Primary database (all schemas) | Encryption at rest (Google-managed), private IP |
| Cloud Run | Sync services, API endpoints | Stateless, auto-scaling, VPC-connected |
| Cloud Scheduler | Periodic full reconciliation | Triggers Cloud Run jobs |
| Pub/Sub | Change event messaging | Decouples sync from push |
| Secret Manager | API keys, OAuth tokens | Versioned, audited access — shared across all layers |
| Cloud Logging + Cloud Audit Logs | Operational & compliance logging | 7-year retention via log sink to Cloud Storage |
| Cloud Storage | Long-term audit log archive | Retention policy, lifecycle rules |
| Cloud Monitoring + Alerting | Uptime, error rates, latency | PagerDuty/email integration |
| VPC + Private Service Connect | Network isolation | Cloud SQL on private IP only |
| IAM | Access control | 2 principals (owners), least-privilege service accounts |
| Security Command Center | Breach detection & notification | Standard tier minimum |

### Estimated Monthly Cost (Clinical Ops Backend Only)

| Resource | Configuration | Est. Cost |
|----------|--------------|-----------|
| Cloud SQL | db-custom-2-7680, 50GB SSD, HA disabled initially | ~$85/mo |
| Cloud Run (3 services) | min 0, max 3 instances each | ~$15–40/mo |
| Pub/Sub | Low volume (~1K messages/day) | < $1/mo |
| Cloud Scheduler | 3–4 jobs | < $1/mo |
| Secret Manager | ~15 secrets (shared across layers) | < $1/mo |
| Cloud Storage (audit archive) | Growing over time | < $5/mo |
| Cloud Monitoring | Standard | Free tier |
| **Total** | | **~$110–135/mo** |

The website backend adds ~$50–100/mo for its Cloud Run instances and Upstash Redis. The Cloud SQL instance is shared (separate schemas), so no additional database cost until volume warrants it.

---

## Database Schema (Postgres 16)

### Core DrChrono Mirror Tables

These tables mirror the authoritative data in DrChrono. The `drchrono_id` is the natural key.

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE patients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    date_of_birth       DATE,
    email               TEXT,
    phone               TEXT,
    gender              TEXT,
    address             JSONB,
    emergency_contact   JSONB,
    primary_insurance   JSONB,
    secondary_insurance JSONB,
    referring_source    TEXT,
    chart_id            TEXT,
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_drchrono_id ON patients(drchrono_id);
CREATE INDEX idx_patients_last_name ON patients(last_name);
CREATE INDEX idx_patients_dob ON patients(date_of_birth);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    patient_id          UUID REFERENCES patients(id),
    drchrono_patient_id BIGINT NOT NULL,
    doctor_id           BIGINT,
    office_id           BIGINT,
    scheduled_time      TIMESTAMPTZ NOT NULL,
    duration            INTEGER,
    status              TEXT,
    reason              TEXT,
    appointment_type    TEXT,
    icd10_codes         TEXT[],
    billing_status      TEXT,
    is_telehealth       BOOLEAN DEFAULT TRUE,
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_drchrono_id ON appointments(drchrono_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_time);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ============================================================
-- CLINICAL NOTES (from DrChrono)
-- ============================================================
CREATE TABLE clinical_notes (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id          BIGINT UNIQUE NOT NULL,
    appointment_id       UUID REFERENCES appointments(id),
    drchrono_appt_id     BIGINT NOT NULL,
    patient_id           UUID REFERENCES patients(id),
    drchrono_patient_id  BIGINT NOT NULL,
    doctor_id            BIGINT,
    note_date            DATE,
    locked               BOOLEAN DEFAULT FALSE,
    sections             JSONB,
    drchrono_raw         JSONB NOT NULL,
    synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinical_notes_appointment ON clinical_notes(appointment_id);
CREATE INDEX idx_clinical_notes_patient ON clinical_notes(patient_id);

-- ============================================================
-- DEEP CURA NOTES (first-class ingestion via Gridhooks)
-- ============================================================
-- Stores the structured data Deep Cura extracts from each session,
-- independent of the DrChrono clinical note. This preserves:
-- - The AI's raw extraction (before provider editing)
-- - Structured fields (CPT codes, ICD-10, medication mentions)
-- - Full session transcript (if available)
-- - Provenance for diffing AI extraction vs signed note
CREATE TABLE deepcura_notes (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinical_note_id     UUID REFERENCES clinical_notes(id),
    appointment_id       UUID REFERENCES appointments(id),
    patient_id           UUID REFERENCES patients(id),
    drchrono_appt_id     BIGINT,
    drchrono_patient_id  BIGINT,
    doctor_id            BIGINT,
    session_date         DATE NOT NULL,
    -- Structured extraction fields
    transcript           TEXT,                   -- full session transcript
    soap_subjective      TEXT,
    soap_objective       TEXT,
    soap_assessment      TEXT,
    soap_plan            TEXT,
    icd10_codes          JSONB,                  -- [{code, description, confidence}]
    cpt_codes            JSONB,                  -- [{code, description, units}]
    medication_mentions  JSONB,                  -- [{name, dosage, action, reason}]
    billing_summary      JSONB,                  -- structured billing fields
    risk_assessment      JSONB,                  -- safety/risk extraction
    -- Raw payload
    gridhook_raw         JSONB NOT NULL,          -- full decrypted Gridhook payload
    gridhook_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Linking
    linked_at            TIMESTAMPTZ,             -- when matched to clinical_note
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deepcura_appointment ON deepcura_notes(appointment_id);
CREATE INDEX idx_deepcura_patient ON deepcura_notes(patient_id);
CREATE INDEX idx_deepcura_session_date ON deepcura_notes(session_date);

-- ============================================================
-- MEDICATIONS
-- ============================================================
CREATE TABLE medications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    patient_id          UUID REFERENCES patients(id),
    drchrono_patient_id BIGINT NOT NULL,
    doctor_id           BIGINT,
    name                TEXT NOT NULL,
    rxnorm              TEXT,
    dosage_quantity      TEXT,
    dosage_units         TEXT,
    frequency            TEXT,
    route                TEXT,
    status               TEXT,
    date_prescribed      DATE,
    date_started         DATE,
    date_stopped         DATE,
    daw                  BOOLEAN,
    notes                TEXT,
    drchrono_raw         JSONB NOT NULL,
    synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_medications_status ON medications(status);

-- ============================================================
-- INSURANCE (separate table for detailed tracking)
-- ============================================================
CREATE TABLE insurance_records (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id           UUID REFERENCES patients(id) NOT NULL,
    drchrono_patient_id  BIGINT NOT NULL,
    insurance_type       TEXT NOT NULL,
    payer_name           TEXT,
    payer_id             TEXT,
    member_id            TEXT,
    group_number         TEXT,
    plan_name            TEXT,
    subscriber_name      TEXT,
    subscriber_relation  TEXT,
    copay                NUMERIC(10,2),
    deductible           NUMERIC(10,2),
    eligibility_status   TEXT,
    eligibility_checked  TIMESTAMPTZ,
    insurance_data       JSONB NOT NULL,
    synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(drchrono_patient_id, insurance_type)
);

CREATE INDEX idx_insurance_patient ON insurance_records(patient_id);
```

### Operational Tables (Coda Workflow Support)

These tables support the Coda workflows — intake checklists, post-appointment handoffs, prior auths. They are populated initially from Coda and maintained bidirectionally in Phase 3.

```sql
-- ============================================================
-- INTAKE CHECKLIST (pre-appointment readiness)
-- ============================================================
CREATE TABLE intake_checklists (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id      UUID REFERENCES appointments(id) NOT NULL,
    patient_id          UUID REFERENCES patients(id) NOT NULL,
    card_on_file        BOOLEAN DEFAULT FALSE,
    autopay_setup       BOOLEAN DEFAULT FALSE,
    insurance_verified  BOOLEAN DEFAULT FALSE,
    consent_signed      BOOLEAN DEFAULT FALSE,
    cures_checked       BOOLEAN DEFAULT FALSE,
    controlled_sub_agreement BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    completed_at        TIMESTAMPTZ,
    completed_by        TEXT,
    coda_row_id         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_appointment ON intake_checklists(appointment_id);

-- ============================================================
-- POST-APPOINTMENT TASKS
-- ============================================================
CREATE TABLE post_appointment_tasks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id      UUID REFERENCES appointments(id) NOT NULL,
    patient_id          UUID REFERENCES patients(id) NOT NULL,
    task_type           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
    assigned_to         TEXT,
    description         TEXT,
    due_date            DATE,
    completed_at        TIMESTAMPTZ,
    completed_by        TEXT,
    notes               TEXT,
    coda_row_id         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_appt_appointment ON post_appointment_tasks(appointment_id);
CREATE INDEX idx_post_appt_status ON post_appointment_tasks(status);

-- ============================================================
-- PRIOR AUTHORIZATIONS
-- ============================================================
CREATE TABLE prior_authorizations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID REFERENCES patients(id) NOT NULL,
    appointment_id      UUID REFERENCES appointments(id),
    insurance_id        UUID REFERENCES insurance_records(id),
    medication_id       UUID REFERENCES medications(id),
    auth_type           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
    payer_name          TEXT,
    submitted_date      DATE,
    approved_date       DATE,
    denied_date         DATE,
    expiration_date     DATE,
    auth_number         TEXT,
    notes               TEXT,
    coda_row_id         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prior_auth_patient ON prior_authorizations(patient_id);
CREATE INDEX idx_prior_auth_status ON prior_authorizations(status);
```

### Audit & Sync Infrastructure Tables

```sql
-- ============================================================
-- SYNC LOG — tracks every sync operation
-- ============================================================
CREATE TABLE sync_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source          TEXT NOT NULL,        -- 'drchrono', 'deepcura', 'coda'
    operation       TEXT NOT NULL,        -- 'full_sync', 'webhook', 'gridhook', 'incremental', 'write_back'
    table_name      TEXT NOT NULL,
    status          TEXT NOT NULL,        -- 'started', 'completed', 'failed', 'partial'
    records_total   INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed  INTEGER DEFAULT 0,
    error_message   TEXT,
    error_details   JSONB,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER
);

CREATE INDEX idx_sync_log_source ON sync_log(source, started_at DESC);
CREATE INDEX idx_sync_log_status ON sync_log(status);

-- ============================================================
-- CHANGE LOG — tracks every record-level change (before/after)
-- ============================================================
CREATE TABLE change_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name      TEXT NOT NULL,
    record_id       UUID NOT NULL,
    drchrono_id     BIGINT,
    operation       TEXT NOT NULL,        -- 'INSERT', 'UPDATE', 'DELETE'
    changed_fields  TEXT[],
    old_values      JSONB,
    new_values      JSONB,
    sync_id         UUID REFERENCES sync_log(id),
    actor           TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_log_table ON change_log(table_name, created_at DESC);
CREATE INDEX idx_change_log_record ON change_log(record_id);
CREATE INDEX idx_change_log_created ON change_log(created_at);

-- ============================================================
-- ACCESS LOG — tracks all external API access
-- ============================================================
CREATE TABLE access_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service         TEXT NOT NULL,        -- 'drchrono_api', 'coda_api', 'deepcura_api'
    endpoint        TEXT NOT NULL,
    method          TEXT NOT NULL,
    status_code     INTEGER,
    request_summary JSONB,
    response_summary JSONB,
    duration_ms     INTEGER,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_log_service ON access_log(service, created_at DESC);

-- ============================================================
-- RETENTION POLICY FUNCTION
-- ============================================================
-- 7-year retention for audit data (aligned with website backend's 7-year standard)
-- Run monthly via Cloud Scheduler
CREATE OR REPLACE FUNCTION cleanup_expired_audit_data()
RETURNS void AS $$
BEGIN
    DELETE FROM change_log WHERE created_at < NOW() - INTERVAL '7 years';
    DELETE FROM sync_log WHERE started_at < NOW() - INTERVAL '7 years';
    DELETE FROM access_log WHERE created_at < NOW() - INTERVAL '7 years';
END;
$$ LANGUAGE plpgsql;
```

### Trigger for Automatic Change Tracking

```sql
-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    changed_cols TEXT[];
    col TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO change_log (table_name, record_id, operation, new_values, actor)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_setting('app.actor', true));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        FOR col IN SELECT column_name FROM information_schema.columns
                   WHERE table_name = TG_TABLE_NAME AND table_schema = TG_TABLE_SCHEMA
        LOOP
            IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
                changed_cols := array_append(changed_cols, col);
            END IF;
        END LOOP;

        IF array_length(changed_cols, 1) > 0 THEN
            INSERT INTO change_log (table_name, record_id, operation, changed_fields, old_values, new_values, actor)
            VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', changed_cols, to_jsonb(OLD), to_jsonb(NEW),
                    current_setting('app.actor', true));
        END IF;

        NEW.updated_at = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO change_log (table_name, record_id, drchrono_id, operation, old_values, actor)
        VALUES (TG_TABLE_NAME, OLD.id, OLD.drchrono_id, 'DELETE', to_jsonb(OLD),
                current_setting('app.actor', true));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to all core tables
CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_appointments AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_clinical_notes AFTER INSERT OR UPDATE OR DELETE ON clinical_notes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_deepcura_notes AFTER INSERT OR UPDATE OR DELETE ON deepcura_notes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_medications AFTER INSERT OR UPDATE OR DELETE ON medications
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_insurance AFTER INSERT OR UPDATE OR DELETE ON insurance_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_intake AFTER INSERT OR UPDATE OR DELETE ON intake_checklists
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_post_appt AFTER INSERT OR UPDATE OR DELETE ON post_appointment_tasks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_prior_auth AFTER INSERT OR UPDATE OR DELETE ON prior_authorizations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

---

## Service Architecture

### Monorepo Structure

```
feel-august-platform/
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── modules/
│   │   ├── cloud-sql/           # Shared instance, multiple schemas
│   │   ├── cloud-run/
│   │   ├── networking/          # VPC, Private Service Connect
│   │   ├── iam/                 # Service accounts for all layers
│   │   ├── monitoring/
│   │   └── security/            # SCC, org policies
│   └── environments/
│       ├── production/
│       └── staging/
├── services/
│   ├── drchrono-sync/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── webhooks.ts          # DrChrono webhook handler
│   │   │   ├── deepcura-webhook.ts  # Deep Cura Gridhook handler
│   │   │   ├── sync/
│   │   │   │   ├── patients.ts
│   │   │   │   ├── appointments.ts
│   │   │   │   ├── clinical-notes.ts
│   │   │   │   ├── medications.ts
│   │   │   │   └── insurance.ts
│   │   │   ├── drchrono/
│   │   │   │   ├── client.ts
│   │   │   │   ├── oauth.ts
│   │   │   │   └── types.ts
│   │   │   ├── deepcura/
│   │   │   │   ├── decrypt.ts       # AES decryption for Gridhook payloads
│   │   │   │   ├── parser.ts        # Extract structured fields
│   │   │   │   └── types.ts
│   │   │   ├── db/
│   │   │   │   ├── connection.ts
│   │   │   │   ├── queries.ts
│   │   │   │   └── migrations/
│   │   │   └── audit/
│   │   │       └── logger.ts
│   │   └── tests/
│   ├── coda-push/
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── coda/
│   │   │   │   ├── client.ts
│   │   │   │   ├── tables.ts
│   │   │   │   └── mappings.ts
│   │   │   └── pubsub/
│   │   │       └── handler.ts
│   │   └── tests/
│   └── writeback-api/               # Phase 3
│       ├── Dockerfile
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── intake.ts
│       │   │   ├── tasks.ts
│       │   │   └── prior-auth.ts
│       │   └── validation/
│       │       └── schemas.ts
│       └── tests/
├── db/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_deepcura_notes.sql
│   │   ├── 003_audit_triggers.sql
│   │   └── ...
│   └── seeds/
├── scripts/
│   ├── backfill.ts
│   ├── verify-sync.ts
│   └── rotate-tokens.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PLATFORM-TOPOLOGY.md
│   ├── RUNBOOK.md
│   ├── INCIDENT-RESPONSE.md
│   └── DATA-DICTIONARY.md
├── .gcloudignore
├── cloudbuild.yaml
└── README.md
```

**Note:** The website/booking backend (`august-health/`) is a separate monorepo with its own codebase (Next.js, Turborepo, Drizzle). It shares the GCP project and infrastructure (VPC, IAM, Secret Manager, Cloud SQL instance) but deploys independently. See the "Website Backend Compatibility" section for coordination points.

### Service Details

#### 1. DrChrono Sync Service (`drchrono-sync`)

**Runtime:** Node.js 20 on Cloud Run
**Trigger:** DrChrono webhooks (push) + Deep Cura Gridhooks (push) + Cloud Scheduler (pull)
**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhooks/drchrono` | POST | Receive DrChrono webhook events |
| `/webhooks/deepcura` | POST | Receive Deep Cura Gridhook payloads |
| `/sync/patients` | POST | Full patient sync (Cloud Scheduler) |
| `/sync/appointments` | POST | Full appointment sync |
| `/sync/clinical-notes` | POST | Full clinical notes sync |
| `/sync/medications` | POST | Full medications sync |
| `/sync/all` | POST | Orchestrate full sync of all tables |
| `/health` | GET | Health check |

**DrChrono Webhook Events to Subscribe:**

| Event | Action |
|-------|--------|
| `PATIENT_CREATE` | Insert patient |
| `PATIENT_MODIFY` | Update patient |
| `APPOINTMENT_CREATE` | Insert appointment |
| `APPOINTMENT_MODIFY` | Update appointment (includes status changes) |
| `CLINICAL_NOTE_MODIFY` | Update clinical note (when locked/signed) |
| `CLINICAL_NOTE_LOCK` | Mark note as locked |

**DrChrono Sync Logic (per table):**

```
1. Receive trigger (webhook or scheduler)
2. Create sync_log entry (status: 'started')
3. If webhook: fetch single record by ID from DrChrono API
   If scheduler: use bulk API with `since` parameter (last successful sync timestamp)
4. For each record:
   a. Map DrChrono fields → Postgres columns
   b. Store full API response in drchrono_raw JSONB column
   c. UPSERT on drchrono_id (INSERT ON CONFLICT UPDATE)
   d. Audit trigger automatically logs the change
5. Publish change events to Pub/Sub topic
6. Update sync_log entry (status: 'completed', counts)
```

**Deep Cura Gridhook Ingestion Logic:**

```
1. Receive Gridhook POST at /webhooks/deepcura
2. Verify shared-secret authentication
3. Decrypt AES-encrypted payload using shared secret from Secret Manager
4. Create sync_log entry (source: 'deepcura', operation: 'gridhook')
5. Parse structured fields:
   - Transcript, SOAP sections
   - ICD-10 codes with confidence scores
   - CPT code suggestions with units
   - Medication mentions with dosage/action
   - Risk/safety assessment extraction
   - Billing summary fields
6. Attempt to link to existing clinical_note:
   - Match on drchrono_appt_id if present in payload
   - Or match on patient + date
   - Set linked_at timestamp when matched
7. INSERT into deepcura_notes (no upsert — each Gridhook is a unique event)
8. Publish change event to Pub/Sub
9. Update sync_log entry
```

**DrChrono OAuth Token Management:**

```
- Store access_token and refresh_token in Secret Manager
- On each API call, check token expiry
- If expired, use refresh_token to obtain new access_token
- Store updated tokens back in Secret Manager
- If refresh fails, alert immediately (tokens revoked)
```

#### 2. Coda Push Service (`coda-push`)

**Runtime:** Node.js 20 on Cloud Run
**Trigger:** Pub/Sub subscription (change events from sync service)

**Logic:**

```
1. Receive Pub/Sub message with change event
   { table: "appointments", operation: "UPDATE", record_id: "...", drchrono_id: 329024607 }
2. Fetch full record from Postgres
3. Map Postgres fields → Coda column IDs
4. Call Coda API: POST /docs/{docId}/tables/{tableId}/rows
   - Use upsertRows with drchrono_id as the merge key
   - This creates new rows or updates existing ones
5. Log the push in access_log
```

**Coda API Considerations:**

- Coda API rate limit: 100 req/min (standard), higher on Enterprise.
- Use the `upsertRows` endpoint with a key column (drchrono_id) so updates are idempotent.
- Batch up to 500 rows per request for efficiency during full syncs.

**Recommendation:** Use the Coda REST API for the primary sync path (Postgres → Coda). Use webhook-triggered automations only for lightweight notifications.

#### 3. Write-Back API (`writeback-api`) — Phase 3

**Runtime:** Node.js 20 on Cloud Run
**Trigger:** Coda button presses → Coda webhook automations → this API

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/intake/:appointmentId` | PATCH | Update intake checklist fields |
| `/api/tasks/:taskId` | PATCH | Update post-appointment task status |
| `/api/prior-auth/:authId` | PATCH | Update prior authorization status |
| `/api/health` | GET | Health check |

**Write-back Flow:**

```
1. Staff clicks a button in Coda (e.g., "Insurance Verified ✓")
2. Coda automation triggers → sends webhook to Write-Back API
3. API validates the payload (Zod schema validation)
4. API updates the corresponding Postgres record
5. Audit trigger logs the change with actor = 'coda_writeback'
6. (Future) If the change needs to propagate to DrChrono,
   publish to a separate Pub/Sub topic for DrChrono write-back
```

---

## Website Backend Compatibility Analysis

The website/booking/portal backend is being developed as a separate codebase with a different tech stack (Next.js 14, tRPC, Drizzle ORM, Turborepo). This section analyzes compatibility, identifies coordination requirements, and flags issues to resolve.

### Architecture Compatibility: No Conflicts

The two backends coexist cleanly because they occupy different security boundaries and data scopes within the same GCP project:

| Concern | Clinical Ops Backend | Website Backend |
|---------|---------------------|----------------|
| **Database** | `clinical` schema (Postgres, raw SQL) | `app` schema (Postgres, Drizzle ORM) |
| **Auth** | IAM (staff principals, service accounts) | NextAuth (website users) + Firebase Auth (patient portal) |
| **Data scope** | All patients, all clinical data | Individual user sessions, booking flow state |
| **Network** | Private VPC (Cloud SQL, service-to-service) | Public-facing (Cloud Run with HTTPS) |
| **Deployment** | `feel-august-platform/` monorepo | `august-health/` monorepo (Turborepo) |

The two codebases share a Cloud SQL instance (separate schemas) and Secret Manager. They deploy to the same VPC and are covered by the same GCP BAA.

### Coordination Requirements

These items require explicit coordination between the two backends:

**1. Shared DrChrono OAuth Credentials**

Both backends need DrChrono API access. The website needs it to read availability and write bookings. The clinical backend needs it for full sync. They must share the OAuth token in Secret Manager and coordinate token refresh to avoid invalidating each other's access. Recommended: the clinical backend's drchrono-sync service owns the token refresh lifecycle, and the website backend reads the current token from Secret Manager without refreshing it.

**2. Booking → DrChrono → Postgres Flow**

When a patient completes a booking on the website, the flow is:
```
Website creates appointment in DrChrono via API
    → DrChrono fires APPOINTMENT_CREATE webhook
    → drchrono-sync receives webhook, writes to Postgres
    → Pub/Sub event → coda-push updates Coda
```
The website does NOT write to the clinical Postgres directly. DrChrono remains the source of truth, and the clinical backend's webhook pipeline picks up new appointments automatically. This is elegant — no cross-database coordination needed — but requires the webhook pipeline to be live before the website booking flow goes into production.

**3. Patient Identity Linking**

A patient will interact with three identity systems:
- **Website:** NextAuth session with `users` table in `app` schema
- **Patient portal/mobile:** Firebase Auth with `firebase_uid`
- **Clinical system:** `drchrono_patient_id` in `clinical` schema

The linking strategy:
- When a website booking creates a DrChrono patient, store the `drchrono_patient_id` on the website user record.
- When the patient later creates a Firebase Auth account (for the portal/mobile app), link it to the same `drchrono_patient_id`.
- The `patients` table in the clinical schema is the canonical patient record. The website's `users` table and Firebase Auth are session/identity layers.

**4. Appointment Availability**

The website needs real-time appointment availability for the provider grid and slot selection. Two options:
- **Direct DrChrono API reads** (current plan in website spec: `appointment_cache` table). Simple, no cross-backend dependency. But adds DrChrono API load.
- **Read from clinical Postgres** via an internal API. More efficient, lower DrChrono API usage, but creates a runtime dependency on the clinical backend.

Recommendation: Start with direct DrChrono reads (simpler, matches the website spec). Once the clinical backend's sync pipeline is proven reliable, optionally add an internal availability endpoint that reads from Postgres.

**5. Audit Log Retention Alignment**

The website spec specifies 7-year audit retention. The clinical backend v1.0 specified 6 years. **This spec (v2.0) aligns to 7 years** across both backends for consistency.

### Observations and Advisories

**No red flags that require changing the clinical backend spec.** The two systems are cleanly separated. The following observations are for awareness when building the website backend:

**On Drizzle vs raw SQL:** Different ORMs in different codebases is fine. The website's schema is simpler (users, bookings, cache), and Drizzle's type generation and migration tooling are genuine productivity wins for a Next.js app. The clinical backend uses raw SQL because healthcare data requires maximum control over queries, especially for audit triggers and JSONB operations that ORMs abstract poorly.

**On Redis (Upstash) for slot locking:** The website backend uses Upstash Redis for distributed slot locks with TTL auto-expiration. The clinical backend doesn't use Redis. These don't conflict. Upstash is external to GCP but doesn't handle PHI (slot locks contain slot IDs, not patient data), so no BAA is needed.

**On the Journey Orchestrator state machine:** The website's Journey Orchestrator manages the booking flow state (INITIAL → TRIAGE_COMPLETE → PROVIDER_SELECTED → SLOT_HELD → BOOKING_CONFIRMED). This state lives entirely in the website's `app` schema. It has no interaction with the clinical backend's state. Clean separation.

**On the Crisis Firewall:** The website includes crisis detection in the triage quiz and chat widget. This is safety-critical and must work independently of the clinical backend. Since it runs in the website's own stack (regex + quiz option matching, Vertex AI safety guards in chat), there's no dependency on clinical infrastructure. Correct design.

**On observability divergence:** The website spec uses Honeycomb (distributed tracing) and Sentry (error tracking). The clinical backend uses Cloud Monitoring and Cloud Logging. Both are valid. For eventual unification, consider using OpenTelemetry as the common instrumentation layer with multiple exporters — Cloud Trace for GCP-native dashboards, Honeycomb for developer tracing, Sentry for error alerting. Not urgent, but worth noting.

**On the Ops Dashboard:** The website spec includes an ops dashboard (pending verification queue, crisis alert log, schedule reconciliation). Some of this overlaps with Coda-based clinical ops workflows. As the platform matures, these could converge into a single staff-facing frontend — which aligns with the long-term goal of replacing Coda.

---

## Legacy Script Replacement Roadmap

Each existing Google Sheets + App Scripts workflow maps to a specific replacement in the new architecture:

### Phase 1 Replacement: Master Script

The Master Script is the highest-priority replacement. It handles the core DrChrono data pipeline (webhooks, patient data, appointment data, Deep Cura note pulling) and feeds 3 spreadsheets. The drchrono-sync service replaces this entirely.

**Cutover plan:**
1. Deploy drchrono-sync, verify data integrity against current Sheets
2. Deploy coda-push, verify Coda receives data from Postgres
3. Pause Master Script webhooks
4. Monitor 24 hours
5. Disable Master Script (keep spreadsheets read-only for 2 weeks as fallback)

### Phase 3–4 Replacement: Email-Based Workflows

The Travel Letter Script and ASRS Tracker both follow the same pattern: email arrives → App Script triggers → data extracted → saved to Sheets/Drive → pushed to Coda.

The replacement is a single `email-processor` Cloud Run service (or a set of Cloud Functions) that:
1. Polls Gmail API for messages matching specific labels (or uses Gmail Push Notifications via Pub/Sub)
2. Extracts structured data based on template type (travel letter fields, ASRS responses)
3. Writes to Postgres (travel letters to a `travel_letters` table, ASRS to `questionnaire_responses`)
4. Pushes to Coda via the existing coda-push pipeline

Long-term, the ASRS Tracker is superseded entirely when the Patient API Gateway launches with in-app questionnaire administration. Patients complete ASRS, PHQ-9, GAD-7, and Y-BOCS directly in the mobile app, responses flow to `patient_app.questionnaire_responses`, and providers see scored/trended results before appointments.

### Phase 2–3 Replacement: ROI Tracker

The ROI Tracker (website form submissions → Sheets → Coda) dies naturally when the website backend launches. ROI requests submitted through the new website go directly to the web-api → `app` schema in Postgres. If they need to surface in Coda for clinical ops, the coda-push pipeline handles it.

### Script Decommissioning Timeline

| Script | Replaced By | When | Decommission |
|--------|------------|------|-------------|
| Master Script | drchrono-sync + coda-push | Phase 1 (Week 1) | Week 1 Day 5 |
| ROI Tracker | Website backend web-api | When website launches | Concurrent with website launch |
| Travel Letter Script | email-processor service | Phase 3–4 | After email-processor verified |
| ASRS Tracker | email-processor → Patient API Gateway | Phase 3–4 → Month 12+ | After in-app assessment available |

---

## Future Frontend Migration Path

The architecture is designed so that Coda can be replaced by a custom staff-facing frontend without data migration, schema changes, or re-architecture.

### Why This Works

Every row in Coda is a projection of a Postgres record, pushed via API, keyed on `drchrono_id`. Coda holds no data that doesn't exist in Postgres. The transition to a custom frontend looks like:

```
Current:  Postgres → coda-push → Coda (staff reads/writes via Coda UI)
Future:   Postgres → staff-api  → Custom React Frontend (staff reads/writes via custom UI)
```

### Migration Approach

1. Build a `staff-api` Cloud Run service that reads from the clinical Postgres with role-based access control.
2. Build a React frontend (or extend the website's Next.js app) that calls the staff-api.
3. Migrate workflows one at a time — start with the highest-value or most constrained Coda view (e.g., appointment day-view with patient bio).
4. Keep Coda and the custom frontend running in parallel during migration. Both read from the same Postgres, so data is always consistent.
5. When all workflows have migrated, turn off the coda-push service. No data migration needed.

### When to Start

Not before the clinical ops backend (this spec) is proven in production with months of stable operation. Coda is the right tool for the current phase — it's fast to wire up, the team already knows it, and it lets you validate workflow designs before committing them to custom UI. The key architectural decisions being made now (Postgres as truth, stable IDs, event-driven push, typed contracts) are what make the eventual transition frictionless.

---

## HIPAA Compliance Checklist

### Technical Safeguards

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Encryption at rest | Cloud SQL default encryption (AES-256, Google-managed keys) | Phase 1 |
| Encryption in transit | TLS 1.2+ on all connections (Cloud Run enforces HTTPS, Cloud SQL via SSL) | Phase 1 |
| Access controls | IAM with 2 user principals + per-service service accounts | Phase 1 |
| Audit logging | Change log triggers + Cloud Audit Logs + access log table | Phase 1 |
| Data integrity | Postgres transactions, UPSERT idempotency, reconciliation jobs | Phase 1 |
| Automatic logoff | N/A (API services, no interactive sessions) | N/A |
| Unique user IDs | Google Workspace SSO → IAM identity | Phase 1 |

### Administrative Safeguards

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Risk assessment | Document data flows, identify threats, mitigate | Phase 2 |
| BAAs in place | GCP ✓, Coda ✓, Deep Cura ✓ | Done |
| Workforce training | Document access procedures for both owners | Phase 2 |
| Contingency plan | Cloud SQL automated backups (7-day retention), export to Cloud Storage | Phase 1 |
| Breach notification | Security Command Center + Cloud Monitoring alerts → email/Slack | Phase 2 |
| Data retention | 7-year retention on audit logs, monthly cleanup function | Phase 1 |
| Minimum necessary | Cloud Run services have scoped DB credentials | Phase 1 |

### Physical Safeguards

| Requirement | Implementation |
|-------------|---------------|
| Facility access | GCP data centers (Google-managed) |
| Workstation security | Owners use Google Workspace with enforced 2FA + SSO |
| Device and media controls | No local PHI storage; all data in GCP |

### GCP Organization Policy Constraints to Verify

```
constraints/gcp.resourceLocations          → us-locations-only
constraints/iam.disableServiceAccountKeyCreation → true (use Workload Identity)
constraints/sql.restrictPublicIp           → true (Cloud SQL private IP only)
constraints/compute.requireShieldedVm      → true
constraints/storage.uniformBucketLevelAccess → true
```

---

## Breach Notification & Incident Response

### Detection

- **Cloud Security Command Center (Standard tier):** Monitors for anomalous access patterns, exposed credentials, misconfigurations.
- **Cloud Monitoring Alerts:**
  - Alert on: unusual API error rates, authentication failures, sync failures, database connection spikes.
  - Notification channels: email to both owners, optional Slack webhook.
- **Custom monitoring queries:**
  - Access log anomaly detection (unusual query volumes, off-hours access)
  - Failed authentication tracking

### Response Playbook (to be expanded in `docs/INCIDENT-RESPONSE.md`)

```
1. DETECT: Alert fires or anomaly identified
2. CONTAIN: Revoke compromised credentials, disable affected service account
3. ASSESS: Determine scope — which records, which PHI elements, how many patients
4. NOTIFY:
   - HHS: Within 60 days if ≥500 individuals affected
   - Affected individuals: Within 60 days
   - California AG: If ≥500 California residents affected
   - Media: If ≥500 individuals affected
5. DOCUMENT: Full incident report with timeline, root cause, remediation
6. REMEDIATE: Patch vulnerability, rotate all credentials, review access
```

---

## Phased Implementation Plan

### Phase 1: Foundation + Core Sync Pipeline (Week 1)

**Goal:** DrChrono data flowing reliably into Postgres and pushing to Coda, with Google Sheets completely removed from the data path.

**Day 1–2: GCP Infrastructure**

- [ ] Review and harden GCP organization policies (see checklist above)
- [ ] Create dedicated GCP project: `feel-august-platform`
- [ ] Set up VPC with private subnet for Cloud SQL
- [ ] Provision Cloud SQL instance (Postgres 16, private IP, automated backups)
- [ ] Configure Secret Manager with DrChrono OAuth credentials and Deep Cura shared secret
- [ ] Set up Cloud Logging export to Cloud Storage (7-year retention bucket)
- [ ] Create IAM service accounts with scoped roles:
  - `drchrono-sync-sa` — Cloud SQL client, Secret Manager accessor, Pub/Sub publisher
  - `coda-push-sa` — Cloud SQL client (read-only), Secret Manager accessor
- [ ] Set up Terraform for all of the above

**Day 2–3: Database**

- [ ] Run initial migration: create all core tables (patients, appointments, clinical_notes, deepcura_notes, medications, insurance_records)
- [ ] Run migration: create audit tables (sync_log, change_log, access_log)
- [ ] Run migration: create audit trigger function and apply to all tables
- [ ] Verify triggers are working with test inserts/updates

**Day 3–4: DrChrono Sync Service**

- [ ] Confirm or create DrChrono OAuth application
- [ ] Implement DrChrono API client with OAuth token refresh
- [ ] Implement sync logic for each table (patients first, then appointments, then the rest)
- [ ] Implement webhook receiver endpoint with signature verification
- [ ] Implement Deep Cura Gridhook receiver (/webhooks/deepcura) with AES decryption
- [ ] Deploy to Cloud Run, connect to Cloud SQL via private IP
- [ ] Run initial backfill: all patients (since 2024-01-01), all appointments, medications, insurance
- [ ] Set up Cloud Scheduler for periodic full reconciliation (every 15 minutes)
- [ ] Subscribe to DrChrono webhook events
- [ ] Configure Deep Cura Gridhook to point to new endpoint

**Day 5: Coda Push Service**

- [ ] Create Pub/Sub topic and subscription for change events
- [ ] Implement Coda API client with token management
- [ ] Map Postgres tables → Coda table/column IDs (document the mapping)
- [ ] Implement push logic with upsertRows
- [ ] Deploy to Cloud Run
- [ ] Run full push to populate Coda from Postgres
- [ ] Verify data integrity: spot-check 20 patients and 50 appointments

**Day 5: Cutover**

- [ ] Pause existing Google Sheets webhooks and App Scripts (Master Script)
- [ ] Redirect Deep Cura Gridhook from Google Sheets to Cloud Run endpoint
- [ ] Verify Coda is receiving data from the new pipeline
- [ ] Monitor for 24 hours
- [ ] Disable Master Script (do not delete — keep as fallback for 2 weeks)

### Phase 2: Monitoring, Alerting & Compliance Hardening (Week 2)

**Goal:** Production-grade operational visibility and compliance documentation.

- [ ] Set up Cloud Monitoring dashboards:
  - Sync health (success/failure rates, latency, record counts)
  - Database metrics (connections, CPU, storage)
  - API error rates by service
  - Deep Cura Gridhook ingestion rate and errors
- [ ] Configure alerting policies:
  - Sync failure → immediate email
  - DrChrono API errors (401 = token expired, 429 = rate limit) → email
  - Deep Cura Gridhook decryption failures → email
  - Coda API errors → email
  - Database storage > 80% → email
  - No successful sync in > 30 minutes → email
- [ ] Build data integrity verification script:
  - Compare record counts: DrChrono API vs. Postgres
  - Run daily via Cloud Scheduler
  - Alert on discrepancies > 0
- [ ] Create operational tables in Postgres (intake_checklists, post_appointment_tasks, prior_authorizations)
- [ ] Push operational tables to Coda
- [ ] Set up Security Command Center (Standard tier)
- [ ] Write incident response playbook (`docs/INCIDENT-RESPONSE.md`)
- [ ] Write operational runbook (`docs/RUNBOOK.md`)
- [ ] Document data dictionary (`docs/DATA-DICTIONARY.md`)

### Phase 3: Coda Write-Back + Deep Cura Enrichment (Weeks 3–4)

**Goal:** Bidirectional Coda↔Postgres flow; Deep Cura data powering clinical workflows.

**Coda Write-Back:**
- [ ] Define write-back data contracts (which fields, validation rules)
- [ ] Build Write-Back API service with Zod validation
- [ ] Configure Coda button automations → webhook to Write-Back API
- [ ] Test intake checklist write-back flow end-to-end
- [ ] Test post-appointment task write-back flow
- [ ] Test prior authorization write-back flow
- [ ] Deploy to Cloud Run with scoped service account

**Deep Cura Enrichment:**
- [ ] Verify Gridhook data is linking correctly to clinical_notes
- [ ] Build Deep Cura enrichment views in Coda (or query tools):
  - CPT code extraction for billing review
  - Medication mention summaries
  - Risk assessment flags
- [ ] Validate: for each locked clinical note, verify a corresponding deepcura_note exists
- [ ] Begin surfacing Deep Cura extraction data in operational workflows

**Email-Based Workflow Replacement (if capacity):**
- [ ] Build email-processor Cloud Run service
- [ ] Implement Gmail API polling for travel letter emails
- [ ] Implement Gmail API polling for ASRS labeled emails
- [ ] Write to Postgres (travel_letters table, questionnaire_responses table)
- [ ] Push to Coda via coda-push pipeline
- [ ] Test with live emails, verify against current Sheets output
- [ ] Decommission Travel Letter Script and ASRS Tracker

### Phase 4: Hardening & Expansion (Month 2+)

**Goal:** Production resilience, advanced features, next-layer data.

- [ ] Enable Cloud SQL High Availability (regional failover)
- [ ] Add billing/claims sync from DrChrono
- [ ] Add lab results sync from DrChrono
- [ ] Build Coda dashboard views powered by Postgres
- [ ] Implement DrChrono write-back path (Postgres → DrChrono) for bidirectional sync
- [ ] Load testing and performance tuning
- [ ] Set up staging environment (separate GCP project)
- [ ] Coordinate with website backend on shared DrChrono OAuth token management
- [ ] Design patient identity linking (website user → Firebase UID → drchrono_patient_id)
- [ ] Decommission ROI Tracker when website backend launches

---

## Key Integration Notes

### DrChrono API Reference

| Resource | Endpoint | Bulk API | Webhook |
|----------|----------|----------|---------|
| Patients | `/api/patients` | `/api/patients_list` (1000/page) | `PATIENT_CREATE`, `PATIENT_MODIFY` |
| Appointments | `/api/appointments` | `/api/appointments_list` (1000/page) | `APPOINTMENT_CREATE`, `APPOINTMENT_MODIFY` |
| Clinical Notes | `/api/clinical_notes` | N/A (5 per page, max 20) | `CLINICAL_NOTE_MODIFY`, `CLINICAL_NOTE_LOCK` |
| Medications | `/api/medications` | N/A | N/A |
| Insurance | Via `/api/patients` (nested) | Via patient bulk | Via patient webhook |

**Important DrChrono API behaviors:**
- Appointments and clinical notes require a `since`, `date`, or `date_range` parameter on list queries.
- Clinical notes endpoint is paginated at 5 per page (max 20) — slow for bulk sync. Cache aggressively, sync incrementally using `since` parameter.
- Bulk APIs return a UUID; poll for results (may take seconds to minutes for large datasets).
- Webhook payloads are lightweight (event type + object ID only); you must fetch the full record via the API.

### Coda Integration Notes

- **Authentication:** API token stored in Secret Manager.
- **Merge key:** Each Coda table should have a `drchrono_id` column used as the key for `upsertRows`.
- **Column ID mapping:** Coda uses internal column IDs (like `c-abc123`), not column names. Document these mappings in `services/coda-push/src/coda/mappings.ts`.
- **Coda row ID ≠ DrChrono ID:** By using `upsertRows` with `drchrono_id` as the merge key, we eliminate the row ID coupling entirely.

### Deep Cura Integration Notes

- Deep Cura integrates with DrChrono natively — notes pushed to DrChrono appear in the clinical notes API.
- Deep Cura's "Gridhooks" system pushes structured data (up to 18 fields per note) to arbitrary endpoints.
- Gridhook payloads are AES-encrypted with a shared secret (stored in Secret Manager).
- The existing Deep Cura → Google Sheets Gridhook should be redirected to `/webhooks/deepcura` on the drchrono-sync service.
- Each Gridhook event produces a unique `deepcura_notes` row. These are linked to `clinical_notes` by matching on appointment ID or patient + date.
- The `deepcura_notes` table preserves the AI's raw extraction independently from the signed clinical note, enabling diff analysis (what Deep Cura generated vs. what the provider signed) for quality assurance workflows.

---

## Technology Choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript (Node.js 20) | Best Coda & DrChrono API client support, strong typing for healthcare data, Claude Code excels at TS |
| Database | Postgres 16 on Cloud SQL | JSONB for flexible schema evolution, robust audit triggers, excellent GCP integration |
| HTTP Framework | Express.js or Hono | Lightweight, well-understood, minimal overhead |
| Validation | Zod | Runtime type checking for API payloads, generates TS types |
| ORM/Query | Raw SQL with parameterized queries (pg library) | Maximum control for healthcare data, no ORM abstraction leaks |
| Infrastructure | Terraform | Declarative, reproducible, version-controlled infrastructure |
| CI/CD | Cloud Build | Native GCP integration, simple Dockerfile-based builds |
| Package Manager | pnpm with workspaces | Monorepo support, fast installs, deterministic |

**Note on tech stack divergence with website backend:** The website uses Drizzle ORM, tRPC, and Turborepo. This is intentional — different concerns, different tradeoffs. The clinical backend prioritizes maximum query control and audit trigger compatibility (raw SQL). The website backend prioritizes developer velocity and type-safe API routes (Drizzle + tRPC). Both use TypeScript and Postgres, which means shared mental models and cross-pollination of patterns.

---

## Development Workflow

### Using Antigravity IDE + Claude Code

The monorepo structure is designed for AI-assisted development:

1. **Terraform modules** are self-contained with clear input/output contracts.
2. **Each service** has its own Dockerfile, package.json, and src/ directory — can be developed/deployed independently.
3. **Migration files** are numbered SQL files — easy to generate, review, and apply.
4. **Type definitions** in `types.ts` files serve as contracts between DrChrono/Deep Cura API responses and Postgres schemas.
5. **Comprehensive logging** means debugging in production can be done by reading Cloud Logging, not attaching debuggers.

### Deployment Flow

```
1. Developer edits code in Antigravity IDE
2. Claude Code assists with implementation
3. Test locally against a dev Cloud SQL instance (or local Docker Postgres)
4. Push to main branch
5. Cloud Build triggers:
   a. Run TypeScript compilation + linting
   b. Build Docker images
   c. Push to Artifact Registry
   d. Deploy to Cloud Run (rolling update, no downtime)
6. Cloud Monitoring confirms healthy deployment
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DrChrono API rate limits during backfill | Medium | Medium | Use bulk APIs, exponential backoff, throttle to 50% of limit |
| DrChrono OAuth token revoked | Low | High | Alerting on 401 errors, documented re-authorization procedure |
| Coda API rate limits during full push | Medium | Low | Batch upserts (500 rows), queue with backoff |
| Clinical notes sync is slow (5/page) | High | Medium | Incremental sync with `since`, cache aggressively |
| Webhook delivery gaps (DrChrono drops events) | Medium | Medium | Periodic full reconciliation catches gaps |
| Deep Cura Gridhook encryption changes | Low | Medium | Version the decryption logic, test with each Deep Cura update |
| Deep Cura Gridhook→clinical_note linking failures | Medium | Low | Match on multiple dimensions (appt ID, patient+date), flag unlinked notes for manual review |
| GCP region outage | Very Low | High | Cloud SQL automated backups, documented recovery procedure |
| Coda schema changes break push | Medium | Medium | Map by column ID (stable) not name, version the mappings |
| DrChrono OAuth token contention (clinical + website backends) | Medium | Medium | Single owner of token refresh (drchrono-sync), website reads current token only |
| Website booking creates appointment but webhook pipeline not yet live | Low | High | Require clinical backend Phase 1 complete before website booking goes live |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All patients (since 1/1/2024) are in Postgres with correct data
- [ ] All appointments are in Postgres with correct data
- [ ] Clinical notes, medications, and insurance records are syncing
- [ ] Deep Cura Gridhook data is flowing into deepcura_notes
- [ ] DrChrono webhooks are flowing through the new pipeline
- [ ] Coda tables are populated from Postgres (not Google Sheets)
- [ ] Google Sheets Master Script is disabled
- [ ] Audit logging is functioning (change_log populated on every sync)
- [ ] No data loss over 24-hour monitoring period

### System Healthy When:
- Sync latency (webhook → Postgres → Coda) < 60 seconds
- Full reconciliation completes in < 5 minutes
- Zero data discrepancies between DrChrono and Postgres
- All audit log entries present for every record change
- Deep Cura notes linking rate > 95%
- Cloud Monitoring shows no errors for 7 consecutive days

---

## Appendix: Coda Table ↔ Postgres Mapping Template

This will be filled in during Phase 1 Day 5 once we examine the existing Coda structure.

| Coda Table | Coda Column Name | Coda Column ID | Postgres Table | Postgres Column | Direction |
|------------|-----------------|----------------|----------------|-----------------|-----------|
| Appointments | Start Time | `c-?` | appointments | scheduled_time | PG → Coda |
| Appointments | Duration | `c-?` | appointments | duration | PG → Coda |
| Appointments | Status | `c-?` | appointments | status | PG → Coda |
| Appointments | Reason | `c-?` | appointments | reason | PG → Coda |
| Appointments | ICD10 Codes | `c-?` | appointments | icd10_codes | PG → Coda |
| Appointments | Appointment Id | `c-?` | appointments | drchrono_id | PG → Coda |
| Appointments | Dr Chrono Patient | `c-?` | appointments | drchrono_patient_id | PG → Coda |
| Patients | DOB | `c-?` | patients | date_of_birth | PG → Coda |
| Patients | Email | `c-?` | patients | email | PG → Coda |
| Intake | Card on File | `c-?` | intake_checklists | card_on_file | Coda ↔ PG |
| Intake | Autopay Setup | `c-?` | intake_checklists | autopay_setup | Coda ↔ PG |
| Intake | Insurance Verified | `c-?` | intake_checklists | insurance_verified | Coda ↔ PG |
| ... | ... | ... | ... | ... | ... |

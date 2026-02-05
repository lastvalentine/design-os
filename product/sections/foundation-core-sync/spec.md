# Foundation & Core Sync Specification

## Overview

The foundational infrastructure layer for Feel August Platform. Establishes the GCP project with HIPAA-compliant configuration, deploys the core data pipeline (DrChrono → Postgres → Coda), and sets up authentication, audit logging, and reliability infrastructure. This is the critical path that replaces the Google Sheets pipeline.

## Infrastructure Components

- GCP project (`feel-august-platform`) with BAA-covered services and organization policy constraints
- VPC with Private Service Connect for Cloud SQL network isolation
- Cloud SQL (Postgres 16) with private IP, automated backups, and SSL enforcement
- Cloud Run for sync services with min_instances configuration for critical paths
- Cloud IAP for Google Workspace SSO authentication (SAML)
- IAM with Workload Identity Federation (no service account keys)
- Secret Manager for DrChrono OAuth tokens, Deep Cura shared secret, and Coda API key
- Pub/Sub for change event messaging with dead letter queue topics
- Cloud Scheduler for periodic full reconciliation jobs (every 15 minutes)
- Cloud Logging export to Cloud Storage with 7-year retention policy

## Database Schema

### DrChrono Mirror Tables
- `patients` — Patient demographics and contact information
- `providers` — Clinician details (NPI, specialty, credentials)
- `appointments` — Scheduled visits with status and billing info
- `clinical_notes` — Provider documentation (synced when locked)
- `medications` — Prescribed medications with dosage and status
- `problems` — Active/historical diagnoses (ICD-10)
- `allergies` — Patient allergy information
- `insurance_records` — Insurance coverage (primary/secondary)

### Deep Cura Table
- `deepcura_notes` — AI-extracted clinical data with transcript, SOAP sections, ICD-10/CPT suggestions, medication mentions, risk assessment, and raw Gridhook payload

### Operational Tables
- `intake_checklists` — Pre-appointment readiness tracking
- `post_appointment_tasks` — Follow-up task management
- `prior_authorizations` — Insurance prior auth requests
- `questionnaire_responses` — Patient assessment scores (PHQ-9, GAD-7, ASRS, Y-BOCS)
- `consent_records` — Patient consent with version tracking
- `staff_roles` — RBAC for admin dashboard users

### Audit Tables
- `sync_log` — Tracks every sync operation with status and record counts
- `change_log` — Records every PHI change with before/after state
- `access_log` — Tracks external API calls for compliance
- `processed_messages` — Pub/Sub message deduplication (7-day TTL)

### Triggers
- Audit trigger function applied to all clinical and operational tables
- Automatic `updated_at` timestamp management

## Services

### drchrono-sync (Cloud Run)
- **Endpoints:**
  - `POST /webhooks/drchrono` — Receive DrChrono webhook events
  - `POST /webhooks/deepcura` — Receive Deep Cura Gridhook payloads (AES-encrypted)
  - `POST /sync/patients` — Full patient sync
  - `POST /sync/appointments` — Full appointment sync
  - `POST /sync/clinical-notes` — Full clinical notes sync
  - `POST /sync/medications` — Full medications sync
  - `POST /sync/all` — Orchestrate full sync of all tables
  - `GET /health` — Health check
- **Responsibilities:**
  - DrChrono OAuth token refresh and management
  - Webhook signature verification
  - Deep Cura Gridhook AES decryption
  - Idempotent upserts on drchrono_id
  - Deep Cura note linking (match on appointment ID or patient + date)
  - Publish change events to Pub/Sub
  - Log all operations to sync_log and access_log

### coda-push (Cloud Run)
- **Trigger:** Pub/Sub subscription on change events
- **Responsibilities:**
  - Fetch full record from Postgres
  - Map Postgres columns to Coda column IDs
  - Call Coda API upsertRows with drchrono_id as merge key
  - Batch up to 500 rows for efficiency during full syncs
  - Handle rate limiting with exponential backoff
  - Log all pushes to access_log
  - Check processed_messages to avoid duplicate pushes

## Reliability Features

- **Dead Letter Queues:** Separate DLQ topic for failed Pub/Sub messages with alerting when depth > 0
- **Connection Pooling:** PgBouncer sidecar or pg-pool with strict max connections per Cloud Run instance
- **Min Instances:** drchrono-sync runs with min_instances: 1 to avoid cold start latency on webhooks
- **Message Deduplication:** processed_messages table tracks Pub/Sub message IDs (7-day cleanup)
- **OpenTelemetry:** Instrumentation on all services with Cloud Trace export for distributed tracing
- **Webhook Buffering:** Consider Cloud Tasks as buffer for burst webhook traffic (optional)

## Data Flow

1. **DrChrono → Postgres:** Webhooks trigger near-real-time sync; Cloud Scheduler triggers periodic full reconciliation
2. **Deep Cura → Postgres:** Gridhooks push structured note data; service decrypts and links to clinical_notes
3. **Postgres → Coda:** Pub/Sub change events trigger coda-push; upsertRows keeps Coda in sync
4. **Full Reconciliation:** Every 15 minutes, Cloud Scheduler triggers /sync/all to catch any missed webhooks

## Terraform Modules

- `modules/networking` — VPC, subnets, Private Service Connect
- `modules/cloud-sql` — Postgres instance, databases, users
- `modules/cloud-run` — Service deployments with IAM bindings
- `modules/iam` — Service accounts, Workload Identity, IAP configuration
- `modules/pubsub` — Topics, subscriptions, DLQ configuration
- `modules/secrets` — Secret Manager resources
- `modules/monitoring` — Log sinks, storage buckets, retention policies

## Configuration

- shell: false

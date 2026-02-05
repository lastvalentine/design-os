# Feel August Platform

## Description

A unified healthcare technology platform for Feel August Health, a California-based telehealth psychiatry clinic. The platform replaces fragile Google Sheets pipelines with HIPAA-compliant cloud infrastructure spanning four application layers: clinical operations, patient-facing services, public website/booking, and internal policy management. One GCP project, shared infrastructure, independent deployments—designed for reliability, compliance, and eventual custom frontends.

## Problems & Solutions

### Problem 1: Fragile Infrastructure Breaks Silently
Current App Scripts fail without alerting, requiring manual intervention to discover and fix sync issues. No retry logic, no error handling, no visibility.

Cloud Run services provide comprehensive error handling, automatic retries, dead letter queues, and Cloud Monitoring alerts. Problems are detected by monitoring before staff notice.

### Problem 2: Data Sync Failures Cause Workflow Chaos
Row ID mismatches in Google Sheets break downstream Coda lookups. When rows are modified or deleted, references become misaligned, leaving staff with stale or missing data.

Postgres serves as the system of record with stable UUIDs and DrChrono IDs as natural keys. Idempotent upserts eliminate row ID coupling entirely.

### Problem 3: HIPAA Compliance Gaps Create Risk
No audit trail for PHI changes. Data transits through Google Sheets without dedicated access controls, encryption guarantees, or logging. Cannot answer "who accessed what, when" for breach investigations.

Comprehensive audit triggers log every PHI change with before/after state. GCP BAA-covered infrastructure provides encryption at rest/transit, IAM access controls, 7-year log retention, and documented breach response procedures.

### Problem 4: No Visibility Into What Happened
Cannot debug "why is this patient's data wrong?" or trace a record through the pipeline. Problems are discovered by staff, not monitoring.

Sync logs, change logs, and access logs answer "who changed what, when, and why." Distributed tracing (OpenTelemetry) follows records through the entire pipeline. Cloud Monitoring dashboards provide proactive visibility.

### Problem 5: Patient Experience Is Fragmented
Patients interact with multiple disconnected systems—website booking, potential mobile app, clinical records—with no unified identity or consistent experience.

Unified patient identity links website bookings (NextAuth), mobile app sessions (Firebase Auth), and clinical records through a single DrChrono patient ID. Consistent experience across all touchpoints.

### Problem 6: Assessment Data Is Scattered and Unqueryable
ASRS assessments are saved to patient Google Drive folders via email triggers. No trending, no scoring automation, no longitudinal view for clinical decision-making.

Structured questionnaire storage with computed scores, severity categories, and longitudinal trending. Eventually administered in-app, replacing fragile email-based workflows entirely.

## Key Features

### Clinical Ops Backend (Phase 1)
- DrChrono sync service with webhooks and scheduled reconciliation
- Deep Cura Gridhook ingestion for AI-extracted clinical notes
- Coda push service for real-time staff UI updates
- Write-back API for bidirectional Coda ↔ Postgres sync
- Comprehensive audit infrastructure (change_log, sync_log, access_log)
- Email processor for travel letters and ASRS intake
- Cloud Monitoring with proactive alerting
- Admin dashboard for sync status, error inspection, manual reconciliation, and unlinked Deep Cura note review
- Google Workspace SSO via Cloud Identity-Aware Proxy (IAP) with role-based access control

### Patient API Gateway (Future)
- Patient-scoped access to appointments, medications, and provider-released notes
- In-app questionnaire administration (PHQ-9, GAD-7, ASRS, Y-BOCS)
- Progress tracking (mood, sleep, goals)
- Push notifications and care reminders

### Website & Booking (Separate Codebase)
- Public website with provider grid and triage quiz
- Booking flow with real-time slot locking (Redis)
- Insurance verification and payment capture
- Crisis detection firewall

### Policy Manager (Future)
- Version-controlled policy documents
- Review and approval workflows
- Compliance publication tracking

## Product Roadmap

### 1. Foundation & Core Sync
GCP infrastructure (VPC, Cloud SQL, IAM, Terraform), Postgres schema with audit triggers, DrChrono sync service with webhooks, and Coda push service for a complete end-to-end data pipeline.

### 2. Monitoring & Compliance
Cloud Monitoring alerting policies, data verification scripts, operational runbooks, incident response procedures, Security Command Center setup, and a lightweight admin dashboard for sync status, error inspection, manual reconciliation triggers, and unlinked Deep Cura note review.

### 3. Bidirectional Sync & Enrichment
Coda write-back API for staff-driven updates, Deep Cura enrichment workflows, email processor for travel letters and ASRS intake, and operational tables (intake checklists, prior authorizations).

### 4. Hardening & Expansion
Cloud SQL high availability, billing/claims and lab results sync, staging environment, performance tuning, and coordination with the website backend on shared infrastructure.

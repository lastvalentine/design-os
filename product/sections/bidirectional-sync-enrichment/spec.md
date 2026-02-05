# Bidirectional Sync & Enrichment Specification

## Overview

Backend services enabling two-way data flow between Postgres and external systems. Implements the Coda write-back API for staff-driven updates, Deep Cura enrichment workflows for AI-assisted clinical documentation, and an email processor for ingesting travel letters and ASRS assessments. No admin UI—these services operate automatically with monitoring via the Monitoring & Compliance dashboard.

## Services

### coda-writeback (Cloud Run)
- **Endpoints:**
  - `POST /webhooks/coda` — Receive Coda automation triggers when staff update operational tables
  - `POST /sync/intake-checklists` — Sync intake checklist changes back to relevant systems
  - `POST /sync/prior-authorizations` — Sync prior auth status updates
- **Responsibilities:**
  - Validate incoming Coda webhook payloads
  - Apply business rules before writing to Postgres
  - Trigger downstream notifications (e.g., prior auth approved)
  - Log all write operations to change_log

### deepcura-enrichment (Cloud Run)
- **Trigger:** Pub/Sub subscription on new DeepCuraNote events
- **Responsibilities:**
  - Compare AI-extracted ICD-10/CPT codes against clinical note when both exist
  - Flag discrepancies for review in Monitoring dashboard
  - Generate suggested billing adjustments
  - Update DeepCuraNote with enrichment metadata

### email-processor (Cloud Run)
- **Trigger:** Pub/Sub subscription on Gmail API push notifications
- **Responsibilities:**
  - Parse incoming emails from designated mailboxes
  - Extract travel letter PDFs and store in Cloud Storage
  - Parse ASRS assessment responses from Google Forms notifications
  - Create QuestionnaireResponse records with computed scores
  - Link documents to appropriate patient records

## Operational Tables

### IntakeChecklist
Pre-appointment readiness tracking managed by clinical ops staff in Coda:
- Card on file status
- Autopay setup status
- Insurance verification status
- Consent signed status
- CURES checked status
- Controlled substance agreement status

### PriorAuthorization
Insurance prior authorization tracking:
- Medication or service requiring authorization
- Submission date and method
- Payer and authorization number
- Status (pending, approved, denied, expired)
- Expiration date
- Staff notes

## Data Flow

1. **Coda → Postgres:** Staff updates in Coda trigger webhooks to coda-writeback service
2. **Deep Cura Enrichment:** New AI notes trigger comparison workflow, discrepancies flagged
3. **Email → Postgres:** Incoming emails processed, documents stored, records created
4. **Postgres → Coda:** Changes flow back via existing coda-push service

## Configuration

- shell: false

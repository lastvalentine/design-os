# Database Schema

This folder contains the complete PostgreSQL 16 schema for the Feel August Platform clinical operations backend.

## Files

- `schema.sql` - Complete DDL for all tables, indexes, triggers, and functions
- `migrations/` - Incremental migration files (create as needed)

## Schema Overview

### DrChrono Mirror Tables
Tables that mirror authoritative data from DrChrono EHR:
- `patients` - Patient demographics and contact info
- `providers` - Clinician details (NPI, specialty)
- `appointment_profiles` - Appointment type definitions
- `appointments` - Scheduled visits
- `clinical_notes` - Provider documentation (synced when locked)
- `medications` - Prescribed medications
- `problems` - Active/historical diagnoses (ICD-10)
- `allergies` - Patient allergy information
- `insurance_records` - Insurance coverage
- `line_items` - Billing CPT codes

### Deep Cura Table
- `deepcura_notes` - AI-extracted clinical data from session recordings

### Operational Tables
Tables supporting Coda workflows with bidirectional sync:
- `intake_checklists` - Pre-appointment readiness
- `post_appointment_tasks` - Follow-up task management
- `prior_authorizations` - Insurance prior auth requests
- `questionnaire_responses` - Patient assessments (PHQ-9, GAD-7, ASRS, Y-BOCS)
- `consent_records` - Patient consent tracking

### Audit Infrastructure
- `sync_log` - Every sync operation with status and counts
- `change_log` - Every record change with before/after state
- `access_log` - External API calls
- `processed_messages` - Pub/Sub deduplication (7-day TTL)
- `staff_roles` - RBAC for admin dashboard

## Key Design Patterns

### Natural Keys
All DrChrono-synced entities use `drchrono_id` (BIGINT) as the natural key for upserts:
```sql
INSERT INTO patients (...) VALUES (...)
ON CONFLICT (drchrono_id)
DO UPDATE SET ...;
```

### Audit Triggers
Every table has an audit trigger that logs changes to `change_log`:
- INSERT: Logs new record with `new_values`
- UPDATE: Logs changed fields with `old_values` and `new_values`
- DELETE: Logs deleted record with `old_values`

Set the actor context before operations:
```sql
SET LOCAL app.actor = 'drchrono_sync';
```

### JSONB Storage
Raw API responses are stored in `drchrono_raw` / `gridhook_raw` columns for:
- Debugging sync issues
- Accessing fields not explicitly modeled
- Future schema evolution

## Deployment

### Initial Setup
```bash
# Connect to Cloud SQL
gcloud sql connect feel-august-db --user=postgres

# Run the schema
\i schema.sql
```

### Migrations
For incremental changes, create numbered migration files:
```
migrations/
├── 001_initial_schema.sql
├── 002_add_problems_table.sql
├── 003_add_questionnaire_responses.sql
└── ...
```

Apply migrations in order:
```bash
for f in migrations/*.sql; do
  psql -f "$f"
done
```

## Retention Policies

- **Audit data**: 7 years (HIPAA requirement)
- **Processed messages**: 7 days (deduplication only)

Cleanup functions are defined in the schema and should be called via Cloud Scheduler:
- `cleanup_expired_audit_data()` - Run monthly
- `cleanup_expired_messages()` - Run daily

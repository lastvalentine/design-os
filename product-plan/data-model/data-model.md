# Data Model

## Core Clinical Entities

### Patient
A person receiving psychiatric care at Feel August Health. The central entity that all clinical data relates to. Synced from DrChrono with demographics, contact information, and chart ID.

**Key fields:** `drchrono_id` (natural key), `first_name`, `last_name`, `date_of_birth`, `email`, `phone`, `gender`, `address` (JSONB), `emergency_contact` (JSONB), `primary_insurance` (JSONB), `secondary_insurance` (JSONB), `referring_source`, `chart_id`, `drchrono_raw` (JSONB)

### Provider
A psychiatrist or clinician who delivers care. Synced from DrChrono with NPI, specialty, credentials, and contact details.

**Key fields:** `drchrono_id`, `first_name`, `last_name`, `npi`, `specialty`, `credentials`, `email`

### Appointment
A scheduled telehealth visit between a patient and provider. Includes scheduled time, duration, status, reason, and billing information. Synced from DrChrono via webhooks.

**Key fields:** `drchrono_id`, `patient_id` (FK), `drchrono_patient_id`, `doctor_id`, `office_id`, `scheduled_time`, `duration`, `status`, `reason`, `appointment_type`, `icd10_codes` (TEXT[]), `billing_status`, `is_telehealth`, `drchrono_raw` (JSONB)

### AppointmentProfile
Appointment type definitions such as initial evaluation, 30-minute follow-up, or medication check. Includes standard duration and display settings. Used to categorize appointments.

**Key fields:** `drchrono_id`, `name`, `duration`, `color`, `online_scheduling`

### ClinicalNote
Provider documentation for a patient visit, synced from DrChrono when the note is locked/signed. Contains structured sections and may reference ICD-10 codes.

**Key fields:** `drchrono_id`, `appointment_id` (FK), `drchrono_appt_id`, `patient_id` (FK), `drchrono_patient_id`, `doctor_id`, `note_date`, `locked`, `sections` (JSONB), `drchrono_raw` (JSONB)

### DeepCuraNote
AI-extracted clinical data from a session recording, received via Deep Cura Gridhooks. Contains transcript, SOAP sections, suggested ICD-10 and CPT codes, medication mentions, and risk assessment. Preserved independently from the signed clinical note for quality assurance comparison.

**Key fields:** `clinical_note_id` (FK, nullable), `appointment_id` (FK), `patient_id` (FK), `drchrono_appt_id`, `drchrono_patient_id`, `doctor_id`, `session_date`, `transcript`, `soap_subjective`, `soap_objective`, `soap_assessment`, `soap_plan`, `icd10_codes` (JSONB), `cpt_codes` (JSONB), `medication_mentions` (JSONB), `billing_summary` (JSONB), `risk_assessment` (JSONB), `gridhook_raw` (JSONB), `gridhook_received_at`, `linked_at`

### Medication
A prescribed psychiatric medication for a patient. Includes name, dosage, frequency, route, status (active, discontinued), and prescribing provider. Synced from DrChrono.

**Key fields:** `drchrono_id`, `patient_id` (FK), `drchrono_patient_id`, `doctor_id`, `name`, `rxnorm`, `dosage_quantity`, `dosage_units`, `frequency`, `route`, `status`, `date_prescribed`, `date_started`, `date_stopped`, `daw`, `notes`, `drchrono_raw` (JSONB)

### Problem
An active or historical diagnosis for a patient, represented as an ICD-10 code with description. Tracks onset date, status, and resolving provider. Essential for clinical context in psychiatry.

**Key fields:** `drchrono_id`, `patient_id` (FK), `icd10_code`, `description`, `date_onset`, `status`, `resolving_doctor_id`

### Allergy
Patient allergy information including allergen, reaction type, and severity. Critical for prescribing safety, especially with psychiatric medications.

**Key fields:** `drchrono_id`, `patient_id` (FK), `allergen`, `reaction`, `severity`, `status`

### Insurance
Patient insurance coverage information. Includes payer name, member ID, group number, subscriber details, copay, deductible, and eligibility status. Supports primary and secondary insurance.

**Key fields:** `patient_id` (FK), `drchrono_patient_id`, `insurance_type` (primary/secondary), `payer_name`, `payer_id`, `member_id`, `group_number`, `plan_name`, `subscriber_name`, `subscriber_relation`, `copay`, `deductible`, `eligibility_status`, `eligibility_checked`, `insurance_data` (JSONB)

### LineItem
A billable CPT code associated with an appointment. Used for billing reconciliation and comparison against Deep Cura's CPT suggestions. Includes code, description, units, and fee.

**Key fields:** `drchrono_id`, `appointment_id` (FK), `cpt_code`, `description`, `units`, `fee`, `drchrono_raw` (JSONB)

---

## Operational Entities

### IntakeChecklist
Pre-appointment readiness tracking for clinical operations staff. Tracks card on file, autopay setup, insurance verification, consent signed, CURES checked, and controlled substance agreement. Lives in Coda with bidirectional sync.

**Key fields:** `appointment_id` (FK), `patient_id` (FK), `card_on_file`, `autopay_setup`, `insurance_verified`, `consent_signed`, `cures_checked`, `controlled_sub_agreement`, `notes`, `completed_at`, `completed_by`, `coda_row_id`

### PostAppointmentTask
Follow-up tasks generated after patient appointments. Includes prescription follow-ups, referrals, prior auth requests, and scheduling tasks. Managed by clinical ops staff in Coda.

**Key fields:** `appointment_id` (FK), `patient_id` (FK), `task_type`, `status`, `assigned_to`, `description`, `due_date`, `completed_at`, `completed_by`, `notes`, `coda_row_id`

### PriorAuthorization
Insurance prior authorization request for a medication or service. Tracks submission date, approval/denial status, expiration, and authorization number. Managed by clinical ops staff in Coda.

**Key fields:** `patient_id` (FK), `appointment_id` (FK, nullable), `insurance_id` (FK, nullable), `medication_id` (FK, nullable), `auth_type`, `status`, `payer_name`, `submitted_date`, `approved_date`, `denied_date`, `expiration_date`, `auth_number`, `notes`, `coda_row_id`

### QuestionnaireResponse
Patient assessment response for standardized instruments (PHQ-9, GAD-7, ASRS, Y-BOCS). Stores raw answers, computed score, severity category, and administration source (email import, patient app, in-office).

**Key fields:** `patient_id` (FK), `appointment_id` (FK, nullable), `questionnaire_type`, `raw_answers` (JSONB), `total_score`, `severity_category`, `administered_at`, `administration_source`, `notes`

### Consent
Patient consent record with version tracking. Captures consent type (treatment, telehealth, controlled substance), version identifier, signature timestamp, and signature method (DrChrono, DocuSign, in-person).

**Key fields:** `patient_id` (FK), `consent_type`, `version`, `signed_at`, `signature_method`, `document_url`, `drchrono_raw` (JSONB)

---

## Audit & Infrastructure Entities

### SyncLog
Tracks every sync operation between external systems and Postgres. Essential for debugging, reconciliation, and compliance reporting.

**Key fields:** `source` (drchrono/deepcura/coda), `operation` (full_sync/webhook/gridhook/incremental/write_back/push), `table_name`, `status` (started/completed/failed/partial), `records_total`, `records_created`, `records_updated`, `records_failed`, `error_message`, `error_details` (JSONB), `started_at`, `completed_at`, `duration_ms`

### ChangeLog
Records every record-level change with before/after state. Required for HIPAA audit trail and debugging data issues.

**Key fields:** `table_name`, `record_id` (UUID), `drchrono_id`, `operation` (INSERT/UPDATE/DELETE), `changed_fields` (TEXT[]), `old_values` (JSONB), `new_values` (JSONB), `sync_id` (FK to SyncLog), `actor`, `created_at`

### AccessLog
Tracks all external API calls for compliance and debugging. Records every call to DrChrono, Coda, and Deep Cura APIs.

**Key fields:** `service` (drchrono_api/coda_api/deepcura_api), `endpoint`, `method`, `status_code`, `request_summary` (JSONB), `response_summary` (JSONB), `duration_ms`, `error`, `created_at`

### ProcessedMessage
Tracks Pub/Sub message IDs to prevent duplicate processing. Uses 7-day TTL for automatic cleanup.

**Key fields:** `message_id`, `topic`, `processed_at`, `expires_at`

### StaffRole
Role-based access control for admin dashboard users. Maps Google Workspace email to a role (admin, operator, viewer). Admins can trigger manual actions and modify settings. Operators can view all data and acknowledge errors. Viewers have read-only access to dashboards and logs.

**Key fields:** `email`, `name`, `role` (admin/operator/viewer), `created_at`

---

## Relationships

### Patient-Centered Relationships
- Patient has many Appointments, Medications, Problems, Allergies, Insurance records, QuestionnaireResponses, and Consents
- All clinical data traces back to a Patient via `patient_id` or `drchrono_patient_id`

### Appointment-Centered Relationships
- Appointment belongs to Patient, Provider, and AppointmentProfile
- Appointment has one ClinicalNote (when signed)
- Appointment has one DeepCuraNote (when AI-processed)
- Appointment has one IntakeChecklist (for pre-visit readiness)
- Appointment has many PostAppointmentTasks (for follow-up)
- Appointment has many LineItems (for billing)

### Clinical Documentation Relationships
- ClinicalNote may link to DeepCuraNote for comparing AI extraction against signed documentation
- DeepCuraNote stores `linked_at` timestamp when matched to a ClinicalNote

### Billing & Authorization Relationships
- LineItem belongs to Appointment for billing reconciliation
- PriorAuthorization belongs to Patient and may link to Insurance or Medication
- Medication may require a PriorAuthorization

### Audit Trail Relationships
- ChangeLog references SyncLog via `sync_id` to trace changes to their triggering sync operation
- All audit entities (SyncLog, ChangeLog, AccessLog) are standalone with no FK dependencies on clinical data

---

## Natural Keys

All DrChrono-synced entities use `drchrono_id` (BIGINT) as the natural key for upserts. This eliminates row ID coupling and ensures idempotent sync operations.

| Entity | Natural Key |
|--------|-------------|
| Patient | `drchrono_id` |
| Provider | `drchrono_id` |
| Appointment | `drchrono_id` |
| AppointmentProfile | `drchrono_id` |
| ClinicalNote | `drchrono_id` |
| Medication | `drchrono_id` |
| Problem | `drchrono_id` |
| Allergy | `drchrono_id` |
| Insurance | `(drchrono_patient_id, insurance_type)` |
| LineItem | `drchrono_id` |
| DeepCuraNote | `id` (UUID, each Gridhook is unique) |
| IntakeChecklist | `appointment_id` |
| PostAppointmentTask | `id` (UUID) |
| PriorAuthorization | `id` (UUID) |
| StaffRole | `email` |

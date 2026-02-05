# Data Model

## Entities

### Patient
A person receiving psychiatric care at Feel August Health. The central entity that all clinical data relates to. Synced from DrChrono with demographics, contact information, and chart ID.

### Provider
A psychiatrist or clinician who delivers care. Synced from DrChrono with NPI, specialty, credentials, and contact details.

### Appointment
A scheduled telehealth visit between a patient and provider. Includes scheduled time, duration, status, reason, and billing information. Synced from DrChrono via webhooks.

### AppointmentProfile
Appointment type definitions such as initial evaluation, 30-minute follow-up, or medication check. Includes standard duration and display settings. Used to categorize appointments.

### ClinicalNote
Provider documentation for a patient visit, synced from DrChrono when the note is locked/signed. Contains structured sections and may reference ICD-10 codes.

### DeepCuraNote
AI-extracted clinical data from a session recording, received via Deep Cura Gridhooks. Contains transcript, SOAP sections, suggested ICD-10 and CPT codes, medication mentions, and risk assessment. Preserved independently from the signed clinical note for quality assurance comparison.

### Medication
A prescribed psychiatric medication for a patient. Includes name, dosage, frequency, route, status (active, discontinued), and prescribing provider. Synced from DrChrono.

### Problem
An active or historical diagnosis for a patient, represented as an ICD-10 code with description. Tracks onset date, status, and resolving provider. Essential for clinical context in psychiatry.

### Allergy
Patient allergy information including allergen, reaction type, and severity. Critical for prescribing safety, especially with psychiatric medications.

### Insurance
Patient insurance coverage information. Includes payer name, member ID, group number, subscriber details, copay, deductible, and eligibility status. Supports primary and secondary insurance.

### LineItem
A billable CPT code associated with an appointment. Used for billing reconciliation and comparison against Deep Cura's CPT suggestions. Includes code, description, units, and fee.

### IntakeChecklist
Pre-appointment readiness tracking for clinical operations staff. Tracks card on file, autopay setup, insurance verification, consent signed, CURES checked, and controlled substance agreement. Lives in Coda with bidirectional sync.

### PriorAuthorization
Insurance prior authorization request for a medication or service. Tracks submission date, approval/denial status, expiration, and authorization number. Managed by clinical ops staff in Coda.

### QuestionnaireResponse
Patient assessment response for standardized instruments (PHQ-9, GAD-7, ASRS, Y-BOCS). Stores raw answers, computed score, severity category, and administration source (email import, patient app, in-office).

### Consent
Patient consent record with version tracking. Captures consent type (treatment, telehealth, controlled substance), version identifier, signature timestamp, and signature method (DrChrono, DocuSign, in-person).

### StaffRole
Role-based access control for admin dashboard users. Maps Google Workspace email to a role (admin, operator, viewer). Admins can trigger manual actions and modify settings. Operators can view all data and acknowledge errors. Viewers have read-only access to dashboards and logs.

## Relationships

- Patient has many Appointments, Medications, Problems, Allergies, Insurance records, QuestionnaireResponses, and Consents
- Provider has many Appointments
- Appointment belongs to Patient, Provider, and AppointmentProfile
- Appointment has one ClinicalNote, one DeepCuraNote, one IntakeChecklist, and many LineItems
- ClinicalNote may link to DeepCuraNote for comparing AI extraction against signed documentation
- Medication belongs to Patient and may require a PriorAuthorization
- LineItem belongs to Appointment for billing reconciliation
- PriorAuthorization belongs to Patient and may link to Insurance or Medication
- Problem belongs to Patient and may reference the diagnosing Provider
- Allergy belongs to Patient
- QuestionnaireResponse belongs to Patient and may link to Appointment if administered in-session
- Consent belongs to Patient
- StaffRole is standalone (keyed by Google Workspace email, no relation to clinical data)

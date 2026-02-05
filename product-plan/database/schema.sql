-- =============================================================================
-- Feel August Platform - Database Schema
-- =============================================================================
-- Database: PostgreSQL 16
-- Purpose: Clinical operations backend for HIPAA-compliant data sync
--
-- This schema implements:
-- 1. DrChrono mirror tables (patients, appointments, clinical_notes, etc.)
-- 2. Deep Cura first-class ingestion (deepcura_notes)
-- 3. Operational tables for Coda workflows
-- 4. Comprehensive audit infrastructure
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- DRCHRONO MIRROR TABLES
-- These tables mirror authoritative data in DrChrono. drchrono_id is the natural key.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PATIENTS
-- -----------------------------------------------------------------------------
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
CREATE INDEX idx_patients_email ON patients(email);

-- -----------------------------------------------------------------------------
-- PROVIDERS
-- -----------------------------------------------------------------------------
CREATE TABLE providers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    npi                 TEXT,
    specialty           TEXT,
    credentials         TEXT,
    email               TEXT,
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_providers_drchrono_id ON providers(drchrono_id);
CREATE INDEX idx_providers_npi ON providers(npi);

-- -----------------------------------------------------------------------------
-- APPOINTMENT PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE appointment_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    duration            INTEGER,
    color               TEXT,
    online_scheduling   BOOLEAN DEFAULT FALSE,
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointment_profiles_drchrono_id ON appointment_profiles(drchrono_id);

-- -----------------------------------------------------------------------------
-- APPOINTMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE appointments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    patient_id          UUID REFERENCES patients(id),
    drchrono_patient_id BIGINT NOT NULL,
    doctor_id           BIGINT,
    office_id           BIGINT,
    profile_id          UUID REFERENCES appointment_profiles(id),
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
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);

-- -----------------------------------------------------------------------------
-- CLINICAL NOTES (from DrChrono)
-- -----------------------------------------------------------------------------
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

CREATE INDEX idx_clinical_notes_drchrono_id ON clinical_notes(drchrono_id);
CREATE INDEX idx_clinical_notes_appointment ON clinical_notes(appointment_id);
CREATE INDEX idx_clinical_notes_patient ON clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_date ON clinical_notes(note_date);

-- -----------------------------------------------------------------------------
-- DEEP CURA NOTES (first-class ingestion via Gridhooks)
-- -----------------------------------------------------------------------------
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
    transcript           TEXT,
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
    gridhook_raw         JSONB NOT NULL,
    gridhook_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Linking
    linked_at            TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deepcura_notes_clinical_note ON deepcura_notes(clinical_note_id);
CREATE INDEX idx_deepcura_notes_appointment ON deepcura_notes(appointment_id);
CREATE INDEX idx_deepcura_notes_patient ON deepcura_notes(patient_id);
CREATE INDEX idx_deepcura_notes_session_date ON deepcura_notes(session_date);
CREATE INDEX idx_deepcura_notes_unlinked ON deepcura_notes(id) WHERE clinical_note_id IS NULL;

-- -----------------------------------------------------------------------------
-- MEDICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE medications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    patient_id          UUID REFERENCES patients(id),
    drchrono_patient_id BIGINT NOT NULL,
    doctor_id           BIGINT,
    name                TEXT NOT NULL,
    rxnorm              TEXT,
    dosage_quantity     TEXT,
    dosage_units        TEXT,
    frequency           TEXT,
    route               TEXT,
    status              TEXT,
    date_prescribed     DATE,
    date_started        DATE,
    date_stopped        DATE,
    daw                 BOOLEAN,
    notes               TEXT,
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_drchrono_id ON medications(drchrono_id);
CREATE INDEX idx_medications_patient ON medications(patient_id);
CREATE INDEX idx_medications_status ON medications(status);

-- -----------------------------------------------------------------------------
-- PROBLEMS (Diagnoses)
-- -----------------------------------------------------------------------------
CREATE TABLE problems (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    patient_id          UUID REFERENCES patients(id),
    drchrono_patient_id BIGINT NOT NULL,
    icd10_code          TEXT NOT NULL,
    description         TEXT,
    date_onset          DATE,
    status              TEXT,
    resolving_doctor_id BIGINT,
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_problems_drchrono_id ON problems(drchrono_id);
CREATE INDEX idx_problems_patient ON problems(patient_id);
CREATE INDEX idx_problems_icd10 ON problems(icd10_code);

-- -----------------------------------------------------------------------------
-- ALLERGIES
-- -----------------------------------------------------------------------------
CREATE TABLE allergies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    patient_id          UUID REFERENCES patients(id),
    drchrono_patient_id BIGINT NOT NULL,
    allergen            TEXT NOT NULL,
    reaction            TEXT,
    severity            TEXT,
    status              TEXT,
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_allergies_drchrono_id ON allergies(drchrono_id);
CREATE INDEX idx_allergies_patient ON allergies(patient_id);

-- -----------------------------------------------------------------------------
-- INSURANCE RECORDS
-- -----------------------------------------------------------------------------
CREATE TABLE insurance_records (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id           UUID REFERENCES patients(id) NOT NULL,
    drchrono_patient_id  BIGINT NOT NULL,
    insurance_type       TEXT NOT NULL,  -- 'primary' or 'secondary'
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
CREATE INDEX idx_insurance_payer ON insurance_records(payer_name);

-- -----------------------------------------------------------------------------
-- LINE ITEMS (Billing)
-- -----------------------------------------------------------------------------
CREATE TABLE line_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drchrono_id         BIGINT UNIQUE NOT NULL,
    appointment_id      UUID REFERENCES appointments(id),
    drchrono_appt_id    BIGINT NOT NULL,
    cpt_code            TEXT NOT NULL,
    description         TEXT,
    units               INTEGER DEFAULT 1,
    fee                 NUMERIC(10,2),
    drchrono_raw        JSONB NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_items_drchrono_id ON line_items(drchrono_id);
CREATE INDEX idx_line_items_appointment ON line_items(appointment_id);
CREATE INDEX idx_line_items_cpt ON line_items(cpt_code);


-- =============================================================================
-- OPERATIONAL TABLES (Coda Workflow Support)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- INTAKE CHECKLISTS
-- -----------------------------------------------------------------------------
CREATE TABLE intake_checklists (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id           UUID REFERENCES appointments(id) NOT NULL,
    patient_id               UUID REFERENCES patients(id) NOT NULL,
    card_on_file             BOOLEAN DEFAULT FALSE,
    autopay_setup            BOOLEAN DEFAULT FALSE,
    insurance_verified       BOOLEAN DEFAULT FALSE,
    consent_signed           BOOLEAN DEFAULT FALSE,
    cures_checked            BOOLEAN DEFAULT FALSE,
    controlled_sub_agreement BOOLEAN DEFAULT FALSE,
    notes                    TEXT,
    completed_at             TIMESTAMPTZ,
    completed_by             TEXT,
    coda_row_id              TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_checklists_appointment ON intake_checklists(appointment_id);
CREATE INDEX idx_intake_checklists_patient ON intake_checklists(patient_id);
CREATE UNIQUE INDEX idx_intake_checklists_appointment_unique ON intake_checklists(appointment_id);

-- -----------------------------------------------------------------------------
-- POST-APPOINTMENT TASKS
-- -----------------------------------------------------------------------------
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

CREATE INDEX idx_post_appt_tasks_appointment ON post_appointment_tasks(appointment_id);
CREATE INDEX idx_post_appt_tasks_patient ON post_appointment_tasks(patient_id);
CREATE INDEX idx_post_appt_tasks_status ON post_appointment_tasks(status);
CREATE INDEX idx_post_appt_tasks_assigned ON post_appointment_tasks(assigned_to);

-- -----------------------------------------------------------------------------
-- PRIOR AUTHORIZATIONS
-- -----------------------------------------------------------------------------
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
CREATE INDEX idx_prior_auth_expiration ON prior_authorizations(expiration_date);

-- -----------------------------------------------------------------------------
-- QUESTIONNAIRE RESPONSES
-- -----------------------------------------------------------------------------
CREATE TABLE questionnaire_responses (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id            UUID REFERENCES patients(id) NOT NULL,
    appointment_id        UUID REFERENCES appointments(id),
    questionnaire_type    TEXT NOT NULL,  -- 'PHQ-9', 'GAD-7', 'ASRS', 'Y-BOCS'
    raw_answers           JSONB NOT NULL,
    total_score           INTEGER,
    severity_category     TEXT,
    administered_at       TIMESTAMPTZ NOT NULL,
    administration_source TEXT NOT NULL,  -- 'email_import', 'patient_app', 'in_office'
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questionnaire_patient ON questionnaire_responses(patient_id);
CREATE INDEX idx_questionnaire_type ON questionnaire_responses(questionnaire_type);
CREATE INDEX idx_questionnaire_administered ON questionnaire_responses(administered_at);

-- -----------------------------------------------------------------------------
-- CONSENT RECORDS
-- -----------------------------------------------------------------------------
CREATE TABLE consent_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID REFERENCES patients(id) NOT NULL,
    consent_type        TEXT NOT NULL,  -- 'treatment', 'telehealth', 'controlled_substance'
    version             TEXT NOT NULL,
    signed_at           TIMESTAMPTZ NOT NULL,
    signature_method    TEXT NOT NULL,  -- 'drchrono', 'docusign', 'in_person'
    document_url        TEXT,
    drchrono_raw        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_patient ON consent_records(patient_id);
CREATE INDEX idx_consent_type ON consent_records(consent_type);


-- =============================================================================
-- AUDIT & SYNC INFRASTRUCTURE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SYNC LOG - tracks every sync operation
-- -----------------------------------------------------------------------------
CREATE TABLE sync_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source          TEXT NOT NULL,        -- 'drchrono', 'deepcura', 'coda'
    operation       TEXT NOT NULL,        -- 'full_sync', 'webhook', 'gridhook', 'incremental', 'write_back', 'push'
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
CREATE INDEX idx_sync_log_table ON sync_log(table_name);
CREATE INDEX idx_sync_log_started ON sync_log(started_at DESC);

-- -----------------------------------------------------------------------------
-- CHANGE LOG - tracks every record-level change (before/after)
-- -----------------------------------------------------------------------------
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
CREATE INDEX idx_change_log_drchrono ON change_log(drchrono_id);
CREATE INDEX idx_change_log_created ON change_log(created_at DESC);
CREATE INDEX idx_change_log_sync ON change_log(sync_id);

-- -----------------------------------------------------------------------------
-- ACCESS LOG - tracks all external API access
-- -----------------------------------------------------------------------------
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
CREATE INDEX idx_access_log_created ON access_log(created_at DESC);

-- -----------------------------------------------------------------------------
-- PROCESSED MESSAGES - Pub/Sub deduplication
-- -----------------------------------------------------------------------------
CREATE TABLE processed_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id      TEXT UNIQUE NOT NULL,
    topic           TEXT NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_processed_messages_message_id ON processed_messages(message_id);
CREATE INDEX idx_processed_messages_expires ON processed_messages(expires_at);

-- -----------------------------------------------------------------------------
-- STAFF ROLES - RBAC for admin dashboard
-- -----------------------------------------------------------------------------
CREATE TABLE staff_roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_roles_email ON staff_roles(email);


-- =============================================================================
-- AUDIT TRIGGER FUNCTION
-- =============================================================================

-- Generic audit trigger function that logs all changes
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    changed_cols TEXT[];
    col TEXT;
    old_drchrono_id BIGINT;
BEGIN
    -- Try to get drchrono_id from the record
    BEGIN
        IF TG_OP = 'DELETE' THEN
            old_drchrono_id := (to_jsonb(OLD) ->> 'drchrono_id')::BIGINT;
        ELSE
            old_drchrono_id := (to_jsonb(NEW) ->> 'drchrono_id')::BIGINT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        old_drchrono_id := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO change_log (table_name, record_id, drchrono_id, operation, new_values, actor)
        VALUES (
            TG_TABLE_NAME,
            NEW.id,
            old_drchrono_id,
            'INSERT',
            to_jsonb(NEW),
            COALESCE(current_setting('app.actor', true), 'system')
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Find changed columns
        FOR col IN SELECT column_name FROM information_schema.columns
                   WHERE table_name = TG_TABLE_NAME AND table_schema = TG_TABLE_SCHEMA
        LOOP
            IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
                changed_cols := array_append(changed_cols, col);
            END IF;
        END LOOP;

        -- Only log if something actually changed
        IF array_length(changed_cols, 1) > 0 THEN
            INSERT INTO change_log (table_name, record_id, drchrono_id, operation, changed_fields, old_values, new_values, actor)
            VALUES (
                TG_TABLE_NAME,
                NEW.id,
                old_drchrono_id,
                'UPDATE',
                changed_cols,
                to_jsonb(OLD),
                to_jsonb(NEW),
                COALESCE(current_setting('app.actor', true), 'system')
            );
        END IF;

        -- Auto-update updated_at timestamp
        NEW.updated_at = NOW();
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO change_log (table_name, record_id, drchrono_id, operation, old_values, actor)
        VALUES (
            TG_TABLE_NAME,
            OLD.id,
            old_drchrono_id,
            'DELETE',
            to_jsonb(OLD),
            COALESCE(current_setting('app.actor', true), 'system')
        );
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- APPLY AUDIT TRIGGERS TO ALL TABLES
-- =============================================================================

-- DrChrono mirror tables
CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_providers AFTER INSERT OR UPDATE OR DELETE ON providers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_appointment_profiles AFTER INSERT OR UPDATE OR DELETE ON appointment_profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_appointments AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_clinical_notes AFTER INSERT OR UPDATE OR DELETE ON clinical_notes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_deepcura_notes AFTER INSERT OR UPDATE OR DELETE ON deepcura_notes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_medications AFTER INSERT OR UPDATE OR DELETE ON medications
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_problems AFTER INSERT OR UPDATE OR DELETE ON problems
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_allergies AFTER INSERT OR UPDATE OR DELETE ON allergies
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_insurance AFTER INSERT OR UPDATE OR DELETE ON insurance_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_line_items AFTER INSERT OR UPDATE OR DELETE ON line_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Operational tables
CREATE TRIGGER audit_intake_checklists AFTER INSERT OR UPDATE OR DELETE ON intake_checklists
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_post_appt_tasks AFTER INSERT OR UPDATE OR DELETE ON post_appointment_tasks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_prior_auth AFTER INSERT OR UPDATE OR DELETE ON prior_authorizations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_questionnaire_responses AFTER INSERT OR UPDATE OR DELETE ON questionnaire_responses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_consent_records AFTER INSERT OR UPDATE OR DELETE ON consent_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();


-- =============================================================================
-- RETENTION POLICY FUNCTIONS
-- =============================================================================

-- 7-year retention for audit data (HIPAA requirement)
-- Run monthly via Cloud Scheduler
CREATE OR REPLACE FUNCTION cleanup_expired_audit_data()
RETURNS void AS $$
BEGIN
    DELETE FROM change_log WHERE created_at < NOW() - INTERVAL '7 years';
    DELETE FROM sync_log WHERE started_at < NOW() - INTERVAL '7 years';
    DELETE FROM access_log WHERE created_at < NOW() - INTERVAL '7 years';
END;
$$ LANGUAGE plpgsql;

-- 7-day cleanup for processed messages (deduplication)
-- Run daily via Cloud Scheduler
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM processed_messages WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- HELPER VIEWS
-- =============================================================================

-- View for unlinked Deep Cura notes (pending review)
CREATE VIEW unlinked_deepcura_notes AS
SELECT
    d.id,
    d.session_date,
    d.drchrono_patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    d.soap_subjective,
    d.icd10_codes,
    d.cpt_codes,
    d.gridhook_received_at,
    d.created_at
FROM deepcura_notes d
LEFT JOIN patients p ON d.patient_id = p.id
WHERE d.clinical_note_id IS NULL
  AND d.linked_at IS NULL
ORDER BY d.gridhook_received_at DESC;

-- View for recent sync health metrics
CREATE VIEW sync_health_24h AS
SELECT
    source,
    COUNT(*) AS total_syncs,
    COUNT(*) FILTER (WHERE status = 'completed') AS successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_syncs,
    AVG(duration_ms) AS avg_duration_ms,
    SUM(records_created) AS records_created,
    SUM(records_updated) AS records_updated,
    MAX(completed_at) AS last_sync_at
FROM sync_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY source;


-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert default staff roles (update with actual emails)
-- INSERT INTO staff_roles (email, name, role) VALUES
--     ('bobby@feelaugust.com', 'Bobby', 'admin'),
--     ('admin@feelaugust.com', 'Admin', 'admin');

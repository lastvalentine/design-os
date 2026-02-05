# DrChrono Sync Service Implementation Guide

The core sync service that receives DrChrono webhooks, Deep Cura Gridhooks, and performs scheduled reconciliation.

## Service Overview

**Name:** `drchrono-sync`
**Runtime:** Node.js 20 on Cloud Run
**Framework:** Express.js or Hono
**Triggers:** DrChrono webhooks, Deep Cura Gridhooks, Cloud Scheduler

## Directory Structure

```
services/drchrono-sync/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Entry point, Express setup
│   ├── config.ts                # Environment configuration
│   ├── webhooks.ts              # DrChrono webhook handler
│   ├── deepcura-webhook.ts      # Deep Cura Gridhook handler
│   │
│   ├── sync/
│   │   ├── index.ts             # Sync orchestration
│   │   ├── patients.ts          # Patient sync logic
│   │   ├── appointments.ts      # Appointment sync logic
│   │   ├── clinical-notes.ts    # Clinical notes sync logic
│   │   ├── medications.ts       # Medications sync logic
│   │   ├── problems.ts          # Problems sync logic
│   │   ├── allergies.ts         # Allergies sync logic
│   │   ├── insurance.ts         # Insurance sync logic
│   │   └── line-items.ts        # Line items sync logic
│   │
│   ├── drchrono/
│   │   ├── client.ts            # DrChrono API client
│   │   ├── oauth.ts             # OAuth token management
│   │   ├── types.ts             # DrChrono API types
│   │   └── webhooks.ts          # Webhook signature verification
│   │
│   ├── deepcura/
│   │   ├── decrypt.ts           # AES decryption
│   │   ├── parser.ts            # Payload field extraction
│   │   ├── linker.ts            # Note linking logic
│   │   └── types.ts             # Gridhook payload types
│   │
│   ├── db/
│   │   ├── connection.ts        # Database connection pool
│   │   ├── queries.ts           # SQL query helpers
│   │   └── upsert.ts            # Upsert helpers
│   │
│   ├── pubsub/
│   │   └── publisher.ts         # Pub/Sub event publishing
│   │
│   └── audit/
│       └── logger.ts            # Audit logging helpers
│
└── tests/
    ├── webhooks.test.ts
    ├── sync/
    └── drchrono/
```

---

## Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/webhooks/drchrono` | POST | Receive DrChrono webhook events | Signature verification |
| `/webhooks/deepcura` | POST | Receive Deep Cura Gridhooks | Shared secret |
| `/sync/patients` | POST | Full patient sync | Cloud Scheduler OIDC |
| `/sync/appointments` | POST | Full appointment sync | Cloud Scheduler OIDC |
| `/sync/clinical-notes` | POST | Full clinical notes sync | Cloud Scheduler OIDC |
| `/sync/medications` | POST | Full medications sync | Cloud Scheduler OIDC |
| `/sync/problems` | POST | Full problems sync | Cloud Scheduler OIDC |
| `/sync/all` | POST | Orchestrate full sync | Cloud Scheduler OIDC |
| `/maintenance/cleanup` | POST | Run retention cleanup | Cloud Scheduler OIDC |
| `/health` | GET | Health check | None |

---

## Implementation Details

### Entry Point (`src/index.ts`)

```typescript
import express from 'express';
import { handleDrChronoWebhook } from './webhooks';
import { handleDeepCuraWebhook } from './deepcura-webhook';
import { syncPatients, syncAppointments, syncClinicalNotes, syncAll } from './sync';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Webhooks
app.post('/webhooks/drchrono', handleDrChronoWebhook);
app.post('/webhooks/deepcura', handleDeepCuraWebhook);

// Scheduled syncs
app.post('/sync/patients', syncPatients);
app.post('/sync/appointments', syncAppointments);
app.post('/sync/clinical-notes', syncClinicalNotes);
app.post('/sync/medications', syncMedications);
app.post('/sync/problems', syncProblems);
app.post('/sync/all', syncAll);

// Maintenance
app.post('/maintenance/cleanup', runRetentionCleanup);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
```

### DrChrono Webhook Handler (`src/webhooks.ts`)

```typescript
import { Request, Response } from 'express';
import { verifyWebhookSignature } from './drchrono/webhooks';
import { fetchPatient, fetchAppointment, fetchClinicalNote } from './drchrono/client';
import { upsertPatient, upsertAppointment, upsertClinicalNote } from './db/upsert';
import { publishChangeEvent } from './pubsub/publisher';
import { createSyncLog, completeSyncLog } from './audit/logger';

export async function handleDrChronoWebhook(req: Request, res: Response) {
  // Verify signature
  if (!verifyWebhookSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, object_id } = req.body;
  const syncLog = await createSyncLog('drchrono', 'webhook', getTableFromEvent(event));

  try {
    switch (event) {
      case 'PATIENT_CREATE':
      case 'PATIENT_MODIFY':
        const patient = await fetchPatient(object_id);
        const result = await upsertPatient(patient);
        await publishChangeEvent('patients', result.operation, result.id, object_id);
        break;

      case 'APPOINTMENT_CREATE':
      case 'APPOINTMENT_MODIFY':
        const appointment = await fetchAppointment(object_id);
        const apptResult = await upsertAppointment(appointment);
        await publishChangeEvent('appointments', apptResult.operation, apptResult.id, object_id);
        break;

      case 'CLINICAL_NOTE_MODIFY':
      case 'CLINICAL_NOTE_LOCK':
        const note = await fetchClinicalNote(object_id);
        const noteResult = await upsertClinicalNote(note);
        await publishChangeEvent('clinical_notes', noteResult.operation, noteResult.id, object_id);
        break;

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    await completeSyncLog(syncLog.id, 'completed', { recordsUpdated: 1 });
    res.json({ status: 'ok' });

  } catch (error) {
    await completeSyncLog(syncLog.id, 'failed', { error: error.message });
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}
```

### Deep Cura Gridhook Handler (`src/deepcura-webhook.ts`)

```typescript
import { Request, Response } from 'express';
import { decryptGridhookPayload } from './deepcura/decrypt';
import { parseDeepCuraPayload } from './deepcura/parser';
import { linkToClinicialNote } from './deepcura/linker';
import { insertDeepCuraNote } from './db/queries';
import { publishChangeEvent } from './pubsub/publisher';
import { createSyncLog, completeSyncLog } from './audit/logger';

export async function handleDeepCuraWebhook(req: Request, res: Response) {
  // Verify shared secret
  const authHeader = req.headers['x-deepcura-secret'];
  if (authHeader !== process.env.DEEPCURA_SHARED_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const syncLog = await createSyncLog('deepcura', 'gridhook', 'deepcura_notes');

  try {
    // Decrypt AES-encrypted payload
    const decrypted = decryptGridhookPayload(req.body.encrypted_payload);

    // Parse structured fields
    const parsed = parseDeepCuraPayload(decrypted);

    // Insert into database
    const note = await insertDeepCuraNote({
      drchrono_appt_id: parsed.appointmentId,
      drchrono_patient_id: parsed.patientId,
      doctor_id: parsed.doctorId,
      session_date: parsed.sessionDate,
      transcript: parsed.transcript,
      soap_subjective: parsed.soap?.subjective,
      soap_objective: parsed.soap?.objective,
      soap_assessment: parsed.soap?.assessment,
      soap_plan: parsed.soap?.plan,
      icd10_codes: parsed.icd10Codes,
      cpt_codes: parsed.cptCodes,
      medication_mentions: parsed.medicationMentions,
      billing_summary: parsed.billingSummary,
      risk_assessment: parsed.riskAssessment,
      gridhook_raw: decrypted,
    });

    // Attempt to link to clinical note
    const linked = await linkToClinicialNote(note.id, parsed);

    await publishChangeEvent('deepcura_notes', 'INSERT', note.id, null);
    await completeSyncLog(syncLog.id, 'completed', {
      recordsCreated: 1,
      linkedToClinicalNote: linked,
    });

    res.json({ status: 'ok', noteId: note.id, linked });

  } catch (error) {
    await completeSyncLog(syncLog.id, 'failed', { error: error.message });
    console.error('Gridhook processing failed:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
}
```

### Deep Cura Decryption (`src/deepcura/decrypt.ts`)

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

export function decryptGridhookPayload(encryptedPayload: string): any {
  const sharedSecret = process.env.DEEPCURA_SHARED_SECRET!;

  // Derive key and IV from shared secret
  const key = crypto.scryptSync(sharedSecret, 'salt', 32);
  const iv = Buffer.alloc(16, 0); // Or extract from payload if Deep Cura includes it

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedPayload, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
```

### Deep Cura Note Linking (`src/deepcura/linker.ts`)

```typescript
import { query } from '../db/connection';

export async function linkToClinicialNote(
  deepCuraNoteId: string,
  parsed: ParsedDeepCuraPayload
): Promise<boolean> {
  // Strategy 1: Match on DrChrono appointment ID
  if (parsed.appointmentId) {
    const result = await query(`
      UPDATE deepcura_notes dn
      SET clinical_note_id = cn.id, linked_at = NOW()
      FROM clinical_notes cn
      WHERE dn.id = $1
        AND cn.drchrono_appt_id = $2
      RETURNING dn.id
    `, [deepCuraNoteId, parsed.appointmentId]);

    if (result.rowCount > 0) return true;
  }

  // Strategy 2: Match on patient + date
  if (parsed.patientId && parsed.sessionDate) {
    const result = await query(`
      UPDATE deepcura_notes dn
      SET clinical_note_id = cn.id, linked_at = NOW()
      FROM clinical_notes cn
      WHERE dn.id = $1
        AND cn.drchrono_patient_id = $2
        AND cn.note_date = $3
      RETURNING dn.id
    `, [deepCuraNoteId, parsed.patientId, parsed.sessionDate]);

    if (result.rowCount > 0) return true;
  }

  // No match found - note remains unlinked for manual review
  return false;
}
```

### Full Sync Logic (`src/sync/patients.ts`)

```typescript
import { Request, Response } from 'express';
import { fetchPatientsBulk } from '../drchrono/client';
import { upsertPatient } from '../db/upsert';
import { publishChangeEvent } from '../pubsub/publisher';
import { createSyncLog, completeSyncLog } from '../audit/logger';
import { getLastSyncTime, updateLastSyncTime } from '../db/queries';

export async function syncPatients(req: Request, res: Response) {
  const syncLog = await createSyncLog('drchrono', 'full_sync', 'patients');

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;

  try {
    // Get last sync time for incremental sync
    const lastSync = await getLastSyncTime('patients');
    const since = lastSync ? lastSync.toISOString() : '2024-01-01T00:00:00Z';

    // Fetch patients from bulk API
    const patients = await fetchPatientsBulk({ since });

    for (const patient of patients) {
      try {
        const result = await upsertPatient(patient);

        if (result.operation === 'INSERT') {
          recordsCreated++;
        } else {
          recordsUpdated++;
        }

        await publishChangeEvent('patients', result.operation, result.id, patient.id);
      } catch (error) {
        console.error(`Failed to sync patient ${patient.id}:`, error);
        recordsFailed++;
      }
    }

    await updateLastSyncTime('patients');
    await completeSyncLog(syncLog.id, 'completed', {
      recordsTotal: patients.length,
      recordsCreated,
      recordsUpdated,
      recordsFailed,
    });

    res.json({
      status: 'completed',
      total: patients.length,
      created: recordsCreated,
      updated: recordsUpdated,
      failed: recordsFailed,
    });

  } catch (error) {
    await completeSyncLog(syncLog.id, 'failed', { error: error.message });
    console.error('Patient sync failed:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
}
```

### Upsert Helper (`src/db/upsert.ts`)

```typescript
import { query } from './connection';

export interface UpsertResult {
  id: string;
  drchrono_id: number;
  operation: 'INSERT' | 'UPDATE';
}

export async function upsertPatient(patient: DrChronoPatient): Promise<UpsertResult> {
  // Set audit context
  await query(`SET LOCAL app.actor = 'drchrono_sync'`);

  const result = await query(`
    INSERT INTO patients (
      drchrono_id, first_name, last_name, date_of_birth,
      email, phone, gender, address, emergency_contact,
      primary_insurance, secondary_insurance, referring_source,
      chart_id, drchrono_raw, synced_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
    ON CONFLICT (drchrono_id)
    DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      date_of_birth = EXCLUDED.date_of_birth,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      gender = EXCLUDED.gender,
      address = EXCLUDED.address,
      emergency_contact = EXCLUDED.emergency_contact,
      primary_insurance = EXCLUDED.primary_insurance,
      secondary_insurance = EXCLUDED.secondary_insurance,
      referring_source = EXCLUDED.referring_source,
      chart_id = EXCLUDED.chart_id,
      drchrono_raw = EXCLUDED.drchrono_raw,
      synced_at = NOW()
    RETURNING id, drchrono_id, (xmax = 0) AS inserted
  `, [
    patient.id,
    patient.first_name,
    patient.last_name,
    patient.date_of_birth,
    patient.email,
    patient.cell_phone || patient.home_phone,
    patient.gender,
    JSON.stringify(patient.address || {}),
    JSON.stringify(patient.emergency_contact || {}),
    JSON.stringify(patient.primary_insurance || {}),
    JSON.stringify(patient.secondary_insurance || {}),
    patient.referring_source,
    patient.chart_id,
    JSON.stringify(patient),
  ]);

  return {
    id: result.rows[0].id,
    drchrono_id: result.rows[0].drchrono_id,
    operation: result.rows[0].inserted ? 'INSERT' : 'UPDATE',
  };
}
```

### Pub/Sub Publisher (`src/pubsub/publisher.ts`)

```typescript
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub();
const topic = pubsub.topic(process.env.PUBSUB_TOPIC || 'change-events');

export interface ChangeEvent {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  drchrono_id: number | null;
  timestamp: string;
}

export async function publishChangeEvent(
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string,
  drchronoId: number | null
): Promise<void> {
  const event: ChangeEvent = {
    table,
    operation,
    record_id: recordId,
    drchrono_id: drchronoId,
    timestamp: new Date().toISOString(),
  };

  await topic.publishMessage({
    json: event,
    attributes: {
      table,
      operation,
    },
  });
}
```

---

## Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `PORT` | Server port | Default 8080 |
| `DB_HOST` | Cloud SQL private IP | Terraform output |
| `DB_NAME` | Database name | `clinical` |
| `DB_USER` | Database user | `app_user` |
| `DB_PASSWORD` | Database password | Secret Manager |
| `DRCHRONO_CLIENT_ID` | OAuth client ID | Secret Manager |
| `DRCHRONO_CLIENT_SECRET` | OAuth client secret | Secret Manager |
| `DRCHRONO_ACCESS_TOKEN` | Current access token | Secret Manager |
| `DRCHRONO_REFRESH_TOKEN` | Refresh token | Secret Manager |
| `DEEPCURA_SHARED_SECRET` | Gridhook AES key | Secret Manager |
| `PUBSUB_TOPIC` | Change events topic | `change-events` |
| `GCP_PROJECT` | GCP project ID | Environment |

---

## Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

---

## Deployment

```bash
# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/drchrono-sync

# Deploy to Cloud Run
gcloud run deploy drchrono-sync \
  --image=gcr.io/$PROJECT_ID/drchrono-sync \
  --region=us-west1 \
  --service-account=drchrono-sync-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=feel-august-connector \
  --min-instances=1 \
  --max-instances=5 \
  --memory=512Mi \
  --timeout=300s \
  --set-env-vars="DB_HOST=10.x.x.x,DB_NAME=clinical,PUBSUB_TOPIC=change-events" \
  --set-secrets="DB_PASSWORD=db-password:latest,DRCHRONO_CLIENT_ID=drchrono-client-id:latest,DRCHRONO_CLIENT_SECRET=drchrono-client-secret:latest,DEEPCURA_SHARED_SECRET=deepcura-shared-secret:latest"
```

---

## Testing Checklist

- [ ] Health endpoint returns 200
- [ ] DrChrono webhook signature verification works
- [ ] Patient webhook creates new patient record
- [ ] Patient webhook updates existing patient record
- [ ] Appointment webhook creates appointment with patient FK
- [ ] Clinical note webhook creates note when locked
- [ ] Deep Cura Gridhook decrypts and stores note
- [ ] Deep Cura note links to clinical note by appointment ID
- [ ] Deep Cura note links to clinical note by patient + date
- [ ] Unlinked Deep Cura notes visible in admin dashboard
- [ ] Full sync fetches patients incrementally using `since`
- [ ] Pub/Sub messages published for each upsert
- [ ] Audit trigger logs all changes to change_log
- [ ] sync_log records created for each operation

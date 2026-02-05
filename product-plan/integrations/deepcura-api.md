# Deep Cura Integration Guide

Reference documentation for integrating with Deep Cura's Gridhook system for AI-extracted clinical notes.

## Overview

Deep Cura is an AI-powered clinical documentation tool that:
- Listens to patient sessions (audio)
- Extracts structured clinical data (SOAP notes, ICD-10, CPT codes, medications)
- Pushes structured data via "Gridhooks" to configured endpoints
- Also integrates directly with DrChrono (notes appear in DrChrono clinical notes)

The Feel August Platform receives Deep Cura data via **two channels**:
1. **DrChrono integration** — AI-generated notes pushed to DrChrono, synced via webhooks
2. **Gridhooks (direct)** — Raw AI extraction with more detail, pushed directly to our endpoint

---

## Gridhook System

### What Are Gridhooks?

Gridhooks are Deep Cura's webhook system that pushes structured clinical data to arbitrary endpoints. The payload contains:
- Session transcript (if enabled)
- SOAP note sections (Subjective, Objective, Assessment, Plan)
- Suggested ICD-10 codes with confidence scores
- Suggested CPT codes with units
- Medication mentions (name, dosage, action)
- Risk/safety assessment flags
- Billing summary

### Why Both Channels?

| Channel | Pros | Cons |
|---------|------|------|
| DrChrono integration | Provider-edited final note | Only signed content, no AI provenance |
| Gridhooks (direct) | Raw AI extraction, full detail | Unedited, may differ from signed note |

By capturing both, we can:
- Compare AI suggestions vs. provider-signed documentation
- Surface CPT code discrepancies for billing review
- Track AI extraction quality over time
- Build patient bios from AI summaries

---

## Gridhook Configuration

### Setup in Deep Cura

1. Log into Deep Cura admin panel
2. Navigate to Settings → Integrations → Gridhooks
3. Add a new endpoint:
   - **URL:** `https://drchrono-sync-xxx.run.app/webhooks/deepcura`
   - **Shared Secret:** Generate a strong secret (32+ characters)
   - **Encryption:** Enable AES encryption
   - **Fields:** Enable all fields you want to receive

4. Store the shared secret in GCP Secret Manager as `deepcura-shared-secret`

### Gridhook Payload Structure

The payload is AES-encrypted using the shared secret. After decryption:

```json
{
  "event_type": "session_complete",
  "session_id": "abc123",
  "appointment_id": 12345,
  "patient_id": 67890,
  "doctor_id": 111,
  "session_date": "2024-02-05",
  "session_time": "14:30:00",
  "duration_minutes": 30,

  "transcript": "Full session transcript...",

  "soap": {
    "subjective": "Patient reports improvement in anxiety...",
    "objective": "Alert and oriented. Affect appropriate...",
    "assessment": "GAD improving on current regimen...",
    "plan": "Continue current medications. Follow up in 4 weeks..."
  },

  "icd10_codes": [
    { "code": "F41.1", "description": "Generalized anxiety disorder", "confidence": 0.95 },
    { "code": "F32.1", "description": "Major depressive disorder, moderate", "confidence": 0.82 }
  ],

  "cpt_codes": [
    { "code": "99214", "description": "Office visit, established patient, 30-39 min", "units": 1 },
    { "code": "90833", "description": "Psychotherapy add-on, 16 min", "units": 1 }
  ],

  "medication_mentions": [
    { "name": "sertraline", "dosage": "100mg", "action": "continue", "reason": "anxiety" },
    { "name": "trazodone", "dosage": "50mg", "action": "continue", "reason": "sleep" }
  ],

  "risk_assessment": {
    "suicidal_ideation": false,
    "homicidal_ideation": false,
    "safety_plan_discussed": false,
    "flags": []
  },

  "billing_summary": {
    "visit_type": "follow_up",
    "complexity": "moderate",
    "time_based_billing": false,
    "total_time_minutes": 30
  }
}
```

---

## AES Decryption

Gridhook payloads are encrypted with AES-256-CBC.

### Decryption Implementation

```typescript
// src/deepcura/decrypt.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

export function decryptGridhookPayload(encryptedData: string): any {
  const sharedSecret = process.env.DEEPCURA_SHARED_SECRET!;

  // Deep Cura's encryption format:
  // Base64(IV + EncryptedData)
  const combined = Buffer.from(encryptedData, 'base64');
  const iv = combined.slice(0, 16);
  const encrypted = combined.slice(16);

  // Derive key from shared secret using SHA-256
  const key = crypto.createHash('sha256').update(sharedSecret).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
```

**Note:** The exact encryption format may vary. Contact Deep Cura support for your account's specific implementation details.

---

## Field Parsing

### Parsing the Decrypted Payload

```typescript
// src/deepcura/parser.ts

export interface ParsedDeepCuraPayload {
  sessionId: string;
  appointmentId: number | null;
  patientId: number | null;
  doctorId: number | null;
  sessionDate: string;
  transcript: string | null;
  soap: {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
  };
  icd10Codes: Array<{ code: string; description: string; confidence: number }>;
  cptCodes: Array<{ code: string; description: string; units: number }>;
  medicationMentions: Array<{
    name: string;
    dosage: string;
    action: string;
    reason: string;
  }>;
  riskAssessment: {
    suicidalIdeation: boolean;
    homicidalIdeation: boolean;
    flags: string[];
  };
  billingSummary: object;
}

export function parseDeepCuraPayload(raw: any): ParsedDeepCuraPayload {
  return {
    sessionId: raw.session_id,
    appointmentId: raw.appointment_id || null,
    patientId: raw.patient_id || null,
    doctorId: raw.doctor_id || null,
    sessionDate: raw.session_date,
    transcript: raw.transcript || null,
    soap: {
      subjective: raw.soap?.subjective || null,
      objective: raw.soap?.objective || null,
      assessment: raw.soap?.assessment || null,
      plan: raw.soap?.plan || null,
    },
    icd10Codes: (raw.icd10_codes || []).map((c: any) => ({
      code: c.code,
      description: c.description,
      confidence: c.confidence || 0,
    })),
    cptCodes: (raw.cpt_codes || []).map((c: any) => ({
      code: c.code,
      description: c.description,
      units: c.units || 1,
    })),
    medicationMentions: (raw.medication_mentions || []).map((m: any) => ({
      name: m.name,
      dosage: m.dosage || '',
      action: m.action || '',
      reason: m.reason || '',
    })),
    riskAssessment: {
      suicidalIdeation: raw.risk_assessment?.suicidal_ideation || false,
      homicidalIdeation: raw.risk_assessment?.homicidal_ideation || false,
      flags: raw.risk_assessment?.flags || [],
    },
    billingSummary: raw.billing_summary || {},
  };
}
```

---

## Note Linking

Deep Cura notes should be linked to their corresponding DrChrono clinical notes. This enables comparison between AI extraction and provider-signed documentation.

### Linking Strategy

1. **Primary:** Match on `appointment_id` (DrChrono appointment ID)
2. **Fallback:** Match on `patient_id` + `session_date`
3. **Manual:** If no automatic match, flag for admin review

```typescript
// src/deepcura/linker.ts

export async function linkToClinicialNote(
  deepCuraNoteId: string,
  parsed: ParsedDeepCuraPayload
): Promise<{ linked: boolean; clinicalNoteId: string | null }> {
  // Strategy 1: Match on appointment ID
  if (parsed.appointmentId) {
    const result = await query(`
      UPDATE deepcura_notes dn
      SET clinical_note_id = cn.id,
          linked_at = NOW()
      FROM clinical_notes cn
      WHERE dn.id = $1
        AND cn.drchrono_appt_id = $2
      RETURNING cn.id as clinical_note_id
    `, [deepCuraNoteId, parsed.appointmentId]);

    if (result.rowCount > 0) {
      return { linked: true, clinicalNoteId: result.rows[0].clinical_note_id };
    }
  }

  // Strategy 2: Match on patient + date
  if (parsed.patientId && parsed.sessionDate) {
    const result = await query(`
      UPDATE deepcura_notes dn
      SET clinical_note_id = cn.id,
          linked_at = NOW()
      FROM clinical_notes cn
      WHERE dn.id = $1
        AND cn.drchrono_patient_id = $2
        AND cn.note_date = $3::date
      RETURNING cn.id as clinical_note_id
    `, [deepCuraNoteId, parsed.patientId, parsed.sessionDate]);

    if (result.rowCount > 0) {
      return { linked: true, clinicalNoteId: result.rows[0].clinical_note_id };
    }
  }

  // No match — note remains unlinked for manual review
  return { linked: false, clinicalNoteId: null };
}
```

### Unlinked Notes Review

Unlinked notes appear in the admin dashboard for manual review:
- View the Deep Cura note details
- See suggested clinical note matches (by patient/date proximity)
- Manually link to the correct clinical note
- Or dismiss as "unlinked acceptable" (e.g., training session, test)

---

## Webhook Endpoint

### Implementation

```typescript
// src/deepcura-webhook.ts

export async function handleDeepCuraWebhook(req: Request, res: Response) {
  // Verify authentication
  const secret = req.headers['x-deepcura-secret'] || req.headers['authorization'];
  if (secret !== `Bearer ${process.env.DEEPCURA_SHARED_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const syncLog = await createSyncLog('deepcura', 'gridhook', 'deepcura_notes');

  try {
    // Decrypt payload
    const encryptedPayload = req.body.encrypted_payload || req.body.payload;
    const decrypted = decryptGridhookPayload(encryptedPayload);

    // Parse fields
    const parsed = parseDeepCuraPayload(decrypted);

    // Insert into database
    const note = await insertDeepCuraNote(parsed, decrypted);

    // Attempt linking
    const linkResult = await linkToClinicialNote(note.id, parsed);

    await completeSyncLog(syncLog.id, 'completed', {
      recordsCreated: 1,
      linkedToClinicalNote: linkResult.linked,
    });

    res.json({
      status: 'ok',
      noteId: note.id,
      linked: linkResult.linked,
    });

  } catch (error) {
    console.error('Gridhook processing failed:', error);
    await completeSyncLog(syncLog.id, 'failed', {
      error: error.message,
    });
    res.status(500).json({ error: 'Processing failed' });
  }
}
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Decryption failed | Wrong shared secret or format change | Verify secret, contact Deep Cura support |
| Invalid JSON | Corrupted payload | Log and alert, may need Deep Cura investigation |
| Missing fields | Payload schema changed | Update parser, add field validation |
| Linking failed | No matching clinical note | Normal — note may arrive before DrChrono note |

---

## Testing

### Mock Gridhook for Testing

```typescript
const mockPayload = {
  session_id: 'test-123',
  appointment_id: 12345,
  patient_id: 67890,
  doctor_id: 111,
  session_date: '2024-02-05',
  transcript: 'Test transcript...',
  soap: {
    subjective: 'Test subjective...',
    objective: 'Test objective...',
    assessment: 'Test assessment...',
    plan: 'Test plan...',
  },
  icd10_codes: [
    { code: 'F41.1', description: 'GAD', confidence: 0.9 },
  ],
  cpt_codes: [
    { code: '99214', description: 'Office visit', units: 1 },
  ],
  medication_mentions: [],
  risk_assessment: { suicidal_ideation: false, homicidal_ideation: false, flags: [] },
  billing_summary: {},
};

// Encrypt for testing
function encryptTestPayload(payload: any, secret: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(secret).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(payload), 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString('base64');
}
```

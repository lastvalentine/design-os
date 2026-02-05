# DrChrono API Integration Guide

Reference documentation for integrating with the DrChrono EHR API.

## Overview

DrChrono is the primary EHR system. The integration involves:
- OAuth 2.0 authentication
- REST API for reading/writing clinical data
- Webhooks for real-time event notification

**API Base URL:** `https://drchrono.com/api`
**Documentation:** https://drchrono.com/api-docs

---

## Authentication

### OAuth 2.0 Flow

DrChrono uses OAuth 2.0 with refresh tokens. Initial authorization is done manually through the DrChrono portal.

**Required Scopes:**
- `patients:read` - Read patient demographics
- `patients:write` - Create/update patients
- `clinical:read` - Read clinical notes, medications, problems, allergies
- `calendar:read` - Read appointments
- `calendar:write` - Create/update appointments
- `user:read` - Read user (provider) information

### Token Management

```typescript
// src/drchrono/oauth.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretManager = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GCP_PROJECT;

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let cachedToken: TokenPair | null = null;

export async function getAccessToken(): Promise<string> {
  // Check cached token
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  // Load from Secret Manager
  const [accessSecret] = await secretManager.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/drchrono-access-token/versions/latest`,
  });
  const [refreshSecret] = await secretManager.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/drchrono-refresh-token/versions/latest`,
  });

  const accessToken = accessSecret.payload?.data?.toString();
  const refreshToken = refreshSecret.payload?.data?.toString();

  // Check if token needs refresh (assume 1 hour expiry)
  // In production, store expiry time with the token
  const needsRefresh = !accessToken || await isTokenExpired(accessToken);

  if (needsRefresh && refreshToken) {
    return await refreshAccessToken(refreshToken);
  }

  cachedToken = {
    access_token: accessToken!,
    refresh_token: refreshToken!,
    expires_at: Date.now() + 3600000,  // Assume 1 hour
  };

  return accessToken!;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://drchrono.com/o/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.DRCHRONO_CLIENT_ID!,
      client_secret: process.env.DRCHRONO_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token refresh failed:', error);
    throw new Error('DrChrono token refresh failed - manual re-authorization required');
  }

  const data = await response.json();

  // Store new tokens in Secret Manager
  await updateSecret('drchrono-access-token', data.access_token);
  if (data.refresh_token) {
    await updateSecret('drchrono-refresh-token', data.refresh_token);
  }

  cachedToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

async function updateSecret(secretName: string, value: string): Promise<void> {
  await secretManager.addSecretVersion({
    parent: `projects/${PROJECT_ID}/secrets/${secretName}`,
    payload: { data: Buffer.from(value) },
  });
}

async function isTokenExpired(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://drchrono.com/api/users/current', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.status === 401;
  } catch {
    return true;
  }
}
```

---

## API Endpoints

### Patients

**Single Patient:**
```
GET /api/patients/{id}
```

**Bulk List:**
```
GET /api/patients_list?since=2024-01-01T00:00:00Z
```
Returns up to 1000 patients per page. Use `next` link for pagination.

**Response Fields:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | number | DrChrono patient ID |
| `first_name` | string | |
| `last_name` | string | |
| `date_of_birth` | string | YYYY-MM-DD |
| `gender` | string | |
| `email` | string | |
| `cell_phone` | string | |
| `home_phone` | string | |
| `address` | string | |
| `city` | string | |
| `state` | string | |
| `zip_code` | string | |
| `emergency_contact_name` | string | |
| `emergency_contact_phone` | string | |
| `primary_insurance` | object | Nested insurance data |
| `secondary_insurance` | object | Nested insurance data |
| `referring_source` | string | How patient found you |
| `chart_id` | string | External chart identifier |

### Appointments

**Single Appointment:**
```
GET /api/appointments/{id}
```

**Bulk List:**
```
GET /api/appointments_list?since=2024-01-01T00:00:00Z
```
Requires `since`, `date`, or `date_range` parameter.

**Response Fields:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | number | DrChrono appointment ID |
| `patient` | number | Patient ID |
| `doctor` | number | Doctor ID |
| `office` | number | Office ID |
| `scheduled_time` | string | ISO 8601 datetime |
| `duration` | number | Minutes |
| `status` | string | See status values below |
| `reason` | string | Visit reason |
| `exam_room` | number | |
| `profile` | number | Appointment profile ID |
| `icd10_codes` | array | ICD-10 diagnosis codes |
| `billing_status` | string | |
| `is_virtual_base` | boolean | Telehealth indicator |

**Appointment Status Values:**
- `""` - No status
- `Arrived`
- `Checked In`
- `In Room`
- `Cancelled`
- `Complete`
- `Confirmed`
- `In Session`
- `No Show`
- `Not Confirmed`
- `Rescheduled`

### Clinical Notes

**Single Note:**
```
GET /api/clinical_notes/{id}
```

**List by Appointment:**
```
GET /api/clinical_notes?appointment={appointment_id}
```

**Bulk List:**
```
GET /api/clinical_notes?since=2024-01-01T00:00:00Z
```
⚠️ **Warning:** Paginated at 5 per page (max 20). Very slow for bulk sync. Use `since` parameter and cache aggressively.

**Response Fields:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | number | DrChrono note ID |
| `appointment` | number | Appointment ID |
| `patient` | number | Patient ID |
| `doctor` | number | Doctor ID |
| `date` | string | YYYY-MM-DD |
| `locked` | boolean | Note is signed/finalized |
| `sections` | object | Structured note content |

### Medications

**List by Patient:**
```
GET /api/medications?patient={patient_id}
```

**Response Fields:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | number | DrChrono medication ID |
| `patient` | number | Patient ID |
| `doctor` | number | Prescribing doctor ID |
| `name` | string | Medication name |
| `rxnorm` | string | RxNorm code |
| `dose` | string | Dosage |
| `frequency` | string | How often |
| `route` | string | Administration route |
| `status` | string | active/discontinued |
| `date_prescribed` | string | YYYY-MM-DD |
| `date_started_taking` | string | YYYY-MM-DD |
| `date_stopped_taking` | string | YYYY-MM-DD |
| `dispense_as_written` | boolean | DAW flag |
| `notes` | string | |

### Problems (Diagnoses)

**List by Patient:**
```
GET /api/problems?patient={patient_id}
```

**Response Fields:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | number | DrChrono problem ID |
| `patient` | number | Patient ID |
| `icd_code` | string | ICD-10 code |
| `name` | string | Diagnosis description |
| `date_onset` | string | YYYY-MM-DD |
| `status` | string | active/resolved |

### Allergies

**List by Patient:**
```
GET /api/allergies?patient={patient_id}
```

---

## Webhooks

### Subscribing to Events

Webhooks are configured in the DrChrono developer portal.

**Supported Events:**
- `PATIENT_CREATE` - New patient created
- `PATIENT_MODIFY` - Patient record updated
- `APPOINTMENT_CREATE` - New appointment scheduled
- `APPOINTMENT_MODIFY` - Appointment updated (includes status changes)
- `CLINICAL_NOTE_MODIFY` - Note content changed
- `CLINICAL_NOTE_LOCK` - Note signed/locked

### Webhook Payload

```json
{
  "event": "PATIENT_MODIFY",
  "object_id": 12345,
  "webhook_id": "abc123"
}
```

The payload is minimal — only the event type and object ID. You must fetch the full record via the API.

### Signature Verification

DrChrono signs webhooks using HMAC-SHA256.

```typescript
// src/drchrono/webhooks.ts
import crypto from 'crypto';

export function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers['x-drchrono-signature'];
  if (!signature) return false;

  const payload = JSON.stringify(req.body);
  const secret = process.env.DRCHRONO_WEBHOOK_SECRET;

  const expected = crypto
    .createHmac('sha256', secret!)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature as string),
    Buffer.from(expected)
  );
}
```

---

## Bulk API Behavior

The `*_list` endpoints (patients_list, appointments_list) return:
- Up to 1000 records per page
- A UUID that you poll for results
- Pagination via `next` URL

```typescript
// Polling bulk API results
async function fetchBulkResults(endpoint: string, params: URLSearchParams): Promise<any[]> {
  const token = await getAccessToken();

  // Start bulk request
  const response = await fetch(`https://drchrono.com/api/${endpoint}?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const { results, next } = await response.json();
  let allResults = results;

  // Follow pagination
  let nextUrl = next;
  while (nextUrl) {
    const pageResponse = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const pageData = await pageResponse.json();
    allResults = allResults.concat(pageData.results);
    nextUrl = pageData.next;
  }

  return allResults;
}
```

---

## Rate Limits

DrChrono enforces rate limits:
- **Standard:** 100 requests per minute
- **Burst:** Short bursts allowed

**Handling Rate Limits:**
```typescript
async function drchronoRequest(url: string, options: RequestInit): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    console.log(`Rate limited, waiting ${retryAfter} seconds`);
    await sleep(parseInt(retryAfter) * 1000);
    return drchronoRequest(url, options);
  }

  return response;
}
```

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad request | Check request format |
| 401 | Unauthorized | Refresh token |
| 403 | Forbidden | Check scopes |
| 404 | Not found | Record doesn't exist |
| 429 | Rate limited | Wait and retry |
| 500 | Server error | Retry with backoff |

---

## Initial Authorization

To obtain initial OAuth tokens:

1. Go to DrChrono Developer Portal
2. Create an application with required scopes
3. Generate authorization URL:
```
https://drchrono.com/o/authorize/?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=patients:read patients:write clinical:read calendar:read calendar:write user:read
```
4. User authorizes → redirected with `code` parameter
5. Exchange code for tokens:
```bash
curl -X POST https://drchrono.com/o/token/ \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=YOUR_REDIRECT_URI"
```
6. Store tokens in Secret Manager

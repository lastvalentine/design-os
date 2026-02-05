# Coda Integration Guide

Reference documentation for integrating with the Coda API for clinical operations workflows.

## Overview

Coda serves as the staff-facing UI for clinical operations workflows. The integration involves:
- **Push (Postgres → Coda):** Sync clinical data to Coda tables
- **Pull (Coda → Postgres):** Receive staff updates via webhooks

**API Base URL:** `https://coda.io/apis/v1`
**Documentation:** https://coda.io/developers/apis/v1

---

## Authentication

Coda uses API tokens for authentication.

### Generating an API Token

1. Go to https://coda.io/account
2. Scroll to "API Settings"
3. Click "Generate API Token"
4. Store the token in Secret Manager as `coda-api-token`

### Using the Token

```typescript
const headers = {
  'Authorization': `Bearer ${process.env.CODA_API_TOKEN}`,
  'Content-Type': 'application/json',
};
```

---

## Key Concepts

### Doc, Table, and Column IDs

Coda resources are identified by IDs, not names:
- **Doc ID:** Found in the document URL (`coda.io/d/DOC_ID/...`)
- **Table ID:** Found via API or in table settings (e.g., `grid-abc123`)
- **Column ID:** Found via API (e.g., `c-xyz789`)

**Important:** Always use IDs, not names. Names can change; IDs are stable.

### Discovering IDs

```bash
# List tables in a doc
curl -H "Authorization: Bearer $CODA_API_TOKEN" \
  "https://coda.io/apis/v1/docs/$DOC_ID/tables"

# List columns in a table
curl -H "Authorization: Bearer $CODA_API_TOKEN" \
  "https://coda.io/apis/v1/docs/$DOC_ID/tables/$TABLE_ID/columns"
```

---

## Pushing Data to Coda

### upsertRows Endpoint

The primary method for syncing data is `upsertRows`, which creates or updates rows based on a key column.

**Endpoint:**
```
POST /docs/{docId}/tables/{tableId}/rows
```

**Request Body:**
```json
{
  "rows": [
    {
      "cells": [
        { "column": "c-abc123", "value": "12345" },
        { "column": "c-def456", "value": "John" },
        { "column": "c-ghi789", "value": "Doe" }
      ]
    }
  ],
  "keyColumns": ["c-abc123"]
}
```

**Key Column:** Specifies which column(s) to use for matching existing rows. If a row exists with the same key value, it's updated; otherwise, a new row is created.

### Implementation

```typescript
// src/coda/client.ts

const CODA_API_BASE = 'https://coda.io/apis/v1';

export async function upsertRows(
  docId: string,
  tableId: string,
  rows: Array<{ cells: Array<{ column: string; value: any }> }>,
  keyColumns: string[]
): Promise<void> {
  const response = await fetch(
    `${CODA_API_BASE}/docs/${docId}/tables/${tableId}/rows`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CODA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows, keyColumns }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Coda API error: ${response.status} - ${error}`);
  }
}
```

### Batch Limits

- **Max rows per request:** 500
- **Rate limit:** 100 requests/minute (Enterprise may be higher)

```typescript
// Batch large datasets
async function pushLargeDataset(
  docId: string,
  tableId: string,
  records: any[],
  mapRecord: (r: any) => Array<{ column: string; value: any }>,
  keyColumn: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Chunk into batches of 500
  const batches = chunkArray(records, 500);

  for (const batch of batches) {
    try {
      const rows = batch.map(record => ({ cells: mapRecord(record) }));
      await upsertRows(docId, tableId, rows, [keyColumn]);
      success += batch.length;
    } catch (error) {
      console.error('Batch failed:', error);
      failed += batch.length;
    }

    // Rate limiting: wait between batches
    await sleep(1000);
  }

  return { success, failed };
}
```

---

## Column Mapping

### Mapping Structure

```typescript
// src/coda/mappings.ts

interface TableMapping {
  tableId: string;
  keyColumn: string;
  columns: Record<string, ColumnMapping>;
}

interface ColumnMapping {
  codaId: string;
  transform?: (value: any) => any;
}

const TABLE_MAPPINGS: Record<string, TableMapping> = {
  patients: {
    tableId: 'grid-PATIENTS',
    keyColumn: 'c-drchrono_id',
    columns: {
      drchrono_id: { codaId: 'c-drchrono_id' },
      first_name: { codaId: 'c-first_name' },
      last_name: { codaId: 'c-last_name' },
      date_of_birth: {
        codaId: 'c-dob',
        transform: (d) => d?.toISOString().split('T')[0],
      },
      email: { codaId: 'c-email' },
      phone: { codaId: 'c-phone' },
    },
  },

  appointments: {
    tableId: 'grid-APPOINTMENTS',
    keyColumn: 'c-appointment_id',
    columns: {
      drchrono_id: { codaId: 'c-appointment_id' },
      drchrono_patient_id: { codaId: 'c-patient_id' },
      scheduled_time: {
        codaId: 'c-start_time',
        transform: (d) => d?.toISOString(),
      },
      duration: { codaId: 'c-duration' },
      status: { codaId: 'c-status' },
      reason: { codaId: 'c-reason' },
      appointment_type: { codaId: 'c-type' },
      icd10_codes: {
        codaId: 'c-icd10',
        transform: (arr) => arr?.join(', '),
      },
    },
  },

  intake_checklists: {
    tableId: 'grid-INTAKE',
    keyColumn: 'c-appointment_id',
    columns: {
      appointment_id: { codaId: 'c-appointment_id' },
      card_on_file: { codaId: 'c-card_on_file' },
      autopay_setup: { codaId: 'c-autopay' },
      insurance_verified: { codaId: 'c-insurance_verified' },
      consent_signed: { codaId: 'c-consent' },
      cures_checked: { codaId: 'c-cures' },
      controlled_sub_agreement: { codaId: 'c-controlled_sub' },
      notes: { codaId: 'c-notes' },
    },
  },
};

export function mapRecordToCells(
  table: string,
  record: any
): Array<{ column: string; value: any }> {
  const mapping = TABLE_MAPPINGS[table];
  if (!mapping) return [];

  const cells: Array<{ column: string; value: any }> = [];

  for (const [pgColumn, colMapping] of Object.entries(mapping.columns)) {
    let value = record[pgColumn];

    if (colMapping.transform) {
      value = colMapping.transform(value);
    }

    if (value !== undefined && value !== null) {
      cells.push({ column: colMapping.codaId, value });
    }
  }

  return cells;
}

export function getTableMapping(table: string): TableMapping | null {
  return TABLE_MAPPINGS[table] || null;
}
```

### Documenting Your Mappings

Create a mapping document in your codebase:

```markdown
# Coda Column Mappings

## Patients Table (grid-PATIENTS)

| Postgres Column | Coda Column | Coda ID | Direction |
|-----------------|-------------|---------|-----------|
| drchrono_id | DrChrono ID | c-abc123 | PG → Coda |
| first_name | First Name | c-def456 | PG → Coda |
| last_name | Last Name | c-ghi789 | PG → Coda |
| date_of_birth | DOB | c-jkl012 | PG → Coda |
| email | Email | c-mno345 | PG → Coda |

## Appointments Table (grid-APPOINTMENTS)

| Postgres Column | Coda Column | Coda ID | Direction |
|-----------------|-------------|---------|-----------|
| drchrono_id | Appointment ID | c-apt001 | PG → Coda |
| scheduled_time | Start Time | c-apt002 | PG → Coda |
| status | Status | c-apt003 | PG → Coda |
...
```

---

## Receiving Updates from Coda

### Coda Automations

Use Coda's automation feature to trigger webhooks when data changes.

**Setup:**
1. In Coda, open Automations panel
2. Create new automation
3. Trigger: "When a row is changed" (specify table)
4. Action: "Make API request"
5. Configure webhook URL and payload

**Webhook Payload Template:**
```json
{
  "row_id": "{{RowId()}}",
  "appointment_id": "{{thisRow.Appointment ID}}",
  "card_on_file": {{thisRow.Card on File}},
  "autopay_setup": {{thisRow.Autopay Setup}},
  "insurance_verified": {{thisRow.Insurance Verified}},
  "consent_signed": {{thisRow.Consent Signed}},
  "cures_checked": {{thisRow.CURES Checked}},
  "controlled_sub_agreement": {{thisRow.Controlled Sub Agreement}},
  "modified_by": "{{User.Email()}}"
}
```

### Button-Triggered Actions

For explicit user actions (not auto-triggered on change):

1. Add a button column to the table
2. Button formula triggers a Pack action or automation
3. Automation sends webhook with action-specific payload

```
// Button formula example (Coda Pack)
MarkComplete(thisRow)
```

---

## API Endpoints Reference

### List Tables

```
GET /docs/{docId}/tables
```

### List Columns

```
GET /docs/{docId}/tables/{tableId}/columns
```

### Get Rows

```
GET /docs/{docId}/tables/{tableId}/rows
```

Query parameters:
- `query`: Filter expression (e.g., `Status:"Active"`)
- `limit`: Max rows (default 100, max 500)
- `pageToken`: Pagination token

### Upsert Rows

```
POST /docs/{docId}/tables/{tableId}/rows
```

Body:
```json
{
  "rows": [...],
  "keyColumns": ["column-id"]
}
```

### Delete Row

```
DELETE /docs/{docId}/tables/{tableId}/rows/{rowIdOrName}
```

---

## Rate Limits

| Tier | Limit |
|------|-------|
| Standard | 100 requests/minute |
| Pro | Higher (contact Coda) |
| Enterprise | Custom limits |

### Handling Rate Limits

```typescript
async function codaRequestWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      console.log(`Rate limited, waiting ${retryAfter}s (attempt ${attempt + 1})`);
      await sleep(parseInt(retryAfter) * 1000);
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad request | Check payload format |
| 401 | Unauthorized | Check API token |
| 403 | Forbidden | Check doc permissions |
| 404 | Not found | Check doc/table/column IDs |
| 429 | Rate limited | Wait and retry |
| 500 | Server error | Retry with backoff |

---

## Testing

### Verify Column IDs

```bash
# Get table columns
curl -H "Authorization: Bearer $CODA_API_TOKEN" \
  "https://coda.io/apis/v1/docs/$DOC_ID/tables/$TABLE_ID/columns" | jq '.items[] | {name, id}'
```

### Test Upsert

```bash
curl -X POST \
  -H "Authorization: Bearer $CODA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://coda.io/apis/v1/docs/$DOC_ID/tables/$TABLE_ID/rows" \
  -d '{
    "rows": [{ "cells": [{ "column": "c-abc123", "value": "test-value" }] }],
    "keyColumns": ["c-abc123"]
  }'
```

---

## Coda Enterprise & BAA

For HIPAA compliance:
- Coda Enterprise plan is required
- Sign a BAA with Coda
- Ensure the workspace is configured for healthcare compliance

Contact Coda sales for Enterprise features and BAA signing.

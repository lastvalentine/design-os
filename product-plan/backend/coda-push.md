# Coda Push Service Implementation Guide

The service that pushes database changes to Coda tables, triggered by Pub/Sub events.

## Service Overview

**Name:** `coda-push`
**Runtime:** Node.js 20 on Cloud Run
**Framework:** Express.js or Hono
**Triggers:** Pub/Sub subscription (change events from drchrono-sync)

## Directory Structure

```
services/coda-push/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Entry point
│   ├── config.ts                # Environment configuration
│   │
│   ├── pubsub/
│   │   └── handler.ts           # Pub/Sub message handler
│   │
│   ├── coda/
│   │   ├── client.ts            # Coda API client
│   │   ├── tables.ts            # Table ID constants
│   │   ├── mappings.ts          # Postgres → Coda column mappings
│   │   └── types.ts             # Coda API types
│   │
│   ├── db/
│   │   ├── connection.ts        # Database connection
│   │   └── queries.ts           # Record fetch queries
│   │
│   └── audit/
│       └── logger.ts            # Access logging
│
└── tests/
    └── coda/
```

---

## Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/push` | POST | Pub/Sub push handler | Pub/Sub signature |
| `/push/batch` | POST | Batch push multiple records | Internal |
| `/push/full/:table` | POST | Full table sync to Coda | Admin |
| `/health` | GET | Health check | None |

---

## Implementation Details

### Entry Point (`src/index.ts`)

```typescript
import express from 'express';
import { handlePubSubMessage } from './pubsub/handler';
import { pushFullTable } from './coda/client';

const app = express();
app.use(express.json());

// Pub/Sub push endpoint
app.post('/push', handlePubSubMessage);

// Manual full table push
app.post('/push/full/:table', async (req, res) => {
  const { table } = req.params;
  const result = await pushFullTable(table);
  res.json(result);
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
```

### Pub/Sub Handler (`src/pubsub/handler.ts`)

```typescript
import { Request, Response } from 'express';
import { fetchRecord } from '../db/queries';
import { pushToCoda } from '../coda/client';
import { isMessageProcessed, markMessageProcessed } from '../db/queries';
import { logAccessEvent } from '../audit/logger';

interface PubSubMessage {
  message: {
    messageId: string;
    data: string;  // Base64 encoded
    attributes: {
      table: string;
      operation: string;
    };
  };
  subscription: string;
}

export async function handlePubSubMessage(req: Request, res: Response) {
  const pubsubMessage: PubSubMessage = req.body;
  const messageId = pubsubMessage.message.messageId;

  // Deduplication check
  if (await isMessageProcessed(messageId)) {
    console.log(`Message ${messageId} already processed, skipping`);
    return res.status(200).send();  // Ack to prevent redelivery
  }

  try {
    // Decode message data
    const data = JSON.parse(
      Buffer.from(pubsubMessage.message.data, 'base64').toString()
    );

    const { table, operation, record_id, drchrono_id } = data;

    // Skip DELETE operations (or handle differently)
    if (operation === 'DELETE') {
      console.log(`Skipping DELETE for ${table}/${record_id}`);
      await markMessageProcessed(messageId);
      return res.status(200).send();
    }

    // Fetch full record from Postgres
    const record = await fetchRecord(table, record_id);
    if (!record) {
      console.error(`Record not found: ${table}/${record_id}`);
      await markMessageProcessed(messageId);
      return res.status(200).send();
    }

    // Push to Coda
    await pushToCoda(table, record);

    // Mark as processed
    await markMessageProcessed(messageId);

    // Log the push
    await logAccessEvent('coda_api', 'upsertRows', 'POST', 200, {
      table,
      record_id,
      drchrono_id,
    });

    res.status(200).send();

  } catch (error) {
    console.error('Failed to process message:', error);
    // Return 500 to trigger retry
    res.status(500).send();
  }
}
```

### Coda Client (`src/coda/client.ts`)

```typescript
import { getTableMapping, mapRecordToColumns } from './mappings';
import { logAccessEvent } from '../audit/logger';

const CODA_API_BASE = 'https://coda.io/apis/v1';
const DOC_ID = process.env.CODA_DOC_ID!;

async function codaRequest(
  endpoint: string,
  method: string,
  body?: any
): Promise<any> {
  const startTime = Date.now();

  const response = await fetch(`${CODA_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.CODA_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const duration = Date.now() - startTime;

  await logAccessEvent('coda_api', endpoint, method, response.status, {
    duration_ms: duration,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Coda API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function pushToCoda(table: string, record: any): Promise<void> {
  const mapping = getTableMapping(table);
  if (!mapping) {
    console.log(`No Coda mapping for table: ${table}`);
    return;
  }

  const { tableId, keyColumn } = mapping;
  const cells = mapRecordToColumns(table, record);

  // Use upsertRows with merge key
  await codaRequest(`/docs/${DOC_ID}/tables/${tableId}/rows`, 'POST', {
    rows: [{ cells }],
    keyColumns: [keyColumn],
  });
}

export async function pushBatchToCoda(
  table: string,
  records: any[]
): Promise<{ success: number; failed: number }> {
  const mapping = getTableMapping(table);
  if (!mapping) {
    return { success: 0, failed: records.length };
  }

  const { tableId, keyColumn } = mapping;
  let success = 0;
  let failed = 0;

  // Batch in groups of 500 (Coda limit)
  const batches = chunkArray(records, 500);

  for (const batch of batches) {
    try {
      const rows = batch.map(record => ({
        cells: mapRecordToColumns(table, record),
      }));

      await codaRequest(`/docs/${DOC_ID}/tables/${tableId}/rows`, 'POST', {
        rows,
        keyColumns: [keyColumn],
      });

      success += batch.length;
    } catch (error) {
      console.error('Batch push failed:', error);
      failed += batch.length;
    }

    // Rate limiting: wait 1 second between batches
    await sleep(1000);
  }

  return { success, failed };
}

export async function pushFullTable(table: string): Promise<any> {
  const { fetchAllRecords } = await import('../db/queries');
  const records = await fetchAllRecords(table);

  console.log(`Pushing ${records.length} ${table} records to Coda`);
  const result = await pushBatchToCoda(table, records);

  return {
    table,
    total: records.length,
    ...result,
  };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Column Mappings (`src/coda/mappings.ts`)

```typescript
// Coda table IDs and column mappings
// These IDs come from the Coda doc settings (not column names!)

interface TableMapping {
  tableId: string;
  keyColumn: string;  // Column ID used as merge key
  columns: Record<string, string>;  // Postgres column → Coda column ID
}

const TABLE_MAPPINGS: Record<string, TableMapping> = {
  patients: {
    tableId: 'grid-XXXXXXXX',  // From Coda
    keyColumn: 'c-drchrono_id',
    columns: {
      drchrono_id: 'c-drchrono_id',
      first_name: 'c-first_name',
      last_name: 'c-last_name',
      date_of_birth: 'c-dob',
      email: 'c-email',
      phone: 'c-phone',
    },
  },

  appointments: {
    tableId: 'grid-YYYYYYYY',
    keyColumn: 'c-appointment_id',
    columns: {
      drchrono_id: 'c-appointment_id',
      drchrono_patient_id: 'c-patient_id',
      scheduled_time: 'c-start_time',
      duration: 'c-duration',
      status: 'c-status',
      reason: 'c-reason',
      appointment_type: 'c-type',
      icd10_codes: 'c-icd10',
    },
  },

  intake_checklists: {
    tableId: 'grid-ZZZZZZZZ',
    keyColumn: 'c-appointment_id',
    columns: {
      appointment_id: 'c-appointment_id',
      card_on_file: 'c-card_on_file',
      autopay_setup: 'c-autopay',
      insurance_verified: 'c-insurance_verified',
      consent_signed: 'c-consent',
      cures_checked: 'c-cures',
      controlled_sub_agreement: 'c-controlled_sub',
    },
  },

  // Add more table mappings...
};

export function getTableMapping(table: string): TableMapping | null {
  return TABLE_MAPPINGS[table] || null;
}

export function mapRecordToColumns(
  table: string,
  record: any
): Array<{ column: string; value: any }> {
  const mapping = TABLE_MAPPINGS[table];
  if (!mapping) return [];

  const cells: Array<{ column: string; value: any }> = [];

  for (const [pgColumn, codaColumn] of Object.entries(mapping.columns)) {
    let value = record[pgColumn];

    // Transform values as needed
    if (value instanceof Date) {
      value = value.toISOString();
    } else if (Array.isArray(value)) {
      value = value.join(', ');
    } else if (typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    }

    cells.push({ column: codaColumn, value });
  }

  return cells;
}
```

### Message Deduplication (`src/db/queries.ts`)

```typescript
import { query } from './connection';

export async function isMessageProcessed(messageId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM processed_messages WHERE message_id = $1`,
    [messageId]
  );
  return result.rowCount > 0;
}

export async function markMessageProcessed(messageId: string): Promise<void> {
  await query(
    `INSERT INTO processed_messages (message_id, topic, processed_at, expires_at)
     VALUES ($1, 'change-events', NOW(), NOW() + INTERVAL '7 days')
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId]
  );
}

export async function fetchRecord(
  table: string,
  recordId: string
): Promise<any | null> {
  const result = await query(
    `SELECT * FROM ${table} WHERE id = $1`,
    [recordId]
  );
  return result.rows[0] || null;
}

export async function fetchAllRecords(table: string): Promise<any[]> {
  const result = await query(`SELECT * FROM ${table}`);
  return result.rows;
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
| `CODA_API_TOKEN` | Coda API token | Secret Manager |
| `CODA_DOC_ID` | Coda document ID | Environment |

---

## Coda Column ID Discovery

To find column IDs for your Coda tables:

1. **Using Coda API:**
```bash
curl -H "Authorization: Bearer $CODA_API_TOKEN" \
  "https://coda.io/apis/v1/docs/$DOC_ID/tables/$TABLE_ID/columns"
```

2. **Using browser DevTools:**
   - Open your Coda doc
   - Open DevTools → Network tab
   - Make any edit to the table
   - Look for API requests containing column IDs

3. **Document the mappings** in `src/coda/mappings.ts` using the discovered column IDs.

---

## Deployment

```bash
# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/coda-push

# Deploy to Cloud Run
gcloud run deploy coda-push \
  --image=gcr.io/$PROJECT_ID/coda-push \
  --region=us-west1 \
  --service-account=coda-push-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=feel-august-connector \
  --min-instances=0 \
  --max-instances=3 \
  --memory=256Mi \
  --timeout=60s \
  --set-env-vars="DB_HOST=10.x.x.x,DB_NAME=clinical,CODA_DOC_ID=your-doc-id" \
  --set-secrets="DB_PASSWORD=db-password:latest,CODA_API_TOKEN=coda-api-token:latest"
```

### Configure Pub/Sub Push Subscription

```bash
# Get the Cloud Run URL
SERVICE_URL=$(gcloud run services describe coda-push --format='value(status.url)')

# Create push subscription
gcloud pubsub subscriptions create coda-push-subscription \
  --topic=change-events \
  --push-endpoint=$SERVICE_URL/push \
  --push-auth-service-account=coda-push-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --ack-deadline=60 \
  --min-retry-delay=10s \
  --max-retry-delay=600s \
  --dead-letter-topic=change-events-dlq \
  --max-delivery-attempts=5
```

---

## Testing Checklist

- [ ] Health endpoint returns 200
- [ ] Pub/Sub message received and processed
- [ ] Duplicate messages skipped (deduplication works)
- [ ] Patient record pushed to Coda patients table
- [ ] Appointment record pushed to Coda appointments table
- [ ] Coda upsertRows uses drchrono_id as merge key
- [ ] Batch push handles 500+ records
- [ ] Rate limiting prevents Coda API errors
- [ ] Full table sync works via `/push/full/:table`
- [ ] access_log records all Coda API calls

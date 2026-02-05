# Backend Services

This folder contains implementation guides for the Feel August Platform backend services.

## Services Overview

| Service | Purpose | Trigger |
|---------|---------|---------|
| [drchrono-sync](./drchrono-sync.md) | Syncs data from DrChrono and Deep Cura to Postgres | Webhooks, Cloud Scheduler |
| [coda-push](./coda-push.md) | Pushes database changes to Coda tables | Pub/Sub events |
| [writeback-api](./writeback-api.md) | Receives updates from Coda back to Postgres | Coda automations |

## Architecture

```
DrChrono (EHR)                      Deep Cura
    │                                    │
    │  webhooks                          │ Gridhooks (AES-encrypted)
    ▼                                    ▼
┌─────────────────────────────────────────────────┐
│              drchrono-sync                       │
│  /webhooks/drchrono  /webhooks/deepcura         │
│  /sync/patients      /sync/appointments         │
│  /sync/all                                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│              Cloud SQL (Postgres 16)             │
│  patients, appointments, clinical_notes, etc.   │
│  + audit triggers → change_log                  │
└──────────────────┬───────────────────────────────┘
                   │
                   │ Pub/Sub (change events)
                   ▼
┌──────────────────────────────────────────────────┐
│              coda-push                           │
│  Receives change events, pushes to Coda         │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│              Coda (Enterprise, BAA)              │
│  Scheduling Ops, Patient Intake, Prior Auths    │
└──────────────────┬───────────────────────────────┘
                   │
                   │ Coda automations (webhooks)
                   ▼
┌──────────────────────────────────────────────────┐
│              writeback-api                       │
│  Receives Coda updates, writes to Postgres      │
└──────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Express.js or Hono
- **Validation:** Zod
- **Database:** Raw SQL with pg library (no ORM)
- **Cloud:** GCP Cloud Run, Cloud SQL, Pub/Sub

## Shared Patterns

### Database Connection

All services use the same connection pattern:

```typescript
// src/db/connection.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
```

### Audit Context

Set the actor before making changes:

```typescript
await query(`SET LOCAL app.actor = $1`, ['drchrono_sync']);
// Now any INSERT/UPDATE/DELETE will log with this actor
```

### Error Handling

```typescript
try {
  // ... operation
} catch (error) {
  console.error('Operation failed:', error);
  await completeSyncLog(syncLogId, 'failed', { error: error.message });
  res.status(500).json({ error: 'Operation failed' });
}
```

## Development

### Local Setup

1. Install dependencies:
```bash
cd services/drchrono-sync
npm install
```

2. Set environment variables:
```bash
export DB_HOST=localhost
export DB_NAME=clinical
export DB_USER=postgres
export DB_PASSWORD=localpassword
# ... other variables
```

3. Run locally:
```bash
npm run dev
```

### Testing Against Local Postgres

Run Postgres in Docker:
```bash
docker run -d \
  --name feel-august-db \
  -e POSTGRES_DB=clinical \
  -e POSTGRES_PASSWORD=localpassword \
  -p 5432:5432 \
  postgres:16

# Apply schema
psql -h localhost -U postgres -d clinical -f database/schema.sql
```

## Deployment Order

1. **Infrastructure** (Terraform)
2. **Database** (run schema.sql)
3. **drchrono-sync** (receives webhooks)
4. **coda-push** (receives Pub/Sub events)
5. **writeback-api** (receives Coda webhooks)
6. **Configure webhooks** in DrChrono and Deep Cura
7. **Run initial backfill** via `/sync/all`
8. **Configure Coda automations**

## Monitoring

All services emit logs to Cloud Logging and record operations to audit tables:

- `sync_log` - Every sync operation
- `change_log` - Every record change
- `access_log` - Every external API call

View in the admin dashboard or query directly:

```sql
-- Recent sync operations
SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 20;

-- Failed syncs
SELECT * FROM sync_log WHERE status = 'failed' ORDER BY started_at DESC;

-- Changes to a specific patient
SELECT * FROM change_log WHERE drchrono_id = 12345 ORDER BY created_at DESC;
```

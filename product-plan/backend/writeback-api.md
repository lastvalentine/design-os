# Write-Back API Service Implementation Guide

The API that receives updates from Coda (staff-driven changes) and writes them back to Postgres.

## Service Overview

**Name:** `writeback-api`
**Runtime:** Node.js 20 on Cloud Run
**Framework:** Express.js or Hono
**Triggers:** Coda button automations → HTTP webhook

## Directory Structure

```
services/writeback-api/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Entry point
│   ├── config.ts                # Environment configuration
│   │
│   ├── routes/
│   │   ├── intake.ts            # Intake checklist updates
│   │   ├── tasks.ts             # Post-appointment task updates
│   │   ├── prior-auth.ts        # Prior authorization updates
│   │   └── index.ts             # Route registration
│   │
│   ├── validation/
│   │   └── schemas.ts           # Zod validation schemas
│   │
│   ├── db/
│   │   ├── connection.ts        # Database connection
│   │   └── queries.ts           # Update queries
│   │
│   └── audit/
│       └── logger.ts            # Audit logging
│
└── tests/
```

---

## Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/intake/:appointmentId` | PATCH | Update intake checklist | Coda webhook secret |
| `/api/tasks/:taskId` | PATCH | Update task status | Coda webhook secret |
| `/api/prior-auth/:authId` | PATCH | Update prior auth status | Coda webhook secret |
| `/health` | GET | Health check | None |

---

## Implementation Details

### Entry Point (`src/index.ts`)

```typescript
import express from 'express';
import { intakeRouter } from './routes/intake';
import { tasksRouter } from './routes/tasks';
import { priorAuthRouter } from './routes/prior-auth';
import { validateCodaWebhook } from './middleware/auth';

const app = express();
app.use(express.json());

// Validate Coda webhook secret on all API routes
app.use('/api', validateCodaWebhook);

// Routes
app.use('/api/intake', intakeRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/prior-auth', priorAuthRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
```

### Webhook Authentication (`src/middleware/auth.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';

export function validateCodaWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const webhookSecret = req.headers['x-coda-webhook-secret'];

  if (webhookSecret !== process.env.CODA_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  next();
}
```

### Validation Schemas (`src/validation/schemas.ts`)

```typescript
import { z } from 'zod';

export const IntakeUpdateSchema = z.object({
  card_on_file: z.boolean().optional(),
  autopay_setup: z.boolean().optional(),
  insurance_verified: z.boolean().optional(),
  consent_signed: z.boolean().optional(),
  cures_checked: z.boolean().optional(),
  controlled_sub_agreement: z.boolean().optional(),
  notes: z.string().optional(),
  completed_by: z.string().optional(),
});

export const TaskUpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
  completed_by: z.string().optional(),
});

export const PriorAuthUpdateSchema = z.object({
  status: z.enum(['pending', 'submitted', 'approved', 'denied', 'expired']).optional(),
  submitted_date: z.string().datetime().optional(),
  approved_date: z.string().datetime().optional(),
  denied_date: z.string().datetime().optional(),
  auth_number: z.string().optional(),
  notes: z.string().optional(),
});

export type IntakeUpdate = z.infer<typeof IntakeUpdateSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;
export type PriorAuthUpdate = z.infer<typeof PriorAuthUpdateSchema>;
```

### Intake Checklist Routes (`src/routes/intake.ts`)

```typescript
import { Router, Request, Response } from 'express';
import { IntakeUpdateSchema } from '../validation/schemas';
import { updateIntakeChecklist } from '../db/queries';

export const intakeRouter = Router();

intakeRouter.patch('/:appointmentId', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;

  // Validate request body
  const parseResult = IntakeUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues,
    });
  }

  try {
    // Set audit context
    const actor = req.body.completed_by || 'coda_writeback';

    const result = await updateIntakeChecklist(
      appointmentId,
      parseResult.data,
      actor
    );

    if (!result) {
      return res.status(404).json({ error: 'Intake checklist not found' });
    }

    res.json({ status: 'updated', id: result.id });

  } catch (error) {
    console.error('Failed to update intake checklist:', error);
    res.status(500).json({ error: 'Update failed' });
  }
});
```

### Task Routes (`src/routes/tasks.ts`)

```typescript
import { Router, Request, Response } from 'express';
import { TaskUpdateSchema } from '../validation/schemas';
import { updatePostAppointmentTask } from '../db/queries';

export const tasksRouter = Router();

tasksRouter.patch('/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;

  const parseResult = TaskUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues,
    });
  }

  try {
    const actor = req.body.completed_by || 'coda_writeback';

    const result = await updatePostAppointmentTask(
      taskId,
      parseResult.data,
      actor
    );

    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ status: 'updated', id: result.id });

  } catch (error) {
    console.error('Failed to update task:', error);
    res.status(500).json({ error: 'Update failed' });
  }
});
```

### Database Queries (`src/db/queries.ts`)

```typescript
import { query } from './connection';
import { IntakeUpdate, TaskUpdate, PriorAuthUpdate } from '../validation/schemas';

export async function updateIntakeChecklist(
  appointmentId: string,
  updates: IntakeUpdate,
  actor: string
): Promise<{ id: string } | null> {
  // Set audit context
  await query(`SET LOCAL app.actor = $1`, [actor]);

  // Build dynamic update
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  // Handle completion
  if (updates.card_on_file && updates.autopay_setup && updates.insurance_verified
      && updates.consent_signed && updates.cures_checked) {
    setClauses.push(`completed_at = NOW()`);
  }

  if (setClauses.length === 0) {
    return null;
  }

  values.push(appointmentId);

  const result = await query(`
    UPDATE intake_checklists
    SET ${setClauses.join(', ')}
    WHERE appointment_id = $${paramIndex}
    RETURNING id
  `, values);

  return result.rows[0] || null;
}

export async function updatePostAppointmentTask(
  taskId: string,
  updates: TaskUpdate,
  actor: string
): Promise<{ id: string } | null> {
  await query(`SET LOCAL app.actor = $1`, [actor]);

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  // Handle completion timestamp
  if (updates.status === 'completed') {
    setClauses.push(`completed_at = NOW()`);
  }

  if (setClauses.length === 0) {
    return null;
  }

  values.push(taskId);

  const result = await query(`
    UPDATE post_appointment_tasks
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id
  `, values);

  return result.rows[0] || null;
}

export async function updatePriorAuthorization(
  authId: string,
  updates: PriorAuthUpdate,
  actor: string
): Promise<{ id: string } | null> {
  await query(`SET LOCAL app.actor = $1`, [actor]);

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return null;
  }

  values.push(authId);

  const result = await query(`
    UPDATE prior_authorizations
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id
  `, values);

  return result.rows[0] || null;
}
```

---

## Coda Automation Setup

To trigger write-back from Coda:

### 1. Create Webhook Automation

In your Coda doc:
1. Open the Automations panel
2. Create a new automation
3. Trigger: "When a row is changed" on the Intake Checklists table
4. Action: "POST to webhook"
5. URL: `https://writeback-api-xxx.run.app/api/intake/{{Appointment ID}}`
6. Headers: `x-coda-webhook-secret: YOUR_SECRET`
7. Body:
```json
{
  "card_on_file": {{Card on File}},
  "autopay_setup": {{Autopay Setup}},
  "insurance_verified": {{Insurance Verified}},
  "consent_signed": {{Consent Signed}},
  "cures_checked": {{CURES Checked}},
  "controlled_sub_agreement": {{Controlled Sub Agreement}},
  "completed_by": {{User.Email}}
}
```

### 2. Button-Triggered Actions

For button-triggered updates:
1. Add a button column to your table
2. Create a Pack formula or automation that sends HTTP request
3. Pass the row ID and updated values

---

## Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `PORT` | Server port | Default 8080 |
| `DB_HOST` | Cloud SQL private IP | Terraform output |
| `DB_NAME` | Database name | `clinical` |
| `DB_USER` | Database user | `app_user` |
| `DB_PASSWORD` | Database password | Secret Manager |
| `CODA_WEBHOOK_SECRET` | Shared secret for Coda webhooks | Secret Manager |

---

## Deployment

```bash
# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/writeback-api

# Deploy to Cloud Run
gcloud run deploy writeback-api \
  --image=gcr.io/$PROJECT_ID/writeback-api \
  --region=us-west1 \
  --service-account=writeback-api-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=feel-august-connector \
  --min-instances=0 \
  --max-instances=3 \
  --memory=256Mi \
  --timeout=30s \
  --set-env-vars="DB_HOST=10.x.x.x,DB_NAME=clinical" \
  --set-secrets="DB_PASSWORD=db-password:latest,CODA_WEBHOOK_SECRET=coda-webhook-secret:latest"
```

---

## Testing Checklist

- [ ] Health endpoint returns 200
- [ ] Invalid webhook secret returns 401
- [ ] Valid intake update modifies database record
- [ ] Invalid intake update returns 400 with validation errors
- [ ] Non-existent appointment returns 404
- [ ] Task status update works
- [ ] Prior auth status update works
- [ ] Audit trigger logs changes with `coda_writeback` actor
- [ ] completed_at timestamp set when all checklist items are true

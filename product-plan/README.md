# Feel August Platform - Implementation Package

Complete implementation guide for the Feel August Platform clinical operations backend.

## What's Included

This export package contains everything needed to build:
1. **Backend services** - DrChrono sync, Coda push, write-back API
2. **Database schema** - Complete PostgreSQL DDL with audit triggers
3. **Infrastructure** - Terraform modules, GCP setup guides
4. **Admin dashboard** - Monitoring UI components
5. **Integrations** - DrChrono, Deep Cura, and Coda API documentation
6. **Compliance** - HIPAA checklist, incident response, risk register

---

## Quick Start

### For Backend Implementation

1. **Review the product overview** in `product-overview.md`
2. **Set up GCP infrastructure** using `infrastructure/gcp-setup.md`
3. **Deploy the database** using `database/schema.sql`
4. **Build backend services** following guides in `backend/`
5. **Configure integrations** using docs in `integrations/`

### For Admin Dashboard Only

1. **Use the one-shot prompt** from `prompts/one-shot-prompt.md`
2. **Copy components** from `shell/` and `sections/monitoring-compliance/`
3. **Follow the test plan** in `sections/monitoring-compliance/tests.md`

---

## Package Contents

```
product-plan/
├── README.md                     # This file
├── product-overview.md           # Product vision and scope
│
├── prompts/                      # Ready-to-use prompts for coding agents
│   ├── one-shot-prompt.md        # Full admin dashboard in one session
│   └── section-prompt.md         # Template for incremental implementation
│
├── database/                     # Database schema
│   ├── README.md                 # Schema overview
│   └── schema.sql                # Complete DDL (400+ lines)
│
├── infrastructure/               # GCP infrastructure
│   ├── terraform-guide.md        # Terraform module structure
│   └── gcp-setup.md              # Step-by-step GCP setup
│
├── backend/                      # Service implementation guides
│   ├── README.md                 # Backend overview
│   ├── drchrono-sync.md          # DrChrono sync service
│   ├── coda-push.md              # Coda push service
│   └── writeback-api.md          # Write-back API service
│
├── integrations/                 # API integration guides
│   ├── drchrono-api.md           # DrChrono OAuth, endpoints, webhooks
│   ├── deepcura-api.md           # Deep Cura Gridhooks, decryption
│   └── coda-api.md               # Coda upsertRows, column mappings
│
├── compliance/                   # Compliance documentation
│   ├── hipaa-checklist.md        # Technical/administrative safeguards
│   ├── incident-response.md      # Breach notification playbook
│   ├── risk-register.md          # Risks and mitigations
│   └── success-criteria.md       # Phase completion criteria
│
├── instructions/                 # Implementation guides
│   ├── one-shot-instructions.md  # Admin dashboard instructions
│   └── incremental/              # Milestone-by-milestone
│       ├── 01-foundation.md
│       ├── 02-shell.md
│       └── 03-monitoring-compliance.md
│
├── design-system/                # Design tokens
│   ├── colors.json
│   └── typography.json
│
├── data-model/                   # Data model documentation
│   └── data-model.md             # Entity descriptions
│
├── shell/                        # Admin dashboard shell
│   ├── spec.md
│   └── components/               # React components
│
└── sections/
    └── monitoring-compliance/    # Admin dashboard section
        ├── spec.md
        ├── types.ts
        ├── data.json
        ├── tests.md
        └── components/           # React components
```

---

## Implementation Phases

### Phase 1: Foundation & Core Sync (Week 1)

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | GCP Infrastructure | VPC, Cloud SQL, IAM, Secrets |
| 2-3 | Database | Schema, triggers, migrations |
| 3-4 | DrChrono Sync Service | Webhooks, sync logic, backfill |
| 5 | Coda Push Service | Pub/Sub handler, upsert logic |
| 5 | Cutover | Disable Google Sheets, verify |

**Key Artifacts:**
- `infrastructure/gcp-setup.md`
- `database/schema.sql`
- `backend/drchrono-sync.md`
- `backend/coda-push.md`

### Phase 2: Monitoring & Compliance (Week 2)

| Focus | Deliverables |
|-------|--------------|
| Cloud Monitoring | Dashboards, alerting policies |
| Compliance | Documentation, Security Command Center |
| Admin Dashboard | React UI for ops visibility |

**Key Artifacts:**
- `compliance/hipaa-checklist.md`
- `compliance/incident-response.md`
- `sections/monitoring-compliance/` (UI components)

### Phase 3: Bidirectional Sync (Weeks 3-4)

| Focus | Deliverables |
|-------|--------------|
| Write-back API | Coda → Postgres updates |
| Deep Cura Enrichment | CPT comparison, billing workflows |
| Email Processor | Travel letters, ASRS intake |

**Key Artifacts:**
- `backend/writeback-api.md`
- `integrations/deepcura-api.md`

### Phase 4: Hardening & Expansion (Month 2+)

| Focus | Deliverables |
|-------|--------------|
| High Availability | Cloud SQL regional failover |
| Staging Environment | Isolated test environment |
| Additional Sync | Billing, lab results |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 20 |
| **Framework** | Express.js or Hono |
| **Database** | PostgreSQL 16 on Cloud SQL |
| **Validation** | Zod |
| **Infrastructure** | Terraform, GCP |
| **Admin UI** | React 18, TypeScript, Tailwind CSS v4 |

---

## Authentication

### Backend Services
- **Cloud Run:** Invoked by webhooks (signature verification), Cloud Scheduler (OIDC), or Pub/Sub
- **Service Accounts:** Workload Identity, no keys

### Admin Dashboard
- **Google Cloud IAP:** Google Workspace SSO
- **Role-Based Access:** admin, operator, viewer via `staff_roles` table

---

## Key Design Decisions

1. **Postgres is the system of record** — DrChrono is clinical truth, Coda is UI layer
2. **drchrono_id as natural key** — Eliminates row ID coupling
3. **Audit everything** — change_log captures all PHI modifications
4. **Event-driven sync** — Webhooks for real-time, reconciliation for reliability
5. **Coda is replaceable** — Future custom frontend reads same Postgres

---

## Estimated Costs

| Resource | Monthly |
|----------|---------|
| Cloud SQL | ~$85 |
| Cloud Run (3 services) | ~$15-40 |
| Pub/Sub, Scheduler, Secrets | ~$5 |
| VPC Connector | ~$7 |
| **Total** | **~$115-140/mo** |

---

## Success Criteria

See `compliance/success-criteria.md` for detailed metrics. Key indicators:

- **Sync latency:** < 60 seconds end-to-end
- **Success rate:** > 99.9%
- **Data discrepancy:** 0%
- **Audit coverage:** 100%

---

## Need Help?

- **GCP Setup:** `infrastructure/gcp-setup.md`
- **DrChrono API:** `integrations/drchrono-api.md`
- **Deep Cura:** `integrations/deepcura-api.md`
- **Coda:** `integrations/coda-api.md`
- **Incidents:** `compliance/incident-response.md`

---

Generated with [Design OS](https://github.com/design-os)

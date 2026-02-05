# Feel August Health — Clinical Operations Platform

## Executive Summary

**Prepared for:** Feel August Health Leadership
**Date:** February 2026
**Status:** Ready for Development

---

## Overview

Feel August Health is modernizing its clinical operations infrastructure. We are replacing a fragile Google Sheets-based data pipeline with a HIPAA-compliant cloud platform that will improve reliability, enable real-time visibility, and eliminate compliance gaps.

**Investment:** ~$120/month in cloud infrastructure
**Timeline:** 4-6 weeks for core functionality
**Risk Level:** Low — proven technologies, incremental rollout

---

## The Problem

Our current system routes patient data through Google Sheets using custom scripts. This approach has critical limitations:

| Issue | Impact |
|-------|--------|
| **Silent failures** | Data sync breaks without alerting anyone. Staff discover problems hours or days later. |
| **No audit trail** | We cannot answer "who accessed what, when" — a HIPAA requirement for breach investigations. |
| **Data mismatches** | Row ID changes in Sheets break downstream references, causing incorrect patient information in Coda. |
| **Compliance exposure** | PHI transits through systems without proper access controls or encryption guarantees. |
| **No visibility** | When something goes wrong, debugging requires manual investigation across multiple systems. |

These issues create operational friction for clinical staff and expose the practice to regulatory risk.

---

## The Solution

We are building a purpose-built clinical operations backend on Google Cloud Platform (GCP), which is covered under a Business Associate Agreement for HIPAA compliance.

### Architecture at a Glance

```
DrChrono (EHR)          Deep Cura (AI Notes)
      │                        │
      │                        │
      ▼                        ▼
┌─────────────────────────────────────┐
│     Feel August Cloud Platform      │
│                                     │
│  • Secure database (PostgreSQL)     │
│  • Automated sync services          │
│  • Complete audit logging           │
│  • Real-time monitoring             │
└─────────────────────────────────────┘
                  │
                  ▼
         Coda (Staff Interface)
```

**Key improvements:**

1. **Reliable sync** — Automated services with retry logic, error handling, and alerting
2. **Complete audit trail** — Every data change logged with who, what, when, and before/after values
3. **Real-time visibility** — Dashboard showing sync health, errors, and system status
4. **HIPAA compliance** — Encryption, access controls, and 7-year log retention
5. **Staff efficiency** — Faster, more reliable data means less time troubleshooting

---

## What We're Building

### Phase 1: Core Data Pipeline (Week 1)
*Replace Google Sheets with reliable cloud infrastructure*

- Secure PostgreSQL database on Google Cloud
- Automated sync from DrChrono (patient records, appointments, clinical notes)
- Automated sync from Deep Cura (AI-extracted session data)
- Real-time updates to Coda for staff workflows
- Complete audit logging for compliance

**Outcome:** Google Sheets pipeline disabled, all data flowing through new system.

### Phase 2: Monitoring & Compliance (Week 2)
*Operational visibility and documentation*

- Admin dashboard for sync health monitoring
- Automated alerts for failures or anomalies
- Incident response procedures documented
- Security controls verified

**Outcome:** Proactive visibility into system health, documented compliance posture.

### Phase 3: Bidirectional Sync (Weeks 3-4)
*Enable staff-driven updates*

- Staff updates in Coda flow back to the database
- Intake checklists, prior authorizations, task management
- Deep Cura data enrichment for billing workflows
- Email-based intake processing (travel letters, ASRS)

**Outcome:** Two-way data flow, staff workflows fully supported.

### Phase 4: Hardening (Month 2+)
*Production resilience*

- Database high availability (automatic failover)
- Staging environment for safe testing
- Performance optimization
- Coordination with website backend team

**Outcome:** Production-grade reliability and scalability.

---

## Investment

### Monthly Cloud Costs

| Resource | Cost |
|----------|------|
| Database (PostgreSQL) | ~$85 |
| Application services | ~$25 |
| Networking, storage, monitoring | ~$15 |
| **Total** | **~$125/month** |

*Costs may increase modestly with data volume. High availability (Phase 4) adds ~$85/month.*

### Development Investment

- **Phase 1-2:** ~1-2 weeks of focused development
- **Phase 3-4:** ~2-4 weeks of development
- **Ongoing:** Minimal maintenance (automated systems)

---

## Risk Management

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DrChrono API issues | Medium | Automated retries, periodic reconciliation catches gaps |
| Data sync failures | Low | Monitoring alerts, manual retry capability |
| Compliance gaps | Low | Audit logging, documented procedures, BAA in place |
| Staff disruption | Low | Coda interface unchanged, only backend improves |

**Rollback plan:** If issues arise during cutover, we can re-enable the Google Sheets pipeline within minutes. No data is deleted during transition.

---

## Compliance Posture

### HIPAA Requirements Addressed

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | AES-256 encryption on all stored data |
| Encryption in transit | TLS 1.2+ on all connections |
| Access controls | Role-based access, Google Workspace SSO |
| Audit logging | Every PHI change logged with before/after state |
| Data retention | 7-year retention for audit logs |
| Breach procedures | Documented incident response playbook |

### Business Associate Agreements

- ✅ Google Cloud Platform — BAA signed
- ✅ Coda — Enterprise plan with BAA
- ✅ Deep Cura — BAA in place
- ✅ DrChrono — BAA in place

---

## Success Metrics

### Operational

| Metric | Target |
|--------|--------|
| Data sync latency | < 60 seconds |
| Sync success rate | > 99.9% |
| Data accuracy | 100% match with DrChrono |

### Compliance

| Metric | Target |
|--------|--------|
| Audit log coverage | 100% of PHI changes logged |
| Log retention | 7 years |
| Breach response readiness | Documented, tested |

### Staff Experience

| Metric | Target |
|--------|--------|
| Time spent troubleshooting data issues | Reduced significantly |
| Confidence in data accuracy | High |
| System downtime impact | Minimal (Coda remains usable) |

---

## Timeline

```
Week 1          Week 2          Weeks 3-4       Month 2+
───────────────────────────────────────────────────────────
│ Phase 1      │ Phase 2       │ Phase 3       │ Phase 4
│              │               │               │
│ Core sync    │ Monitoring    │ Bidirectional │ Hardening
│ pipeline     │ & compliance  │ sync          │
│              │               │               │
│ ✓ Database   │ ✓ Dashboard   │ ✓ Write-back  │ ✓ HA
│ ✓ DrChrono   │ ✓ Alerting    │ ✓ Enrichment  │ ✓ Staging
│ ✓ Deep Cura  │ ✓ Runbooks    │ ✓ Email proc  │ ✓ Tuning
│ ✓ Coda push  │               │               │
│              │               │               │
│ CUTOVER ─────│               │               │
│ (Sheets off) │               │               │
───────────────────────────────────────────────────────────
```

---

## Recommendation

We recommend proceeding with this initiative. The current Google Sheets pipeline presents operational and compliance risks that grow over time. The proposed solution:

- **Addresses immediate pain points** — Reliable sync, no more silent failures
- **Closes compliance gaps** — Complete audit trail, proper access controls
- **Enables future growth** — Foundation for patient portal, mobile app, custom dashboards
- **Low risk** — Proven technologies, incremental rollout, easy rollback

The investment is modest (~$125/month) and the implementation timeline is measured in weeks, not months.

---

## Next Steps

1. **Approve initiative** — Confirm go-ahead for development
2. **Verify DrChrono API access** — Ensure OAuth credentials are available
3. **Confirm Deep Cura Gridhook configuration** — Coordinate with Deep Cura support
4. **Schedule cutover window** — Identify low-traffic period for transition
5. **Brief clinical ops staff** — Set expectations for transition

---

## Questions?

Contact Bobby for technical details or implementation timeline questions.

---

*This document summarizes the technical specification. Full implementation details are available in the product-plan folder.*

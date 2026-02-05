# Risk Register

Identified risks, their likelihood/impact, and mitigation strategies.

---

## Risk Assessment Matrix

| Likelihood | Impact | Risk Level |
|------------|--------|------------|
| High | High | **Critical** |
| High | Medium | High |
| Medium | High | High |
| High | Low | Medium |
| Medium | Medium | Medium |
| Low | High | Medium |
| Medium | Low | Low |
| Low | Medium | Low |
| Low | Low | Low |

---

## Integration Risks

### RISK-001: DrChrono API Rate Limits During Backfill

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** Initial data backfill may hit DrChrono's 100 req/min rate limit, causing sync failures or delays.

**Mitigations:**
- Use bulk APIs (`patients_list`, `appointments_list`) instead of individual fetches
- Implement exponential backoff with jitter
- Throttle requests to 50% of rate limit
- Run backfill during off-hours
- Monitor rate limit headers and pause preemptively

**Detection:** 429 status codes in access_log

---

### RISK-002: DrChrono OAuth Token Revoked

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Low |
| **Impact** | High |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** OAuth tokens could be revoked (manual action in DrChrono, security policy), breaking all sync operations.

**Mitigations:**
- Alert immediately on 401 errors from DrChrono API
- Document re-authorization procedure
- Store refresh token securely with versioning
- Test token refresh mechanism weekly

**Detection:** 401 status codes in access_log, sync_log failures

**Recovery:** Manual re-authorization through DrChrono portal (documented procedure)

---

### RISK-003: Coda API Rate Limits During Full Push

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium |
| **Impact** | Low |
| **Risk Level** | Low |
| **Owner** | Engineering |

**Description:** Full table sync to Coda may hit rate limits, causing temporary push delays.

**Mitigations:**
- Batch upserts (500 rows per request)
- Implement request queue with backoff
- Spread full syncs over time
- Enterprise tier has higher limits

**Detection:** 429 status codes in access_log

**Impact:** Coda temporarily out of sync (self-recovers on next push)

---

### RISK-004: Clinical Notes Sync Is Slow

| Attribute | Value |
|-----------|-------|
| **Likelihood** | High |
| **Impact** | Medium |
| **Risk Level** | High |
| **Owner** | Engineering |

**Description:** DrChrono clinical notes API paginates at 5 per page (max 20), making bulk sync very slow.

**Mitigations:**
- Use incremental sync with `since` parameter aggressively
- Cache notes locally after first fetch
- Rely on webhooks for real-time updates
- Only bulk sync notes from past 30 days
- Alert if sync duration exceeds threshold

**Detection:** sync_log duration_ms > 300000 for clinical_notes

---

### RISK-005: Webhook Delivery Gaps

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** DrChrono may occasionally fail to deliver webhooks (network issues, their bugs), causing missed updates.

**Mitigations:**
- Run full reconciliation every 15 minutes via Cloud Scheduler
- Compare record counts (DrChrono vs Postgres) daily
- Alert on count discrepancies > 0
- Reconciliation catches anything webhooks miss

**Detection:** Data integrity verification script alerts

---

### RISK-006: Deep Cura Gridhook Encryption Changes

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Low |
| **Impact** | Medium |
| **Risk Level** | Low |
| **Owner** | Engineering |

**Description:** Deep Cura may change their Gridhook encryption format without notice.

**Mitigations:**
- Version the decryption logic
- Test decryption after each Deep Cura update
- Maintain relationship with Deep Cura support
- Log decryption failures with payload samples (encrypted)

**Detection:** Decryption failures in sync_log

---

### RISK-007: Deep Cura Note Linking Failures

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium |
| **Impact** | Low |
| **Risk Level** | Low |
| **Owner** | Engineering |

**Description:** Deep Cura notes may not link to clinical notes if appointment IDs don't match or notes arrive before DrChrono syncs.

**Mitigations:**
- Multiple linking strategies (appointment ID, patient + date)
- Retry linking when clinical notes sync
- Admin dashboard shows unlinked notes for manual review
- Track linking success rate metric

**Detection:** unlinked_deepcura_notes view in admin dashboard

---

### RISK-008: DrChrono OAuth Token Contention

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** Both clinical backend and website backend need DrChrono API access. Concurrent token refreshes could cause race conditions or token invalidation.

**Mitigations:**
- Single owner of token refresh (drchrono-sync service)
- Website backend reads current token from Secret Manager, never refreshes
- Implement token refresh locking (distributed lock or single-writer pattern)
- Monitor for refresh failures

**Detection:** 401 errors after recent token refresh

---

## Infrastructure Risks

### RISK-009: GCP Region Outage

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Very Low |
| **Impact** | High |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** us-west1 region experiences extended outage.

**Mitigations:**
- Cloud SQL automated daily backups
- Backups stored in multi-region location
- Documented recovery procedure
- Can restore to different region if needed
- Phase 4: Enable regional HA for automatic failover

**Detection:** GCP status page, service unavailability

**RTO:** < 15 minutes (with HA enabled)

---

### RISK-010: Coda Schema Changes Break Push

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** Staff modify Coda table structure (add/remove/rename columns), breaking the column ID mappings.

**Mitigations:**
- Map by column ID (stable) not column name
- Version the mapping configuration
- Document mappings for reference
- Alert on Coda API errors (400 status codes)
- Graceful handling of missing columns

**Detection:** 400 errors in access_log for coda_api

---

### RISK-011: Website Booking Before Webhook Pipeline Live

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Low |
| **Impact** | High |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** Website booking goes live before clinical backend webhook pipeline is operational, causing appointments to be created in DrChrono but not synced to Postgres/Coda.

**Mitigations:**
- **Dependency:** Clinical backend Phase 1 must complete before website booking goes live
- Run backfill after website launch to catch any missed appointments
- Monitor for orphan appointments (in DrChrono but not Postgres)

**Detection:** Appointment count discrepancy

---

## Security Risks

### RISK-012: PHI Exposure via Logging

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Low |
| **Impact** | High |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** Sensitive PHI accidentally logged in application logs, Cloud Logging, or error messages.

**Mitigations:**
- Never log raw patient data (names, DOB, diagnoses)
- Log only record IDs, not content
- Sanitize error messages before logging
- Review logging practices in code reviews
- Cloud Logging has access controls

**Detection:** Log review, security audit

---

### RISK-013: Service Account Key Compromise

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Very Low |
| **Impact** | Critical |
| **Risk Level** | Medium |
| **Owner** | Engineering |

**Description:** Service account key is leaked or compromised.

**Mitigations:**
- **Use Workload Identity** — no service account keys at all
- Organization policy: disable service account key creation
- If keys must exist: rotate regularly, store in Secret Manager

**Detection:** Unusual API activity, Security Command Center alerts

---

## Operational Risks

### RISK-014: Google Sheets Pipeline Re-Enabled

| Attribute | Value |
|-----------|-------|
| **Likelihood** | Low |
| **Impact** | High |
| **Risk Level** | Medium |
| **Owner** | Operations |

**Description:** Legacy Google Sheets pipeline accidentally re-enabled, causing duplicate/conflicting data flows.

**Mitigations:**
- Document shutdown procedure clearly
- Remove webhook URLs from DrChrono (don't just pause)
- Archive (don't delete) scripts for reference
- Monitor for unexpected Sheets activity

**Detection:** Duplicate records, data inconsistencies

---

## Risk Review Schedule

| Frequency | Activity |
|-----------|----------|
| Weekly | Review sync failures, error rates |
| Monthly | Review access patterns, security alerts |
| Quarterly | Full risk register review, update assessments |
| Annually | Comprehensive security audit |
| After incidents | Update risk register with lessons learned |

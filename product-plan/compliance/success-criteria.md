# Success Criteria

Measurable criteria for each phase and overall system health.

---

## Phase 1: Foundation & Core Sync

### Completion Criteria

- [ ] All patients (since 1/1/2024) are in Postgres with correct data
- [ ] All appointments are in Postgres with correct data
- [ ] Clinical notes syncing (locked/signed notes)
- [ ] Medications syncing
- [ ] Problems (diagnoses) syncing
- [ ] Allergies syncing
- [ ] Insurance records syncing
- [ ] Deep Cura Gridhook data flowing into `deepcura_notes`
- [ ] DrChrono webhooks flowing through the new pipeline
- [ ] Coda tables populated from Postgres (not Google Sheets)
- [ ] Google Sheets Master Script disabled
- [ ] Audit logging functioning (`change_log` populated on every sync)
- [ ] No data loss over 24-hour monitoring period

### Verification Queries

```sql
-- Patient count matches DrChrono
SELECT COUNT(*) FROM patients;
-- Compare with DrChrono API: GET /api/patients_list

-- Appointment count matches DrChrono (last 90 days)
SELECT COUNT(*) FROM appointments
WHERE scheduled_time > NOW() - INTERVAL '90 days';

-- Audit logs being created
SELECT COUNT(*) FROM change_log WHERE created_at > NOW() - INTERVAL '24 hours';

-- No sync failures in last 24 hours
SELECT COUNT(*) FROM sync_log
WHERE status = 'failed' AND started_at > NOW() - INTERVAL '24 hours';
```

---

## Phase 2: Monitoring & Compliance

### Completion Criteria

- [ ] Cloud Monitoring dashboards operational
- [ ] Alerting policies configured and tested
- [ ] Data integrity verification script running daily
- [ ] Security Command Center enabled
- [ ] Incident response playbook documented
- [ ] Operational runbook documented
- [ ] Admin dashboard deployed
- [ ] All owners can access dashboard

### Alert Verification

- [ ] Sync failure alert triggers correctly (test by causing a failure)
- [ ] DrChrono auth error alert triggers (test with invalid token)
- [ ] Alert notifications reach all owners

---

## Phase 3: Bidirectional Sync & Enrichment

### Completion Criteria

- [ ] Write-back API deployed
- [ ] Coda button automations triggering write-back
- [ ] Intake checklist updates flowing Coda → Postgres
- [ ] Prior authorization updates flowing Coda → Postgres
- [ ] Deep Cura note linking rate > 95%
- [ ] CPT code discrepancy flagging working
- [ ] Email processor handling travel letters (if implemented)
- [ ] Email processor handling ASRS intake (if implemented)

### Verification Queries

```sql
-- Write-back operations logged
SELECT COUNT(*) FROM change_log
WHERE actor = 'coda_writeback' AND created_at > NOW() - INTERVAL '7 days';

-- Deep Cura linking rate
SELECT
  COUNT(*) FILTER (WHERE clinical_note_id IS NOT NULL) * 100.0 / COUNT(*) AS linking_rate
FROM deepcura_notes
WHERE created_at > NOW() - INTERVAL '30 days';
```

---

## Phase 4: Hardening & Expansion

### Completion Criteria

- [ ] Cloud SQL High Availability enabled
- [ ] Staging environment operational
- [ ] Billing/claims sync working (if implemented)
- [ ] Lab results sync working (if implemented)
- [ ] Website backend coordination complete
- [ ] Patient identity linking strategy implemented
- [ ] Performance benchmarks met

---

## System Health Metrics

### Sync Performance

| Metric | Target | Acceptable | Alert Threshold |
|--------|--------|------------|-----------------|
| Webhook → Postgres latency | < 5s | < 30s | > 60s |
| Postgres → Coda latency | < 30s | < 60s | > 120s |
| End-to-end latency (webhook → Coda) | < 60s | < 120s | > 180s |
| Full reconciliation duration | < 5m | < 10m | > 15m |

### Reliability

| Metric | Target | Acceptable | Alert Threshold |
|--------|--------|------------|-----------------|
| Sync success rate | > 99.9% | > 99% | < 98% |
| Service uptime | > 99.9% | > 99% | < 99% |
| Data discrepancy rate | 0% | < 0.1% | > 0% |

### Data Quality

| Metric | Target | Acceptable | Alert Threshold |
|--------|--------|------------|-----------------|
| Deep Cura note linking rate | > 98% | > 95% | < 90% |
| Unlinked notes pending review | < 5 | < 10 | > 20 |
| Orphan records (in Coda, not Postgres) | 0 | 0 | > 0 |

### Audit Compliance

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Change log entries per sync | > 0 | = 0 (missing audit) |
| Log retention | 7 years | < 7 years |
| Access log coverage | 100% | < 100% |

---

## Monitoring Dashboard Queries

### Real-Time Health

```sql
-- Sync health by source (last 24h)
SELECT
  source,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  ROUND(AVG(duration_ms)) AS avg_duration_ms
FROM sync_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

### 7-Day Trend

```sql
-- Daily sync counts
SELECT
  DATE(started_at) AS date,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed
FROM sync_log
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at)
ORDER BY date;
```

### Error Summary

```sql
-- Errors by type (last 7 days)
SELECT
  COALESCE(error_message, 'Unknown') AS error_type,
  COUNT(*) AS count
FROM sync_log
WHERE status = 'failed' AND started_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY count DESC
LIMIT 10;
```

---

## Go-Live Checklist

### Pre-Launch (Day -1)

- [ ] All Phase 1 completion criteria met
- [ ] Initial backfill complete
- [ ] Data integrity verified (spot-check 20 patients, 50 appointments)
- [ ] Alerting tested
- [ ] Runbook reviewed
- [ ] Team briefed on monitoring procedures

### Launch Day (Day 0)

- [ ] Pause Google Sheets webhooks
- [ ] Verify new pipeline receiving webhooks
- [ ] Monitor for 2 hours
- [ ] Verify Coda receiving data
- [ ] Disable Google Sheets Master Script

### Post-Launch (Day 1-7)

- [ ] Daily data integrity checks
- [ ] Monitor sync latency and error rates
- [ ] Address any issues discovered
- [ ] Collect feedback from clinical ops staff
- [ ] Document any gaps or improvements needed

### Stabilization (Week 2+)

- [ ] Archive Google Sheets (read-only, 2 weeks)
- [ ] Delete Google Sheets webhooks from DrChrono
- [ ] Begin Phase 2 implementation

# Incident Response Playbook

Procedures for detecting, responding to, and recovering from security incidents involving PHI.

---

## Incident Classification

### Severity Levels

| Level | Description | Examples | Response Time |
|-------|-------------|----------|---------------|
| **Critical** | Active breach, data exfiltration | Unauthorized access to PHI, credential compromise | Immediate (< 1 hour) |
| **High** | Potential breach, system compromise | Failed auth spike, suspicious queries, malware detection | < 4 hours |
| **Medium** | Service degradation, anomalies | Sync failures, elevated error rates | < 24 hours |
| **Low** | Minor issues, policy violations | Single failed login, minor config drift | < 72 hours |

---

## Detection

### Automated Detection Sources

1. **Security Command Center**
   - Anomalous access patterns
   - Exposed credentials
   - Misconfigurations

2. **Cloud Monitoring Alerts**
   - Authentication failures (401 spikes)
   - Unusual API error rates
   - Off-hours access patterns
   - Database connection anomalies

3. **Application Audit Logs**
   - Bulk data exports
   - Unusual query patterns
   - Access from new IP ranges

### Alert Notification Flow

```
Security Command Center
    │
    └──> Cloud Monitoring
            │
            ├──> Email to bobby@feelaugust.com
            ├──> Email to [co-owner]@feelaugust.com
            └──> Slack #alerts channel (optional)
```

---

## Response Procedure

### Phase 1: DETECT & TRIAGE (0-1 hour)

**Goal:** Confirm incident, assess scope, classify severity.

1. **Acknowledge the alert**
   - Note the time, source, and initial details
   - Begin incident documentation

2. **Assess the situation**
   - What system is affected?
   - What data may be exposed?
   - Is the incident ongoing?

3. **Classify severity**
   - Use the severity matrix above
   - When in doubt, escalate to higher severity

4. **Notify stakeholders**
   - Critical/High: Both owners immediately
   - Medium: Within 4 hours
   - Low: Next business day

### Phase 2: CONTAIN (1-4 hours)

**Goal:** Stop the bleeding. Prevent further damage.

**Credential Compromise:**
```bash
# Revoke compromised service account
gcloud iam service-accounts disable SA_EMAIL

# Rotate all secrets
gcloud secrets versions disable --secret=SECRET_NAME --version=LATEST

# Rotate DrChrono OAuth tokens
# (Requires manual re-authorization in DrChrono portal)
```

**Suspicious Database Access:**
```bash
# Revoke database user
gcloud sql users set-password USER --instance=INSTANCE --host=% --password=NEW_PASSWORD

# Block specific IP (if identified)
gcloud sql instances patch INSTANCE --authorized-networks=SAFE_RANGES
```

**Service Compromise:**
```bash
# Stop the affected Cloud Run service
gcloud run services delete SERVICE_NAME --region=REGION

# Or deploy a "maintenance mode" version
gcloud run deploy SERVICE_NAME --image=gcr.io/PROJECT/maintenance-page
```

**Network Intrusion:**
```bash
# Update firewall rules
gcloud compute firewall-rules update RULE --disabled

# Isolate VPC (extreme measure)
gcloud compute networks subnets update SUBNET --region=REGION --enable-private-ip-google-access
```

### Phase 3: ASSESS (4-24 hours)

**Goal:** Determine scope — which records, which PHI elements, how many patients.

**Query Change Log:**
```sql
-- Find suspicious changes in time window
SELECT *
FROM change_log
WHERE created_at BETWEEN '2024-02-05 00:00:00' AND '2024-02-05 23:59:59'
  AND actor NOT IN ('drchrono_sync', 'coda_push', 'coda_writeback')
ORDER BY created_at;

-- Count affected patients
SELECT COUNT(DISTINCT drchrono_id)
FROM change_log
WHERE created_at BETWEEN '...' AND '...'
  AND table_name = 'patients';
```

**Query Access Log:**
```sql
-- Find suspicious API calls
SELECT *
FROM access_log
WHERE created_at BETWEEN '...' AND '...'
  AND (status_code >= 400 OR endpoint LIKE '%/patients%')
ORDER BY created_at;
```

**Query Cloud Audit Logs:**
```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND
   timestamp>="2024-02-05T00:00:00Z" AND
   timestamp<="2024-02-05T23:59:59Z"' \
  --limit=1000 \
  --format=json
```

**Document Findings:**
- Which systems were accessed?
- Which records were viewed/modified/exported?
- Which PHI elements were exposed? (name, DOB, SSN, diagnoses, etc.)
- How many unique patients affected?
- What was the attack vector?

### Phase 4: NOTIFY (24-60 hours for breaches)

**HIPAA Breach Notification Requirements:**

| Audience | Condition | Timeline |
|----------|-----------|----------|
| **Affected Individuals** | Any breach | Within 60 days |
| **HHS** | ≥500 individuals | Within 60 days |
| **Media** | ≥500 individuals in a state | Within 60 days |
| **California AG** | ≥500 California residents | Immediately |

**HHS Breach Portal:**
https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf

**Notification Letter Template:**

```
Dear [Patient Name],

We are writing to inform you of a security incident that may have affected
your personal health information.

WHAT HAPPENED:
On [DATE], we discovered [DESCRIPTION OF INCIDENT].

WHAT INFORMATION WAS INVOLVED:
The information potentially affected includes: [LIST PHI ELEMENTS]

WHAT WE ARE DOING:
[DESCRIBE REMEDIATION STEPS]

WHAT YOU CAN DO:
[RECOMMEND PROTECTIVE ACTIONS - credit monitoring, etc.]

FOR MORE INFORMATION:
Contact us at [PHONE/EMAIL] if you have questions.

Sincerely,
Feel August Health
```

### Phase 5: REMEDIATE (Ongoing)

**Goal:** Fix the vulnerability, restore normal operations, prevent recurrence.

1. **Patch the vulnerability**
   - Deploy fixed code
   - Update configurations
   - Rotate all affected credentials

2. **Restore services**
   - Re-enable services in safe state
   - Monitor closely for 48 hours
   - Verify normal operation

3. **Update defenses**
   - Add detection rules for the attack vector
   - Implement additional controls
   - Update monitoring thresholds

4. **Document lessons learned**
   - Root cause analysis
   - Timeline of events
   - What worked, what didn't
   - Recommendations for future

### Phase 6: DOCUMENT (Within 7 days)

**Incident Report Template:**

```markdown
# Incident Report: [INCIDENT ID]

## Summary
- **Date Detected:** YYYY-MM-DD HH:MM
- **Date Contained:** YYYY-MM-DD HH:MM
- **Date Resolved:** YYYY-MM-DD HH:MM
- **Severity:** Critical/High/Medium/Low
- **Type:** [Unauthorized access / Data exfiltration / Service compromise / etc.]

## Timeline
- HH:MM - Event description
- HH:MM - Event description
- ...

## Impact
- **Systems Affected:** [List]
- **Data Affected:** [PHI elements]
- **Patients Affected:** [Count]
- **Duration:** [Hours/Days]

## Root Cause
[Description of vulnerability and how it was exploited]

## Response Actions
1. [Action taken]
2. [Action taken]
...

## Remediation
- [Fix implemented]
- [Control added]
...

## Lessons Learned
- What went well:
- What could improve:
- Recommendations:

## Notification Status
- [ ] Affected individuals notified
- [ ] HHS notified (if applicable)
- [ ] State AG notified (if applicable)
```

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Owner | Bobby | [PHONE] | bobby@feelaugust.com |
| Owner | [Co-owner] | [PHONE] | [EMAIL] |
| GCP Support | — | — | Cloud Console |
| DrChrono Support | — | — | support@drchrono.com |

---

## Post-Incident Review

Within 2 weeks of incident resolution:

1. **Schedule review meeting** with all involved parties
2. **Review the incident report** for accuracy
3. **Identify systemic issues** that contributed
4. **Assign action items** for improvements
5. **Update this playbook** based on lessons learned
6. **Test new controls** to verify effectiveness

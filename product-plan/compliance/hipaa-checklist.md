# HIPAA Compliance Checklist

Implementation checklist for HIPAA technical, administrative, and physical safeguards.

---

## Technical Safeguards

### Access Controls (§164.312(a)(1))

- [ ] **Unique User IDs**
  - Google Workspace SSO provides unique identity for all staff
  - Service accounts have unique identifiers
  - IAM policies enforce identity-based access

- [ ] **Automatic Logoff**
  - Cloud Run services are stateless (no user sessions)
  - Admin dashboard session timeout: 30 minutes (via IAP)

- [ ] **Encryption at Rest**
  - Cloud SQL: AES-256 encryption (Google-managed keys)
  - Cloud Storage: AES-256 encryption (Google-managed keys)
  - Secret Manager: Encrypted by default

- [ ] **Encryption in Transit**
  - All Cloud Run services require HTTPS (TLS 1.2+)
  - Cloud SQL connections use SSL
  - Internal VPC traffic encrypted

### Audit Controls (§164.312(b))

- [ ] **Activity Logging**
  - `change_log` table records all PHI changes with before/after state
  - `sync_log` table records all sync operations
  - `access_log` table records all external API calls
  - Cloud Audit Logs capture GCP-level events

- [ ] **Log Retention**
  - Audit tables: 7-year retention
  - Cloud Logging: 30-day default, exported to Cloud Storage for 7-year retention
  - Automated cleanup via `cleanup_expired_audit_data()` function

- [ ] **Log Protection**
  - Cloud Storage bucket with retention policy (cannot be deleted)
  - IAM prevents unauthorized log modification

### Integrity Controls (§164.312(c)(1))

- [ ] **Data Integrity**
  - PostgreSQL transactions ensure atomic operations
  - Upsert operations prevent duplicate records
  - Audit triggers capture all changes

- [ ] **Validation**
  - Zod schema validation on all API inputs
  - Database constraints enforce data integrity
  - Type checking via TypeScript

### Transmission Security (§164.312(e)(1))

- [ ] **HTTPS Everywhere**
  - Cloud Run enforces HTTPS
  - DrChrono API calls use HTTPS
  - Coda API calls use HTTPS
  - Deep Cura Gridhooks use HTTPS

- [ ] **Network Isolation**
  - Cloud SQL on private VPC (no public IP)
  - Services connect via VPC connector
  - No PHI transmitted over public internet unencrypted

---

## Administrative Safeguards

### Security Management (§164.308(a)(1))

- [ ] **Risk Assessment**
  - Document data flows and identify threats
  - See `risk-register.md` for identified risks and mitigations
  - Review annually or after significant changes

- [ ] **Sanction Policy**
  - Documented policy for workforce violations
  - Progressive discipline procedure

- [ ] **Information System Activity Review**
  - Weekly review of sync logs for anomalies
  - Monthly review of access patterns
  - Automated alerting for suspicious activity

### Workforce Security (§164.308(a)(3))

- [ ] **Access Authorization**
  - IAM roles define access levels
  - Staff roles table (`staff_roles`) controls dashboard access
  - Principle of least privilege applied

- [ ] **Termination Procedures**
  - Remove GCP IAM access immediately
  - Remove staff_roles record
  - Revoke OAuth tokens if applicable

### Information Access Management (§164.308(a)(4))

- [ ] **Access to PHI**
  - Service accounts have scoped database permissions
  - Admin dashboard requires Google Workspace authentication
  - Role-based UI visibility (admin/operator/viewer)

### Security Awareness (§164.308(a)(5))

- [ ] **Training**
  - Document access procedures for system users
  - Annual HIPAA training for all staff with PHI access

### Security Incident Procedures (§164.308(a)(6))

- [ ] **Incident Response Plan**
  - See `incident-response.md` for detailed playbook
  - Security Command Center for detection
  - Documented escalation procedures

### Contingency Plan (§164.308(a)(7))

- [ ] **Data Backup**
  - Cloud SQL automated daily backups
  - 7-day backup retention
  - Point-in-time recovery enabled

- [ ] **Disaster Recovery**
  - Cloud SQL regional failover available (Phase 4)
  - Documented recovery procedures
  - Recovery time objective (RTO): < 15 minutes

- [ ] **Emergency Mode Operation**
  - DrChrono remains authoritative if sync fails
  - Manual procedures documented for Coda-only operation

### Evaluation (§164.308(a)(8))

- [ ] **Periodic Assessment**
  - Annual security review
  - Review after significant system changes
  - Update risk assessment as needed

### Business Associate Agreements (§164.308(b)(1))

- [x] **GCP BAA** — Signed via GCP Console
- [x] **Coda BAA** — Enterprise plan with BAA
- [x] **Deep Cura BAA** — Signed with vendor
- [ ] **DrChrono BAA** — Verify BAA in place

---

## Physical Safeguards

### Facility Access (§164.310(a)(1))

- [x] **GCP Data Centers**
  - Google manages physical security
  - SOC 2 Type II certified
  - ISO 27001 certified

### Workstation Security (§164.310(b))

- [ ] **Staff Workstations**
  - Google Workspace with enforced 2FA
  - No PHI stored locally
  - All access via browser to cloud services

### Device and Media Controls (§164.310(d)(1))

- [x] **No Local PHI Storage**
  - All data in GCP
  - No database exports to local machines
  - Development uses anonymized test data

---

## GCP Organization Policy Constraints

Apply these constraints to enforce compliance:

```bash
# Restrict Cloud SQL to private IP only
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/sql.restrictPublicIp
spec:
  rules:
  - enforce: true
EOF

# Disable service account key creation (use Workload Identity)
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/iam.disableServiceAccountKeyCreation
spec:
  rules:
  - enforce: true
EOF

# Restrict resources to US locations
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/gcp.resourceLocations
spec:
  rules:
  - values:
      allowedValues:
      - in:us-locations
EOF

# Require uniform bucket access
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/storage.uniformBucketLevelAccess
spec:
  rules:
  - enforce: true
EOF

# Require shielded VMs
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/compute.requireShieldedVm
spec:
  rules:
  - enforce: true
EOF
```

---

## Compliance Verification Checklist

Before go-live, verify:

- [ ] BAA signed with GCP
- [ ] Organization policies applied
- [ ] Cloud SQL on private IP only
- [ ] All services use HTTPS
- [ ] Audit triggers functioning (test with sample INSERT/UPDATE/DELETE)
- [ ] Log export to Cloud Storage configured
- [ ] Cloud Storage retention policy enabled
- [ ] IAM roles reviewed and minimized
- [ ] Service accounts have no keys (Workload Identity only)
- [ ] Security Command Center enabled
- [ ] Alerting policies configured
- [ ] Incident response playbook documented
- [ ] Staff training completed

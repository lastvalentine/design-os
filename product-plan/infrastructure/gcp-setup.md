# GCP Project Setup Guide

Step-by-step instructions for setting up the GCP project for Feel August Platform.

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Terraform v1.5+ installed
- Owner access to create projects and enable APIs

---

## Phase 1: Project Creation

### 1.1 Create the GCP Project

```bash
# Set your organization ID (or omit for personal accounts)
export ORG_ID="your-org-id"
export PROJECT_ID="feel-august-platform"
export BILLING_ACCOUNT="your-billing-account-id"

# Create project
gcloud projects create $PROJECT_ID \
  --organization=$ORG_ID \
  --name="Feel August Platform"

# Link billing
gcloud billing projects link $PROJECT_ID \
  --billing-account=$BILLING_ACCOUNT

# Set as default project
gcloud config set project $PROJECT_ID
```

### 1.2 Sign the BAA (CRITICAL)

**Before storing any PHI**, you must sign the Business Associate Addendum:

1. Go to: https://console.cloud.google.com/terms
2. Review and sign the BAA
3. Confirm BAA is active in the console

### 1.3 Enable Required APIs

```bash
gcloud services enable \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  run.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudresourcemanager.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com \
  iap.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  securitycenter.googleapis.com
```

---

## Phase 2: Organization Policies

Apply security constraints to enforce HIPAA compliance.

### 2.1 Restrict Cloud SQL to Private IP

```bash
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/sql.restrictPublicIp
spec:
  rules:
  - enforce: true
EOF
```

### 2.2 Disable Service Account Key Creation

```bash
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/iam.disableServiceAccountKeyCreation
spec:
  rules:
  - enforce: true
EOF
```

### 2.3 Restrict Resource Locations (US only)

```bash
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/gcp.resourceLocations
spec:
  rules:
  - values:
      allowedValues:
      - in:us-locations
EOF
```

### 2.4 Require Uniform Bucket Access

```bash
gcloud org-policies set-policy - <<EOF
name: projects/$PROJECT_ID/policies/storage.uniformBucketLevelAccess
spec:
  rules:
  - enforce: true
EOF
```

---

## Phase 3: Networking

### 3.1 Create VPC Network

```bash
# Create VPC
gcloud compute networks create feel-august-vpc \
  --subnet-mode=custom \
  --bgp-routing-mode=regional

# Create subnet
gcloud compute networks subnets create feel-august-subnet \
  --network=feel-august-vpc \
  --region=us-west1 \
  --range=10.0.0.0/24

# Reserve IP range for Private Service Connect
gcloud compute addresses create google-managed-services \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=feel-august-vpc

# Create Private Service Connect
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services \
  --network=feel-august-vpc
```

### 3.2 Create Serverless VPC Connector

```bash
gcloud compute networks vpc-access connectors create feel-august-connector \
  --region=us-west1 \
  --network=feel-august-vpc \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=10
```

---

## Phase 4: Cloud SQL

### 4.1 Create PostgreSQL Instance

```bash
gcloud sql instances create feel-august-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-7680 \
  --region=us-west1 \
  --network=feel-august-vpc \
  --no-assign-ip \
  --storage-size=50GB \
  --storage-type=SSD \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=7 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4 \
  --deletion-protection
```

### 4.2 Create Database and User

```bash
# Create database
gcloud sql databases create clinical --instance=feel-august-db

# Generate and store password
DB_PASSWORD=$(openssl rand -base64 32)
echo "Save this password securely: $DB_PASSWORD"

# Create user
gcloud sql users create app_user \
  --instance=feel-august-db \
  --password=$DB_PASSWORD
```

### 4.3 Run Schema Migration

```bash
# Connect to instance (requires Cloud SQL Proxy or IAM auth)
gcloud sql connect feel-august-db --user=app_user --database=clinical

# In psql, run the schema
\i database/schema.sql
```

---

## Phase 5: Secret Manager

### 5.1 Create Secrets

```bash
# Database password
echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# DrChrono OAuth (get from DrChrono developer portal)
gcloud secrets create drchrono-client-id --replication-policy="automatic"
gcloud secrets create drchrono-client-secret --replication-policy="automatic"
gcloud secrets create drchrono-access-token --replication-policy="automatic"
gcloud secrets create drchrono-refresh-token --replication-policy="automatic"

# Deep Cura shared secret (get from Deep Cura support)
gcloud secrets create deepcura-shared-secret --replication-policy="automatic"

# Coda API token (get from Coda account settings)
gcloud secrets create coda-api-token --replication-policy="automatic"
```

### 5.2 Set Secret Values

```bash
# Set each secret value (replace with actual values)
echo -n "YOUR_DRCHRONO_CLIENT_ID" | \
  gcloud secrets versions add drchrono-client-id --data-file=-

echo -n "YOUR_DRCHRONO_CLIENT_SECRET" | \
  gcloud secrets versions add drchrono-client-secret --data-file=-

echo -n "YOUR_DEEPCURA_SHARED_SECRET" | \
  gcloud secrets versions add deepcura-shared-secret --data-file=-

echo -n "YOUR_CODA_API_TOKEN" | \
  gcloud secrets versions add coda-api-token --data-file=-
```

---

## Phase 6: Service Accounts

### 6.1 Create Service Accounts

```bash
# DrChrono sync service
gcloud iam service-accounts create drchrono-sync-sa \
  --display-name="DrChrono Sync Service"

# Coda push service
gcloud iam service-accounts create coda-push-sa \
  --display-name="Coda Push Service"

# Write-back API
gcloud iam service-accounts create writeback-api-sa \
  --display-name="Write-back API Service"

# Admin dashboard
gcloud iam service-accounts create admin-dashboard-sa \
  --display-name="Admin Dashboard Service"
```

### 6.2 Grant IAM Roles

```bash
# DrChrono sync
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:drchrono-sync-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:drchrono-sync-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:drchrono-sync-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# Coda push
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:coda-push-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:coda-push-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:coda-push-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"
```

---

## Phase 7: Pub/Sub

### 7.1 Create Topics

```bash
# Main change events topic
gcloud pubsub topics create change-events

# Dead letter queue
gcloud pubsub topics create change-events-dlq
```

### 7.2 Create Subscriptions

```bash
# Coda push subscription with DLQ
gcloud pubsub subscriptions create coda-push-subscription \
  --topic=change-events \
  --ack-deadline=60 \
  --min-retry-delay=10s \
  --max-retry-delay=600s \
  --dead-letter-topic=change-events-dlq \
  --max-delivery-attempts=5
```

---

## Phase 8: Cloud Scheduler

### 8.1 Create Reconciliation Jobs

```bash
# Full sync every 15 minutes
gcloud scheduler jobs create http full-sync-job \
  --location=us-west1 \
  --schedule="*/15 * * * *" \
  --uri="https://drchrono-sync-HASH-uw.a.run.app/sync/all" \
  --http-method=POST \
  --oidc-service-account-email=drchrono-sync-sa@$PROJECT_ID.iam.gserviceaccount.com

# Daily audit cleanup
gcloud scheduler jobs create http audit-cleanup-job \
  --location=us-west1 \
  --schedule="0 3 * * *" \
  --uri="https://drchrono-sync-HASH-uw.a.run.app/maintenance/cleanup" \
  --http-method=POST \
  --oidc-service-account-email=drchrono-sync-sa@$PROJECT_ID.iam.gserviceaccount.com
```

---

## Phase 9: Monitoring Setup

### 9.1 Create Notification Channel

```bash
# Email notification channel
gcloud beta monitoring channels create \
  --display-name="Feel August Alerts" \
  --type=email \
  --channel-labels=email_address=alerts@feelaugust.com
```

### 9.2 Create Alert Policies

Create via GCP Console or Terraform. Key alerts:

1. **Sync Failure Alert**
   - Condition: `sync_log.status = 'failed'` count > 0 in 5 minutes
   - Severity: Critical
   - Notification: Immediate email

2. **Auth Token Expired**
   - Condition: `access_log.status_code = 401` for drchrono_api
   - Severity: Critical
   - Notification: Immediate email

3. **High Error Rate**
   - Condition: Error rate > 5% over 15 minutes
   - Severity: High
   - Notification: Email

4. **No Recent Sync**
   - Condition: No successful sync in 30 minutes
   - Severity: High
   - Notification: Email

---

## Phase 10: Log Export

### 10.1 Create Audit Log Bucket

```bash
gcloud storage buckets create gs://$PROJECT_ID-audit-logs \
  --location=us-west1 \
  --uniform-bucket-level-access

# Set 7-year retention
gcloud storage buckets update gs://$PROJECT_ID-audit-logs \
  --retention-period=7y
```

### 10.2 Create Log Sink

```bash
gcloud logging sinks create audit-log-archive \
  storage.googleapis.com/$PROJECT_ID-audit-logs \
  --log-filter='resource.type="cloud_run_revision" OR resource.type="cloudsql_database"'

# Grant sink writer access to bucket
SINK_SA=$(gcloud logging sinks describe audit-log-archive --format='value(writerIdentity)')
gcloud storage buckets add-iam-policy-binding gs://$PROJECT_ID-audit-logs \
  --member=$SINK_SA \
  --role=roles/storage.objectCreator
```

---

## Verification Checklist

After completing setup, verify:

- [ ] BAA signed and active
- [ ] All APIs enabled
- [ ] Organization policies applied
- [ ] VPC and Private Service Connect working
- [ ] Cloud SQL accessible only via private IP
- [ ] Database schema applied
- [ ] All secrets created with values
- [ ] Service accounts created with correct roles
- [ ] Pub/Sub topics and subscriptions active
- [ ] Cloud Scheduler jobs created
- [ ] Alerting policies configured
- [ ] Log sink exporting to Cloud Storage

---

## Next Steps

1. Deploy Cloud Run services (see `backend/` documentation)
2. Configure DrChrono webhooks to point to the sync service
3. Configure Deep Cura Gridhooks to point to the sync service
4. Run initial data backfill
5. Verify Coda receives data from the new pipeline
6. Disable legacy Google Sheets pipeline

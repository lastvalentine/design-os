# Terraform Infrastructure Guide

This guide documents the Terraform module structure for deploying the Feel August Platform to GCP.

## Repository Structure

```
terraform/
├── main.tf                 # Root module composition
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── terraform.tfvars        # Variable values (gitignored)
├── backend.tf              # State storage configuration
│
├── modules/
│   ├── networking/         # VPC, subnets, Private Service Connect
│   ├── cloud-sql/          # PostgreSQL instance and databases
│   ├── cloud-run/          # Service deployments
│   ├── iam/                # Service accounts and IAM bindings
│   ├── pubsub/             # Topics, subscriptions, DLQ
│   ├── secrets/            # Secret Manager resources
│   ├── monitoring/         # Alerting policies, log sinks
│   └── security/           # SCC, org policies
│
└── environments/
    ├── production/
    │   ├── main.tf
    │   └── terraform.tfvars
    └── staging/
        ├── main.tf
        └── terraform.tfvars
```

---

## Module Specifications

### networking

Creates the VPC and network infrastructure for private Cloud SQL access.

**Resources:**
- `google_compute_network` - VPC network
- `google_compute_subnetwork` - Regional subnet
- `google_compute_global_address` - Private IP range for Cloud SQL
- `google_service_networking_connection` - Private Service Connect

**Inputs:**
```hcl
variable "project_id" { type = string }
variable "region" { type = string }
variable "network_name" { type = string, default = "feel-august-vpc" }
```

**Outputs:**
```hcl
output "network_id" { value = google_compute_network.main.id }
output "subnet_id" { value = google_compute_subnetwork.main.id }
```

**Example:**
```hcl
module "networking" {
  source       = "./modules/networking"
  project_id   = var.project_id
  region       = "us-west1"
  network_name = "feel-august-vpc"
}
```

---

### cloud-sql

Provisions the PostgreSQL 16 instance with private networking.

**Resources:**
- `google_sql_database_instance` - PostgreSQL instance
- `google_sql_database` - Clinical database
- `google_sql_user` - Application users

**Inputs:**
```hcl
variable "project_id" { type = string }
variable "region" { type = string }
variable "network_id" { type = string }
variable "instance_name" { type = string, default = "feel-august-db" }
variable "tier" { type = string, default = "db-custom-2-7680" }
variable "disk_size_gb" { type = number, default = 50 }
variable "high_availability" { type = bool, default = false }
variable "backup_enabled" { type = bool, default = true }
variable "backup_retention_days" { type = number, default = 7 }
```

**Outputs:**
```hcl
output "instance_connection_name" { value = google_sql_database_instance.main.connection_name }
output "private_ip_address" { value = google_sql_database_instance.main.private_ip_address }
```

**Configuration:**
```hcl
resource "google_sql_database_instance" "main" {
  name             = var.instance_name
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = var.tier
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
      require_ssl     = true
    }

    backup_configuration {
      enabled                        = var.backup_enabled
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = var.backup_retention_days
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 4  # 4 AM
      update_track = "stable"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"  # Log queries > 1s
    }
  }

  deletion_protection = true
}
```

---

### cloud-run

Deploys Cloud Run services with VPC connector for database access.

**Resources:**
- `google_cloud_run_v2_service` - Cloud Run service
- `google_vpc_access_connector` - VPC connector for private networking

**Inputs:**
```hcl
variable "project_id" { type = string }
variable "region" { type = string }
variable "service_name" { type = string }
variable "image" { type = string }
variable "service_account_email" { type = string }
variable "vpc_connector_id" { type = string }
variable "env_vars" { type = map(string), default = {} }
variable "secrets" {
  type = list(object({
    name        = string
    secret_name = string
    version     = string
  }))
  default = []
}
variable "min_instances" { type = number, default = 0 }
variable "max_instances" { type = number, default = 10 }
variable "cpu" { type = string, default = "1" }
variable "memory" { type = string, default = "512Mi" }
variable "timeout" { type = string, default = "300s" }
variable "ingress" { type = string, default = "INGRESS_TRAFFIC_ALL" }
```

**Example (drchrono-sync):**
```hcl
module "drchrono_sync" {
  source                = "./modules/cloud-run"
  project_id            = var.project_id
  region                = var.region
  service_name          = "drchrono-sync"
  image                 = "gcr.io/${var.project_id}/drchrono-sync:latest"
  service_account_email = module.iam.drchrono_sync_sa_email
  vpc_connector_id      = module.networking.vpc_connector_id
  min_instances         = 1  # Keep warm for webhooks
  max_instances         = 5
  timeout               = "300s"

  env_vars = {
    DB_HOST          = module.cloud_sql.private_ip_address
    DB_NAME          = "clinical"
    PUBSUB_TOPIC     = module.pubsub.change_events_topic
    GCP_PROJECT      = var.project_id
  }

  secrets = [
    { name = "DB_PASSWORD", secret_name = "db-password", version = "latest" },
    { name = "DRCHRONO_CLIENT_ID", secret_name = "drchrono-client-id", version = "latest" },
    { name = "DRCHRONO_CLIENT_SECRET", secret_name = "drchrono-client-secret", version = "latest" },
    { name = "DEEPCURA_SHARED_SECRET", secret_name = "deepcura-shared-secret", version = "latest" },
  ]
}
```

---

### iam

Creates service accounts with least-privilege IAM bindings.

**Resources:**
- `google_service_account` - Per-service service accounts
- `google_project_iam_member` - IAM bindings
- `google_service_account_iam_member` - Workload Identity bindings

**Service Accounts:**

| Service Account | Purpose | Roles |
|-----------------|---------|-------|
| `drchrono-sync-sa` | DrChrono sync service | Cloud SQL Client, Secret Manager Accessor, Pub/Sub Publisher |
| `coda-push-sa` | Coda push service | Cloud SQL Client (read-only), Secret Manager Accessor, Pub/Sub Subscriber |
| `writeback-api-sa` | Write-back API | Cloud SQL Client, Secret Manager Accessor |
| `admin-dashboard-sa` | Admin dashboard | Cloud SQL Client (read-only), Monitoring Viewer |

**Workload Identity:**
```hcl
resource "google_service_account_iam_member" "drchrono_sync_workload_identity" {
  service_account_id = google_service_account.drchrono_sync.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[default/drchrono-sync]"
}
```

---

### pubsub

Creates Pub/Sub topics and subscriptions for event-driven sync.

**Resources:**
- `google_pubsub_topic` - Event topics
- `google_pubsub_subscription` - Push/pull subscriptions
- `google_pubsub_topic` - Dead letter topics

**Topics:**
- `change-events` - Database change events for Coda push
- `change-events-dlq` - Dead letter queue for failed messages

**Subscriptions:**
- `coda-push-subscription` - Pull subscription for coda-push service

**Configuration:**
```hcl
resource "google_pubsub_subscription" "coda_push" {
  name  = "coda-push-subscription"
  topic = google_pubsub_topic.change_events.name

  ack_deadline_seconds = 60

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.change_events_dlq.id
    max_delivery_attempts = 5
  }

  expiration_policy {
    ttl = ""  # Never expire
  }
}
```

---

### secrets

Manages Secret Manager secrets for sensitive configuration.

**Secrets:**
- `drchrono-client-id` - DrChrono OAuth client ID
- `drchrono-client-secret` - DrChrono OAuth client secret
- `drchrono-access-token` - Current access token (updated by service)
- `drchrono-refresh-token` - Refresh token (updated by service)
- `deepcura-shared-secret` - Deep Cura Gridhook AES key
- `coda-api-token` - Coda API token
- `db-password` - Database password

**Note:** Secrets are created with placeholder values. Actual values must be set manually or via a secure provisioning process.

---

### monitoring

Creates Cloud Monitoring alerting policies and log sinks.

**Alerting Policies:**

| Alert | Condition | Severity |
|-------|-----------|----------|
| Sync Failure | sync_log status='failed' count > 0 in 5m | Critical |
| DrChrono Auth Error | access_log status_code=401 for drchrono_api | Critical |
| High Error Rate | error_rate > 5% in 15m | High |
| Sync Latency | avg duration_ms > 30000 in 15m | Medium |
| No Recent Sync | time since last successful sync > 30m | High |
| DLQ Depth | messages in DLQ > 0 | High |

**Log Sink:**
```hcl
resource "google_logging_project_sink" "audit_archive" {
  name        = "audit-log-archive"
  destination = "storage.googleapis.com/${google_storage_bucket.audit_logs.name}"
  filter      = "resource.type=\"cloud_run_revision\" OR resource.type=\"cloudsql_database\""

  unique_writer_identity = true
}

resource "google_storage_bucket" "audit_logs" {
  name     = "${var.project_id}-audit-logs"
  location = var.region

  lifecycle_rule {
    condition {
      age = 2555  # 7 years
    }
    action {
      type = "Delete"
    }
  }

  uniform_bucket_level_access = true
}
```

---

### security

Configures Security Command Center and organization policies.

**Organization Policy Constraints:**
```hcl
resource "google_org_policy_policy" "restrict_public_ip" {
  name   = "projects/${var.project_id}/policies/sql.restrictPublicIp"
  parent = "projects/${var.project_id}"

  spec {
    rules {
      enforce = "TRUE"
    }
  }
}

resource "google_org_policy_policy" "disable_sa_keys" {
  name   = "projects/${var.project_id}/policies/iam.disableServiceAccountKeyCreation"
  parent = "projects/${var.project_id}"

  spec {
    rules {
      enforce = "TRUE"
    }
  }
}
```

---

## Deployment Workflow

### Initial Setup

1. **Create GCP project and enable APIs:**
```bash
gcloud projects create feel-august-platform
gcloud config set project feel-august-platform

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
  iap.googleapis.com
```

2. **Sign BAA** (required for HIPAA compliance):
```bash
# Go to: https://console.cloud.google.com/terms
# Sign the Business Associate Addendum
```

3. **Initialize Terraform:**
```bash
cd terraform/environments/production
terraform init
```

4. **Plan and apply:**
```bash
terraform plan -out=tfplan
terraform apply tfplan
```

### Service Deployment

After infrastructure is provisioned:

1. **Build and push Docker images:**
```bash
gcloud builds submit --tag gcr.io/feel-august-platform/drchrono-sync services/drchrono-sync/
gcloud builds submit --tag gcr.io/feel-august-platform/coda-push services/coda-push/
```

2. **Deploy services:**
```bash
terraform apply -target=module.drchrono_sync
terraform apply -target=module.coda_push
```

3. **Run database migrations:**
```bash
gcloud sql connect feel-august-db --user=postgres
\i database/schema.sql
```

4. **Set secret values:**
```bash
echo -n "YOUR_CLIENT_ID" | gcloud secrets versions add drchrono-client-id --data-file=-
echo -n "YOUR_CLIENT_SECRET" | gcloud secrets versions add drchrono-client-secret --data-file=-
```

---

## Cost Estimation

| Resource | Configuration | Monthly Cost |
|----------|---------------|--------------|
| Cloud SQL | db-custom-2-7680, 50GB SSD | ~$85 |
| Cloud Run (3 services) | min 0-1, max 5-10 | ~$15-40 |
| Pub/Sub | ~1K messages/day | <$1 |
| Cloud Scheduler | 3-4 jobs | <$1 |
| Secret Manager | ~15 secrets | <$1 |
| Cloud Storage (audit) | Growing | <$5 |
| VPC Connector | Serverless | ~$7 |
| **Total** | | **~$115-140/mo** |

Enable HA for Cloud SQL adds ~$85/mo (Phase 4).

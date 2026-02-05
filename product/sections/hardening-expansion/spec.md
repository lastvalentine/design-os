# Hardening & Expansion Specification

## Overview

Infrastructure hardening and feature expansion for production reliability at scale. Implements Cloud SQL high availability, adds billing/claims and lab results sync capabilities, establishes a staging environment for safe testing, and optimizes performance across all services. Coordinates with the website backend team on shared infrastructure patterns. No admin UI—operational visibility is provided through the existing Monitoring & Compliance dashboard.

## Infrastructure Hardening

### Cloud SQL High Availability
- Regional instance with automatic failover
- Cross-zone replication for disaster recovery
- Point-in-time recovery enabled (7-day retention)
- Automated maintenance windows during low-traffic hours
- Connection pooling optimization for Cloud Run burst traffic

### Staging Environment
- Separate GCP project (`feel-august-platform-staging`)
- Isolated VPC with no production connectivity
- Anonymized patient data for testing
- Identical service configuration via Terraform workspaces
- Automated deployment pipeline: staging → production

### Performance Tuning
- Query optimization based on slow query logs
- Index analysis and recommendations
- Connection pool sizing per service
- Pub/Sub batch processing optimization
- Cloud Run concurrency and scaling tuning

## Feature Expansion

### Billing & Claims Sync
- Sync billing transactions from DrChrono
- Track claim status (submitted, pending, paid, denied)
- Reconcile payments against appointments
- Push billing summaries to Coda for staff visibility

### Lab Results Sync
- Sync lab orders and results from DrChrono
- Store structured lab values with reference ranges
- Flag abnormal results for clinical review
- Push lab status updates to Coda

## Shared Infrastructure Coordination

### Website Backend Integration
- Shared VPC peering for database access
- Common IAM policies and service accounts
- Unified logging and monitoring dashboards
- Consistent Terraform module patterns
- Shared secret management approach

## Reliability Targets
- 99.9% uptime for sync services
- < 5 second webhook processing latency (p95)
- < 30 second full sync latency for any single table
- Zero data loss with comprehensive audit trail
- < 15 minute recovery time objective (RTO)

## Configuration

- shell: false

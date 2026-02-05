# Monitoring & Compliance Specification

## Overview

The admin dashboard for Feel August Platform, providing operational visibility into sync health, error management, and manual intervention capabilities. Accessible only to authenticated staff via Google Workspace SSO (Cloud IAP), with role-based permissions controlling who can view vs. take actions.

## User Flows

### Overview Dashboard
- View sync health status for all services (DrChrono, Deep Cura, Coda) with green/yellow/red indicators
- See key metrics: record counts, sync latency, error rates, last successful sync times
- View recent activity feed showing latest sync operations
- Charts showing sync volume and error trends over time
- Auto-refreshes every 30-60 seconds with visual indicator

### Sync Logs
- Browse paginated list of all sync operations
- Filter by source (DrChrono, Deep Cura, Coda), status (success, failed, partial), date range, table name
- Search by record ID (drchrono_id, UUID) to trace a specific record through the pipeline
- Expand log entry to see full details (record counts, duration, error messages)

### Errors
- Toggle between two organization views: by severity/type OR by data source
- View error details including stack traces and affected records
- Take actions on errors:
  - Acknowledge error
  - Retry failed sync
  - Assign to team member
  - Add notes
  - Link to incident
- Separate section for unlinked Deep Cura notes requiring review
- Deep Cura review actions:
  - Manually link to a clinical note
  - Mark as "unlinked acceptable"
- Badge count in navigation showing unresolved error count

### Actions
- Trigger full reconciliation across all tables
- Trigger sync for a specific table (patients, appointments, clinical_notes, etc.)
- View status of currently running sync operations
- Confirmation dialogs before triggering any action
- Actions restricted by role (admin and operator only, not viewer)

### Alerting
- View current alert rules configured in GCP Cloud Monitoring
- See recent alert history (triggered, acknowledged, resolved)
- Links to GCP Console for creating/editing alert configuration

### Runbooks
- Contextual "View Runbook" links appear on errors and alerts
- Links to markdown documentation in the repository:
  - `docs/runbooks/drchrono-sync.md`
  - `docs/runbooks/coda-push.md`
  - `docs/runbooks/deepcura.md`
  - `docs/INCIDENT-RESPONSE.md`

## UI Requirements

- Uses the app shell with sidebar navigation (Overview, Sync Logs, Errors, Actions)
- Design tokens: amber primary, slate neutral, Inter font, JetBrains Mono for technical data
- JetBrains Mono specifically for: record IDs, UUIDs, timestamps, log entries, error traces
- Light and dark mode support using Tailwind `dark:` variants
- Mobile responsive: sidebar collapses to hamburger menu on small screens
- Auto-refresh every 30-60 seconds with visual indicator showing last refresh time
- Manual refresh button available on all views
- Loading states (skeletons or spinners) for all data fetches
- Error states with retry options when data fetches fail
- Role-based UI visibility:
  - `viewer`: can see all data, action buttons hidden
  - `operator`: can see all data, can acknowledge errors and view runbooks
  - `admin`: full access to all actions including sync triggers

## Configuration

- shell: true

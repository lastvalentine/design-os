# Milestone 3: Monitoring & Compliance Section

Implement all dashboard views for the monitoring and compliance section.

---

## 3.1 Copy Components

Copy all components from `sections/monitoring-compliance/components/`:

```
src/
└── components/
    └── monitoring/
        ├── OverviewDashboard.tsx
        ├── ServiceHealthCard.tsx
        ├── MetricCard.tsx
        ├── SyncChart.tsx
        ├── ActivityFeed.tsx
        ├── ErrorSummary.tsx
        ├── RecordCounts.tsx
        ├── SyncLogsView.tsx
        ├── ErrorsView.tsx
        ├── ActionsView.tsx
        └── index.ts
```

## 3.2 Update Imports

Fix type imports to point to your types file:

```typescript
// Before
import type { ServiceHealth } from '@/../product/sections/monitoring-compliance/types'

// After
import type { ServiceHealth } from '@/types/monitoring'
// or
import type { ServiceHealth } from '../../types/monitoring'
```

## 3.3 Overview Dashboard

The Overview Dashboard (`OverviewDashboard.tsx`) displays:

- **Header** with title, last updated time, and refresh button
- **Service Health Cards** (3 cards for DrChrono, Deep Cura, Coda)
- **Key Metrics** (success rate, latency, records synced, open errors)
- **Sync Activity Chart** (7-day bar chart)
- **Error Summary** (errors by type)
- **Record Counts** (database totals)
- **Activity Feed** (recent sync operations)

**Create a page wrapper:**

```typescript
// src/pages/OverviewPage.tsx
import { OverviewDashboard } from '@/components/monitoring'
import { useMonitoringData } from '@/hooks/useMonitoringData'

export function OverviewPage() {
  const { data, isLoading, refetch } = useMonitoringData()

  if (isLoading) return <LoadingSkeleton />

  return (
    <OverviewDashboard
      serviceHealth={data.serviceHealth}
      syncMetrics={data.syncMetrics}
      recentSyncLogs={data.syncLogs.slice(0, 10)}
      unresolvedErrorCount={data.unresolvedErrorCount}
      syncErrors={data.syncErrors}
      onRefresh={refetch}
      onViewService={(id) => console.log('View service:', id)}
      onViewSyncLog={(id) => navigate(`/sync-logs/${id}`)}
      onViewErrors={() => navigate('/errors')}
    />
  )
}
```

## 3.4 Sync Logs View

The Sync Logs View (`SyncLogsView.tsx`) provides:

- **Search** by record ID or UUID
- **Filters** for source, status, and table name
- **Table** with expandable rows
- **Pagination** (20 items per page)
- **Expanded details** showing:
  - Record counts (total, created, updated, failed)
  - Trigger type and operation
  - Error/warning messages
  - DrChrono ID (if applicable)

**Create a page wrapper:**

```typescript
// src/pages/SyncLogsPage.tsx
import { SyncLogsView } from '@/components/monitoring'

export function SyncLogsPage() {
  const { data, refetch } = useMonitoringData()

  return (
    <SyncLogsView
      syncLogs={data.syncLogs}
      onViewSyncLog={(id) => console.log('View log:', id)}
      onSearchSyncLogs={(query) => console.log('Search:', query)}
      onFilterSyncLogs={(filters) => console.log('Filter:', filters)}
      onRefresh={refetch}
    />
  )
}
```

## 3.5 Errors View

The Errors View (`ErrorsView.tsx`) includes:

- **View toggle** (by severity or by source)
- **Summary cards** (critical, high, medium, low counts)
- **Error cards** with:
  - Severity and status badges
  - Error message and timestamp
  - Expandable stack trace
  - Action buttons (acknowledge, retry, assign, add note)
  - Runbook link
- **Unlinked Deep Cura Notes table** with link/dismiss actions

**Create a page wrapper:**

```typescript
// src/pages/ErrorsPage.tsx
import { ErrorsView } from '@/components/monitoring'

export function ErrorsPage() {
  const { data, currentUser } = useMonitoringData()

  return (
    <ErrorsView
      syncErrors={data.syncErrors}
      unlinkedDeepCuraNotes={data.unlinkedDeepCuraNotes}
      currentUser={currentUser}
      onAcknowledgeError={(id) => api.acknowledgeError(id)}
      onRetryError={(id) => api.retryError(id)}
      onAssignError={(id, assignee) => api.assignError(id, assignee)}
      onAddErrorNote={(id, note) => api.addErrorNote(id, note)}
      onResolveError={(id) => api.resolveError(id)}
      onLinkDeepCuraNote={(dcId, cnId) => api.linkNote(dcId, cnId)}
      onDismissDeepCuraNote={(id, reason) => api.dismissNote(id, reason)}
    />
  )
}
```

## 3.6 Actions View

The Actions View (`ActionsView.tsx`) displays:

- **Running operations** (if any) with progress
- **Action cards** with:
  - Icon and description
  - Estimated duration
  - Required role indicator
  - Trigger button (disabled based on role)
- **Confirmation modal** before triggering
- **Recent actions history table**

**Create a page wrapper:**

```typescript
// src/pages/ActionsPage.tsx
import { ActionsView } from '@/components/monitoring'

export function ActionsPage() {
  const { data, currentUser } = useMonitoringData()

  return (
    <ActionsView
      syncActions={data.syncActions}
      runningSyncOperations={data.runningSyncOperations}
      currentUser={currentUser}
      onTriggerSyncAction={(actionId) => api.triggerAction(actionId)}
    />
  )
}
```

## 3.7 Data Hook

Create a custom hook to manage monitoring data:

```typescript
// src/hooks/useMonitoringData.ts
import { useState, useEffect, useCallback } from 'react'
import sampleData from '@/data/sample-data.json'

export function useMonitoringData() {
  const [data, setData] = useState(sampleData)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => setIsLoading(false), 500)
  }, [])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    // await api.fetchMonitoringData()
    setTimeout(() => setIsLoading(false), 500)
  }, [])

  const unresolvedErrorCount = data.syncErrors
    .filter(e => e.status !== 'resolved').length

  return {
    data,
    isLoading,
    refetch,
    unresolvedErrorCount,
    currentUser: data.currentUser,
  }
}
```

## 3.8 Auto-Refresh

Add auto-refresh to keep data current:

```typescript
// In your data hook or page component
useEffect(() => {
  const interval = setInterval(() => {
    refetch()
  }, 30000) // 30 seconds

  return () => clearInterval(interval)
}, [refetch])
```

## 3.9 Role-Based UI

Components already handle role-based visibility. Ensure `currentUser.role` is correctly passed:

- `viewer`: Read-only, no action buttons
- `operator`: Can acknowledge errors, retry syncs
- `admin`: Full access including sync triggers

---

## Completion Checklist

- [ ] All monitoring components copied and imports fixed
- [ ] Overview Dashboard renders with all sections
- [ ] Service health cards show correct status colors
- [ ] Sync chart displays 7-day data
- [ ] Sync Logs view filters work
- [ ] Sync log rows expand with details
- [ ] Errors view toggle between severity/source works
- [ ] Error cards expand with stack trace
- [ ] Unlinked notes table displays
- [ ] Actions view shows available actions
- [ ] Confirmation modal appears before triggering
- [ ] Role-based buttons are visible/hidden correctly
- [ ] Auto-refresh updates data periodically

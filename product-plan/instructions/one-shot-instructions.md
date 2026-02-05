# One-Shot Implementation Instructions

This document contains all implementation instructions for building the Feel August Platform admin dashboard in a single session.

---

## Overview

Build a monitoring and compliance admin dashboard for a telehealth psychiatry platform. The dashboard provides:
- Real-time sync health monitoring for DrChrono, Deep Cura, and Coda integrations
- Error management with severity-based triage
- Manual sync action triggers
- Unlinked Deep Cura note review

---

## Milestone 1: Foundation

### 1.1 Project Setup

Create a new React + TypeScript project with Tailwind CSS v4. Install dependencies:

```bash
# Core dependencies
npm install react react-dom typescript
npm install -D @types/react @types/react-dom

# Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Icons
npm install lucide-react

# Fonts (add to HTML or use @fontsource)
# Inter, JetBrains Mono from Google Fonts
```

### 1.2 Configure Tailwind

In your CSS entry point:

```css
@import "tailwindcss";

/* Import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

### 1.3 Copy Types

Copy `sections/monitoring-compliance/types.ts` to your project's types folder. These TypeScript interfaces define all data structures for the dashboard.

### 1.4 Copy Sample Data

Copy `sections/monitoring-compliance/data.json` for development. Use this to test components before connecting to real APIs.

---

## Milestone 2: Application Shell

### 2.1 Shell Components

Copy these components from `shell/components/`:
- `AppShell.tsx` - Main layout with sidebar
- `MainNav.tsx` - Navigation items
- `UserMenu.tsx` - User avatar and logout
- `index.ts` - Exports

### 2.2 Shell Features

The shell provides:
- **Fixed left sidebar** (240px on desktop)
- **Collapsible sidebar** with toggle button
- **Mobile hamburger menu** with slide-out overlay
- **Sync status indicator** (green/yellow/red dot)
- **Navigation items** with active state styling
- **Error badge** on Errors nav item

### 2.3 Navigation Structure

```typescript
const navigationItems = [
  { label: 'Overview', href: '/overview', icon: <LayoutDashboard />, isActive: true },
  { label: 'Sync Logs', href: '/sync-logs', icon: <ScrollText /> },
  { label: 'Errors', href: '/errors', icon: <AlertTriangle />, badge: errorCount },
  { label: 'Actions', href: '/actions', icon: <Play /> },
]
```

### 2.4 Routing Setup

Set up routes for each view:
- `/` or `/overview` → Overview Dashboard
- `/sync-logs` → Sync Logs View
- `/errors` → Errors View
- `/actions` → Actions View

---

## Milestone 3: Monitoring & Compliance Section

### 3.1 Overview Dashboard

Copy `sections/monitoring-compliance/components/OverviewDashboard.tsx` and its sub-components:
- `ServiceHealthCard.tsx` - Health status for each service
- `MetricCard.tsx` - Key metrics display
- `SyncChart.tsx` - 7-day sync activity chart
- `ActivityFeed.tsx` - Recent sync operations
- `ErrorSummary.tsx` - Error count by type
- `RecordCounts.tsx` - Database record totals

**Features:**
- Service health cards with status indicators
- Key metrics (success rate, latency, records synced, open errors)
- 7-day sync activity chart
- Recent activity feed
- Error summary with navigation to errors view

### 3.2 Sync Logs View

Copy `sections/monitoring-compliance/components/SyncLogsView.tsx`.

**Features:**
- Filterable table with search by record ID
- Filter dropdowns: source, status, table name
- Expandable rows for full log details
- Pagination (20 logs per page)
- Error/warning messages in expanded view

### 3.3 Errors View

Copy `sections/monitoring-compliance/components/ErrorsView.tsx`.

**Features:**
- Toggle between severity and source views
- Summary cards (critical, high, medium, low counts)
- Expandable error cards with:
  - Stack trace display
  - Action buttons (acknowledge, retry, assign, add note)
  - Runbook links
- Unlinked Deep Cura notes table with link/dismiss actions

### 3.4 Actions View

Copy `sections/monitoring-compliance/components/ActionsView.tsx`.

**Features:**
- Currently running operations (if any)
- Action cards with:
  - Icon, name, description
  - Estimated duration
  - Required role badge
  - Trigger button
- Confirmation modal before triggering
- Recent actions history table

---

## Milestone 4: Integration

### 4.1 Auto-Refresh

Implement auto-refresh every 30-60 seconds:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refetchData()
  }, 30000) // 30 seconds

  return () => clearInterval(interval)
}, [])
```

Display last refresh time in the header.

### 4.2 Role-Based UI

Based on `currentUser.role`:
- `viewer`: Hide action buttons, show read-only views
- `operator`: Show acknowledge/retry buttons, hide admin-only actions
- `admin`: Full access to all actions

```typescript
const canTakeAction = currentUser.role === 'admin' || currentUser.role === 'operator'
const canTriggerFullSync = currentUser.role === 'admin'
```

### 4.3 API Integration

Connect components to your backend API. Each view expects callbacks:

**Overview Dashboard:**
- `onRefresh()` - Refresh all data
- `onViewService(id)` - Navigate to service details
- `onViewSyncLog(id)` - Navigate to log details
- `onViewErrors()` - Navigate to errors view

**Sync Logs View:**
- `onViewSyncLog(id)` - View log details
- `onSearchSyncLogs(query)` - Search by record ID
- `onFilterSyncLogs(filters)` - Apply filters
- `onRefresh()` - Refresh logs

**Errors View:**
- `onAcknowledgeError(id)` - Mark error acknowledged
- `onRetryError(id)` - Retry failed sync
- `onAssignError(id, assignee)` - Assign to team member
- `onAddErrorNote(id, note)` - Add note
- `onResolveError(id)` - Mark resolved
- `onLinkDeepCuraNote(deepCuraNoteId, clinicalNoteId)` - Link notes
- `onDismissDeepCuraNote(id, reason)` - Dismiss unlinked note

**Actions View:**
- `onTriggerSyncAction(actionId)` - Trigger sync action

### 4.4 Error States

Add loading and error states:

```typescript
if (isLoading) {
  return <LoadingSkeleton />
}

if (error) {
  return (
    <ErrorState
      message="Failed to load data"
      onRetry={refetch}
    />
  )
}
```

---

## Design Reference

### Colors

| Purpose | Light Mode | Dark Mode |
|---------|------------|-----------|
| Primary | `amber-500` | `amber-400` |
| Background | `slate-50` | `slate-950` |
| Card | `white` | `slate-900` |
| Border | `slate-200` | `slate-800` |
| Text primary | `slate-900` | `slate-100` |
| Text secondary | `slate-500` | `slate-400` |

### Status Colors

| Status | Color |
|--------|-------|
| Healthy | `emerald-500` |
| Warning | `amber-500` |
| Error | `red-500` |
| Running | `blue-500` |

### Typography

- **Headings**: Inter, font-semibold or font-bold
- **Body**: Inter, font-normal
- **Code/Timestamps**: JetBrains Mono (`font-mono`)

---

## File Structure

```
src/
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   ├── MainNav.tsx
│   │   ├── UserMenu.tsx
│   │   └── index.ts
│   └── monitoring/
│       ├── OverviewDashboard.tsx
│       ├── ServiceHealthCard.tsx
│       ├── MetricCard.tsx
│       ├── SyncChart.tsx
│       ├── ActivityFeed.tsx
│       ├── ErrorSummary.tsx
│       ├── RecordCounts.tsx
│       ├── SyncLogsView.tsx
│       ├── ErrorsView.tsx
│       ├── ActionsView.tsx
│       └── index.ts
├── types/
│   └── monitoring.ts
├── hooks/
│   ├── useMonitoringData.ts
│   └── useAutoRefresh.ts
├── pages/
│   ├── OverviewPage.tsx
│   ├── SyncLogsPage.tsx
│   ├── ErrorsPage.tsx
│   └── ActionsPage.tsx
└── App.tsx
```

---

## Testing Checklist

After implementation, verify:

- [ ] Shell sidebar collapses on mobile
- [ ] Navigation highlights active page
- [ ] Error badge shows on Errors nav item
- [ ] Service health cards show correct status colors
- [ ] Sync chart displays 7 days of data
- [ ] Sync logs filter correctly by source/status/table
- [ ] Sync log rows expand to show details
- [ ] Error cards expand with stack trace
- [ ] Confirmation modal appears before triggering actions
- [ ] Role-based buttons are hidden for viewers
- [ ] Dark mode toggles all components correctly
- [ ] Auto-refresh updates data every 30 seconds

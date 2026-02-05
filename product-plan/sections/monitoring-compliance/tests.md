# Monitoring & Compliance - Test Plan

## Overview Dashboard Tests

### Service Health Cards
- [ ] Card displays correct status color (green for healthy, amber for warning, red for error)
- [ ] Card shows service name and status label
- [ ] Card shows last sync time in human-readable format ("2m ago", "1h ago")
- [ ] Card shows records synced in last 24 hours
- [ ] Card shows last sync duration
- [ ] Warning message appears when `warningMessage` is present
- [ ] Error count appears when `errorCountLast24h > 0`
- [ ] Cards are clickable and trigger `onViewService` callback

### Key Metrics
- [ ] Success rate calculates correctly from `successfulSyncs / totalSyncs`
- [ ] Success rate shows correct trend indicator (up = green, down = red)
- [ ] Latency displays in seconds with one decimal
- [ ] Records synced shows combined created + updated count
- [ ] Open errors count matches actual unresolved errors
- [ ] Error count shows "Needs attention" trend when > 0

### Sync Activity Chart
- [ ] Chart renders 7 bars (one per day)
- [ ] Successful syncs shown in amber
- [ ] Failed syncs shown in red (stacked on top)
- [ ] Day labels display (Mon, Tue, etc.)
- [ ] Legend shows "Successful" and "Failed" with correct colors

### Error Summary
- [ ] Shows "No open errors" when all errors resolved
- [ ] Shows critical and high counts when present
- [ ] Shows errors by type breakdown
- [ ] "View all errors" button triggers navigation

### Activity Feed
- [ ] Shows most recent 8 sync operations
- [ ] Each row shows source icon, table name, status badge
- [ ] Timestamp and duration display in monospace font
- [ ] Status badge has correct color per status
- [ ] Rows are clickable
- [ ] "View all X logs" link appears when more than 8 logs

### Record Counts
- [ ] All 8 record types display
- [ ] Counts formatted with commas (e.g., "2,847")
- [ ] Icons match record types
- [ ] Grid layout adapts to screen size

---

## Sync Logs View Tests

### Filtering
- [ ] Search input accepts text and triggers `onSearchSyncLogs`
- [ ] Source dropdown filters by drchrono/deepcura/coda
- [ ] Status dropdown filters by completed/failed/partial/running
- [ ] Table dropdown filters by table name
- [ ] Clear button resets all filters
- [ ] Filters work in combination

### Table Display
- [ ] Columns: Timestamp, Source, Table, Records, Status, Duration
- [ ] Timestamp in "Feb 4, 14:32" format with monospace font
- [ ] Source shows icon and name
- [ ] Status badge has correct color
- [ ] Rows are clickable to expand

### Expandable Rows
- [ ] Chevron rotates when expanded
- [ ] Shows record breakdown (total, created, updated, failed)
- [ ] Shows trigger type (webhook, scheduler, pubsub, manual)
- [ ] Shows operation type (webhook, gridhook, full_sync, push)
- [ ] Error message displays in red box when present
- [ ] Warning message displays in amber box when present
- [ ] DrChrono ID displays when present
- [ ] "View Full Details" link triggers callback

### Pagination
- [ ] Shows "Showing X-Y of Z logs"
- [ ] Previous/Next buttons work
- [ ] Previous disabled on first page
- [ ] Next disabled on last page
- [ ] 20 items per page

---

## Errors View Tests

### View Toggle
- [ ] "By Severity" is default active view
- [ ] Toggle switches between severity and source views
- [ ] Active toggle has highlighted background

### Summary Cards
- [ ] Four cards: Critical, High, Medium, Low
- [ ] Each shows correct count of unresolved errors
- [ ] Counts exclude resolved errors
- [ ] Color dots match severity

### Error Cards
- [ ] Severity badge shows CRITICAL/HIGH/MEDIUM/LOW
- [ ] Status badge shows Open/Acknowledged/Resolved
- [ ] Source badge shows DrChrono/Deep Cura/Coda
- [ ] Error message truncates on single line
- [ ] Timestamp and table name display
- [ ] Affected record ID displays when present
- [ ] Cards are expandable

### Expanded Error Details
- [ ] Error code displays
- [ ] Stack trace renders in monospace
- [ ] Notes section shows existing notes
- [ ] Action buttons appear for operator/admin roles
- [ ] Action buttons hidden for viewer role
- [ ] "Acknowledge" appears for open errors only
- [ ] "Retry Sync" button works
- [ ] "Assign" button works
- [ ] "Add Note" button works
- [ ] Runbook link opens in new tab

### Severity View
- [ ] Critical errors appear first
- [ ] High errors appear second
- [ ] Medium errors appear third
- [ ] Low errors appear last

### Source View
- [ ] Groups by DrChrono, Deep Cura, Coda
- [ ] Section headers show source name
- [ ] Empty sections don't display

### Empty State
- [ ] Shows checkmark icon when no unresolved errors
- [ ] Message: "No unresolved errors" / "All sync operations are running smoothly"

### Unlinked Deep Cura Notes Table
- [ ] Table shows pending_review notes only
- [ ] Columns: Received, Patient, Note Preview, Provider, Actions
- [ ] Patient shows name and DrChrono ID
- [ ] Note preview truncates to 2 lines
- [ ] Link button triggers `onLinkDeepCuraNote`
- [ ] Dismiss button triggers `onDismissDeepCuraNote`
- [ ] Empty state when no pending notes

---

## Actions View Tests

### Running Operations
- [ ] Section hidden when no running operations
- [ ] Shows operation name and who started it
- [ ] Shows "Just started" or time ago
- [ ] Progress bar renders when progress provided
- [ ] Spinner animation on icon

### Action Cards
- [ ] Each action shows icon, name, description
- [ ] Estimated duration displays
- [ ] Required role badge displays
- [ ] Trigger button enabled for authorized users
- [ ] Trigger button disabled for viewers
- [ ] Trigger button disabled when action is running

### Role-Based Access
- [ ] Admin sees all trigger buttons enabled
- [ ] Operator sees non-admin actions enabled
- [ ] Viewer sees all trigger buttons disabled

### Confirmation Modal
- [ ] Modal appears on trigger click
- [ ] Shows action name in title
- [ ] Shows confirmation message
- [ ] Cancel closes modal without action
- [ ] Confirm triggers `onTriggerSyncAction`
- [ ] Modal closes after confirm

### Recent Actions Table
- [ ] Shows past manual actions
- [ ] Columns: Time, Action, Triggered By, Status, Duration
- [ ] Status badge shows Completed/Failed with correct color
- [ ] Email shows in monospace font
- [ ] Duration shows in monospace font

---

## Shell & Navigation Tests

### Sidebar
- [ ] Shows "Feel August" branding with status dot
- [ ] Status dot is green/amber/red based on sync status
- [ ] Navigation items display with icons
- [ ] Active item has amber highlight and left border
- [ ] Errors item shows badge when errorCount > 0
- [ ] Badge shows "99+" when count exceeds 99
- [ ] Collapse button minimizes sidebar to icons only
- [ ] Collapsed sidebar shows tooltip on hover

### User Menu
- [ ] Shows user initials when no avatar
- [ ] Shows user name and role
- [ ] Logout button visible
- [ ] Collapsed sidebar shows avatar only

### Mobile Responsive
- [ ] Hamburger menu appears on mobile
- [ ] Sidebar slides in from left
- [ ] Overlay appears behind sidebar
- [ ] Clicking overlay closes sidebar
- [ ] X button closes sidebar

### Dark Mode
- [ ] All components support dark mode
- [ ] Backgrounds switch to slate-900/950
- [ ] Text switches to light colors
- [ ] Status colors remain visible
- [ ] Charts remain readable

---

## Auto-Refresh Tests

- [ ] Data refreshes every 30 seconds automatically
- [ ] "Last updated" timestamp updates
- [ ] Manual refresh button triggers immediate refresh
- [ ] Refresh shows loading state briefly
- [ ] Refresh preserves current filter/page state

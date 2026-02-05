// =============================================================================
// Service Health
// =============================================================================

export type ServiceStatus = 'healthy' | 'warning' | 'error'

export interface ServiceHealth {
  id: string
  name: string
  status: ServiceStatus
  lastSyncAt: string
  lastSyncDurationMs: number
  recordsSyncedLast24h: number
  errorCountLast24h: number
  webhooksReceivedLast24h: number | null
  warningMessage?: string
}

// =============================================================================
// Sync Metrics
// =============================================================================

export interface RecordCounts {
  patients: number
  appointments: number
  clinicalNotes: number
  deepCuraNotes: number
  medications: number
  problems: number
  allergies: number
  insuranceRecords: number
}

export interface Last24HoursMetrics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  averageLatencyMs: number
  recordsCreated: number
  recordsUpdated: number
  webhooksReceived: number
  codaPushes: number
}

export interface DailySyncStat {
  date: string
  successful: number
  failed: number
}

export interface ErrorTypeStat {
  type: string
  count: number
}

export interface Last7DaysMetrics {
  syncsByDay: DailySyncStat[]
  errorsByType: ErrorTypeStat[]
}

export interface SyncMetrics {
  totalRecordsInDb: RecordCounts
  last24Hours: Last24HoursMetrics
  last7Days: Last7DaysMetrics
}

// =============================================================================
// Sync Logs
// =============================================================================

export type SyncSource = 'drchrono' | 'deepcura' | 'coda'
export type SyncOperation = 'webhook' | 'gridhook' | 'full_sync' | 'push'
export type SyncStatus = 'completed' | 'failed' | 'partial' | 'running'
export type SyncTrigger = 'webhook' | 'scheduler' | 'pubsub' | 'manual'

export interface SyncLog {
  id: string
  source: SyncSource
  operation: SyncOperation
  tableName: string
  status: SyncStatus
  recordsTotal: number
  recordsCreated: number
  recordsUpdated: number
  recordsFailed: number
  startedAt: string
  completedAt: string | null
  durationMs: number
  triggeredBy: SyncTrigger
  drchronoId?: number
  linkedToClinicalNote?: boolean
  clinicalNoteId?: string
  warningMessage?: string
  errorMessage?: string
  errorCode?: string
}

// =============================================================================
// Sync Errors
// =============================================================================

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low'
export type ErrorType = 'rate_limit' | 'timeout' | 'auth_expired' | 'decryption_failed' | 'linking_failed' | 'unknown'
export type ErrorStatus = 'open' | 'acknowledged' | 'resolved'

export interface ErrorNote {
  id: string
  author: string
  content: string
  createdAt: string
}

export interface SyncError {
  id: string
  syncLogId: string | null
  source: SyncSource
  severity: ErrorSeverity
  type: ErrorType
  tableName: string | null
  message: string
  errorCode: string
  affectedRecordId: string | null
  affectedRecordType: string | null
  stackTrace: string | null
  occurredAt: string
  status: ErrorStatus
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  assignedTo: string | null
  resolvedAt?: string
  resolvedBy?: string
  notes: ErrorNote[]
  retryCount: number
  lastRetryAt: string | null
  runbookUrl: string
}

// =============================================================================
// Unlinked Deep Cura Notes
// =============================================================================

export interface ICD10Code {
  code: string
  description: string
}

export interface CPTCode {
  code: string
  description: string
}

export interface SuggestedClinicalNote {
  id: string
  drchronoId: number
  appointmentDate: string
  appointmentTime: string
  matchConfidence: number
  matchReason: string
}

export type UnlinkedNoteStatus = 'pending_review' | 'linked' | 'dismissed'

export interface UnlinkedDeepCuraNote {
  id: string
  sessionDate: string
  patientName: string
  patientDrchronoId: number
  providerName: string
  soapSubjective: string
  icd10Codes: ICD10Code[]
  cptCodes: CPTCode[]
  receivedAt: string
  status: UnlinkedNoteStatus
  suggestedClinicalNotes: SuggestedClinicalNote[]
  reviewNotes: string | null
}

// =============================================================================
// Alert Rules & Events
// =============================================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertEventStatus = 'triggered' | 'acknowledged' | 'resolved'

export interface AlertRule {
  id: string
  name: string
  description: string
  condition: string
  threshold: string
  window: string | null
  severity: AlertSeverity
  enabled: boolean
  notificationChannels: string[]
  gcpConsoleUrl: string
}

export interface AlertEvent {
  id: string
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  status: AlertEventStatus
  triggeredAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
  summary: string
  details: string
}

// =============================================================================
// Sync Actions
// =============================================================================

export type StaffRoleType = 'admin' | 'operator' | 'viewer'

export interface SyncAction {
  id: string
  name: string
  description: string
  endpoint: string
  method: 'POST' | 'GET'
  requiredRole: StaffRoleType
  estimatedDuration: string
  confirmationMessage: string
}

export interface RunningSyncOperation {
  id: string
  actionId: string
  actionName: string
  startedAt: string
  startedBy: string
  progress?: number
  status: 'running' | 'completed' | 'failed'
}

// =============================================================================
// Staff & Auth
// =============================================================================

export interface StaffRole {
  email: string
  name: string
  role: StaffRoleType
  createdAt: string
}

export interface CurrentUser {
  email: string
  name: string
  role: StaffRoleType
}

// =============================================================================
// Component Props
// =============================================================================

export interface MonitoringDashboardProps {
  /** Current health status of all services */
  serviceHealth: ServiceHealth[]
  /** Aggregated sync metrics for overview */
  syncMetrics: SyncMetrics
  /** Recent sync log entries */
  syncLogs: SyncLog[]
  /** Errors requiring attention */
  syncErrors: SyncError[]
  /** Deep Cura notes pending review */
  unlinkedDeepCuraNotes: UnlinkedDeepCuraNote[]
  /** Configured alert rules */
  alertRules: AlertRule[]
  /** Recent alert events */
  alertEvents: AlertEvent[]
  /** Available manual sync actions */
  syncActions: SyncAction[]
  /** Currently running sync operations */
  runningSyncOperations: RunningSyncOperation[]
  /** Staff members with dashboard access */
  staffRoles: StaffRole[]
  /** Currently logged in user */
  currentUser: CurrentUser
  /** Last time data was refreshed */
  lastRefreshedAt?: string

  // Sync Log callbacks
  /** Called when user wants to view full details of a sync log entry */
  onViewSyncLog?: (id: string) => void
  /** Called when user searches sync logs by record ID */
  onSearchSyncLogs?: (query: string) => void
  /** Called when user filters sync logs */
  onFilterSyncLogs?: (filters: SyncLogFilters) => void

  // Error callbacks
  /** Called when user acknowledges an error */
  onAcknowledgeError?: (id: string) => void
  /** Called when user retries a failed sync */
  onRetryError?: (id: string) => void
  /** Called when user assigns an error to a team member */
  onAssignError?: (id: string, assignee: string) => void
  /** Called when user adds a note to an error */
  onAddErrorNote?: (id: string, note: string) => void
  /** Called when user resolves an error */
  onResolveError?: (id: string) => void

  // Deep Cura review callbacks
  /** Called when user manually links a Deep Cura note to a clinical note */
  onLinkDeepCuraNote?: (deepCuraNoteId: string, clinicalNoteId: string) => void
  /** Called when user dismisses an unlinked note as acceptable */
  onDismissDeepCuraNote?: (id: string, reason: string) => void

  // Sync action callbacks
  /** Called when user triggers a manual sync action */
  onTriggerSyncAction?: (actionId: string) => void

  // Refresh callback
  /** Called when user manually refreshes data */
  onRefresh?: () => void
}

export interface SyncLogFilters {
  source?: SyncSource
  status?: SyncStatus
  tableName?: string
  dateFrom?: string
  dateTo?: string
}

// =============================================================================
// View-specific Props
// =============================================================================

export interface OverviewViewProps {
  serviceHealth: ServiceHealth[]
  syncMetrics: SyncMetrics
  recentSyncLogs: SyncLog[]
  unresolvedErrorCount: number
  onRefresh?: () => void
}

export interface SyncLogsViewProps {
  syncLogs: SyncLog[]
  onViewSyncLog?: (id: string) => void
  onSearchSyncLogs?: (query: string) => void
  onFilterSyncLogs?: (filters: SyncLogFilters) => void
}

export interface ErrorsViewProps {
  syncErrors: SyncError[]
  unlinkedDeepCuraNotes: UnlinkedDeepCuraNote[]
  currentUser: CurrentUser
  onAcknowledgeError?: (id: string) => void
  onRetryError?: (id: string) => void
  onAssignError?: (id: string, assignee: string) => void
  onAddErrorNote?: (id: string, note: string) => void
  onResolveError?: (id: string) => void
  onLinkDeepCuraNote?: (deepCuraNoteId: string, clinicalNoteId: string) => void
  onDismissDeepCuraNote?: (id: string, reason: string) => void
}

export interface ActionsViewProps {
  syncActions: SyncAction[]
  runningSyncOperations: RunningSyncOperation[]
  currentUser: CurrentUser
  onTriggerSyncAction?: (actionId: string) => void
}

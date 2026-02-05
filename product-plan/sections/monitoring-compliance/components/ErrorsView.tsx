import { useState } from 'react'
import type {
  ErrorsViewProps,
  SyncError,
  UnlinkedDeepCuraNote,
  ErrorSeverity,
  ErrorStatus,
  SyncSource
} from '../types'

type ViewMode = 'severity' | 'source'

function getSeverityColor(severity: ErrorSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-l-red-500 bg-red-50 dark:bg-red-900/10'
    case 'high':
      return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10'
    case 'medium':
      return 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10'
    case 'low':
      return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10'
  }
}

function getSeverityBadgeColor(severity: ErrorSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
    case 'medium':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'low':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  }
}

function getStatusBadgeColor(status: ErrorStatus): string {
  switch (status) {
    case 'open':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'acknowledged':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'resolved':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

function getSourceLabel(source: SyncSource): string {
  switch (source) {
    case 'drchrono': return 'DrChrono'
    case 'deepcura': return 'Deep Cura'
    case 'coda': return 'Coda'
  }
}

function ErrorCard({
  error,
  isExpanded,
  onToggle,
  currentUserRole,
  onAcknowledge,
  onRetry,
  onAssign,
  onAddNote,
  onResolve: _onResolve
}: {
  error: SyncError
  isExpanded: boolean
  onToggle: () => void
  currentUserRole: string
  onAcknowledge?: (id: string) => void
  onRetry?: (id: string) => void
  onAssign?: (id: string, assignee: string) => void
  onAddNote?: (id: string, note: string) => void
  onResolve?: (id: string) => void
}) {
  const canTakeAction = currentUserRole === 'admin' || currentUserRole === 'operator'

  return (
    <div className={`rounded-xl border-l-4 border border-slate-200 dark:border-slate-800 ${getSeverityColor(error.severity)} overflow-hidden`}>
      <div
        className="p-4 cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityBadgeColor(error.severity)}`}>
                {error.severity.toUpperCase()}
              </span>
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(error.status)}`}>
                {error.status.charAt(0).toUpperCase() + error.status.slice(1)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                {getSourceLabel(error.source)}
              </span>
            </div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">
              {error.message}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono">{formatTimestamp(error.occurredAt)}</span>
              {error.tableName && (
                <span className="font-mono">{error.tableName}</span>
              )}
              {error.affectedRecordId && (
                <span className="font-mono text-xs">ID: {error.affectedRecordId}</span>
              )}
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0">
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Error Details */}
          <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 overflow-x-auto">
            <div className="text-xs text-slate-400 mb-2">Error Code: <span className="font-mono text-slate-300">{error.errorCode}</span></div>
            {error.stackTrace && (
              <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
                {error.stackTrace}
              </pre>
            )}
          </div>

          {/* Affected Records */}
          {error.affectedRecordId && (
            <div className="text-sm">
              <span className="text-slate-500 dark:text-slate-400">Affected Record: </span>
              <span className="font-mono text-slate-900 dark:text-slate-100">{error.affectedRecordId}</span>
              {error.affectedRecordType && (
                <span className="text-slate-500 dark:text-slate-400"> ({error.affectedRecordType})</span>
              )}
            </div>
          )}

          {/* Notes */}
          {error.notes.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</div>
              {error.notes.map((note) => (
                <div key={note.id} className="bg-white dark:bg-slate-800 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                    <span>{note.author}</span>
                    <span>•</span>
                    <span className="font-mono text-xs">{formatTimestamp(note.createdAt)}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{note.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {canTakeAction && error.status !== 'resolved' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              {error.status === 'open' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAcknowledge?.(error.id) }}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Acknowledge
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onRetry?.(error.id) }}
                className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                Retry Sync
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAssign?.(error.id, '') }}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Assign
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAddNote?.(error.id, '') }}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                Add Note
              </button>
              <a
                href={error.runbookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View Runbook →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UnlinkedNoteRow({
  note,
  onLink,
  onDismiss
}: {
  note: UnlinkedDeepCuraNote
  onLink?: (deepCuraNoteId: string, clinicalNoteId: string) => void
  onDismiss?: (id: string, reason: string) => void
}) {
  return (
    <tr className="border-b border-slate-200 dark:border-slate-800">
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
          {formatTimestamp(note.receivedAt)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-slate-900 dark:text-slate-100">{note.patientName}</div>
        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">ID: {note.patientDrchronoId}</div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
          {note.soapSubjective}
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">{note.providerName}</div>
        <div className="font-mono text-xs text-slate-500">{formatTimestamp(note.sessionDate)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => onLink?.(note.id, '')}
            className="px-3 py-1 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
          >
            Link
          </button>
          <button
            onClick={() => onDismiss?.(note.id, '')}
            className="px-3 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </td>
    </tr>
  )
}

export function ErrorsView({
  syncErrors,
  unlinkedDeepCuraNotes,
  currentUser,
  onAcknowledgeError,
  onRetryError,
  onAssignError,
  onAddErrorNote,
  onResolveError,
  onLinkDeepCuraNote,
  onDismissDeepCuraNote
}: ErrorsViewProps & { onRefresh?: () => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>('severity')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const criticalCount = syncErrors.filter(e => e.severity === 'critical' && e.status !== 'resolved').length
  const highCount = syncErrors.filter(e => e.severity === 'high' && e.status !== 'resolved').length
  const mediumCount = syncErrors.filter(e => e.severity === 'medium' && e.status !== 'resolved').length
  const lowCount = syncErrors.filter(e => e.severity === 'low' && e.status !== 'resolved').length

  const unresolvedErrors = syncErrors.filter(e => e.status !== 'resolved')

  const groupedBySeverity = {
    critical: unresolvedErrors.filter(e => e.severity === 'critical'),
    high: unresolvedErrors.filter(e => e.severity === 'high'),
    medium: unresolvedErrors.filter(e => e.severity === 'medium'),
    low: unresolvedErrors.filter(e => e.severity === 'low'),
  }

  const groupedBySource = {
    drchrono: unresolvedErrors.filter(e => e.source === 'drchrono'),
    deepcura: unresolvedErrors.filter(e => e.source === 'deepcura'),
    coda: unresolvedErrors.filter(e => e.source === 'coda'),
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Errors
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage sync errors and unlinked Deep Cura notes
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('severity')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'severity'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                By Severity
              </button>
              <button
                onClick={() => setViewMode('source')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'source'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                By Source
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <section className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm text-slate-500 dark:text-slate-400">Critical</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{criticalCount}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm text-slate-500 dark:text-slate-400">High</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{highCount}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-sm text-slate-500 dark:text-slate-400">Medium</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{mediumCount}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-slate-500 dark:text-slate-400">Low</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{lowCount}</div>
            </div>
          </div>
        </section>

        {/* Error List */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            {viewMode === 'severity' ? 'Errors by Severity' : 'Errors by Source'}
          </h2>
          <div className="space-y-4">
            {viewMode === 'severity' ? (
              <>
                {groupedBySeverity.critical.map(error => (
                  <ErrorCard
                    key={error.id}
                    error={error}
                    isExpanded={expandedId === error.id}
                    onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
                    currentUserRole={currentUser.role}
                    onAcknowledge={onAcknowledgeError}
                    onRetry={onRetryError}
                    onAssign={onAssignError}
                    onAddNote={onAddErrorNote}
                    onResolve={onResolveError}
                  />
                ))}
                {groupedBySeverity.high.map(error => (
                  <ErrorCard
                    key={error.id}
                    error={error}
                    isExpanded={expandedId === error.id}
                    onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
                    currentUserRole={currentUser.role}
                    onAcknowledge={onAcknowledgeError}
                    onRetry={onRetryError}
                    onAssign={onAssignError}
                    onAddNote={onAddErrorNote}
                    onResolve={onResolveError}
                  />
                ))}
                {groupedBySeverity.medium.map(error => (
                  <ErrorCard
                    key={error.id}
                    error={error}
                    isExpanded={expandedId === error.id}
                    onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
                    currentUserRole={currentUser.role}
                    onAcknowledge={onAcknowledgeError}
                    onRetry={onRetryError}
                    onAssign={onAssignError}
                    onAddNote={onAddErrorNote}
                    onResolve={onResolveError}
                  />
                ))}
                {groupedBySeverity.low.map(error => (
                  <ErrorCard
                    key={error.id}
                    error={error}
                    isExpanded={expandedId === error.id}
                    onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
                    currentUserRole={currentUser.role}
                    onAcknowledge={onAcknowledgeError}
                    onRetry={onRetryError}
                    onAssign={onAssignError}
                    onAddNote={onAddErrorNote}
                    onResolve={onResolveError}
                  />
                ))}
              </>
            ) : (
              <>
                {Object.entries(groupedBySource).map(([source, errors]) => (
                  errors.length > 0 && (
                    <div key={source} className="space-y-2">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{getSourceLabel(source as SyncSource)}</h3>
                      {errors.map(error => (
                        <ErrorCard
                          key={error.id}
                          error={error}
                          isExpanded={expandedId === error.id}
                          onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
                          currentUserRole={currentUser.role}
                          onAcknowledge={onAcknowledgeError}
                          onRetry={onRetryError}
                          onAssign={onAssignError}
                          onAddNote={onAddErrorNote}
                          onResolve={onResolveError}
                        />
                      ))}
                    </div>
                  )
                ))}
              </>
            )}
            {unresolvedErrors.length === 0 && (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium">No unresolved errors</p>
                <p className="text-sm">All sync operations are running smoothly</p>
              </div>
            )}
          </div>
        </section>

        {/* Unlinked Deep Cura Notes */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Unlinked Deep Cura Notes ({unlinkedDeepCuraNotes.filter(n => n.status === 'pending_review').length})
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {unlinkedDeepCuraNotes.filter(n => n.status === 'pending_review').length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Received</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Note Preview</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Provider</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unlinkedDeepCuraNotes.filter(n => n.status === 'pending_review').map((note) => (
                      <UnlinkedNoteRow
                        key={note.id}
                        note={note}
                        onLink={onLinkDeepCuraNote}
                        onDismiss={onDismissDeepCuraNote}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No unlinked notes pending review</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

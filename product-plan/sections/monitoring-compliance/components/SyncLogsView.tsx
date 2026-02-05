import { useState } from 'react'
import type { SyncLogsViewProps, SyncLog, SyncLogFilters, SyncSource, SyncStatus } from '../types'

interface SyncLogsViewComponentProps extends SyncLogsViewProps {
  onRefresh?: () => void
}

const SOURCE_OPTIONS: { value: SyncSource | ''; label: string }[] = [
  { value: '', label: 'All Sources' },
  { value: 'drchrono', label: 'DrChrono' },
  { value: 'deepcura', label: 'Deep Cura' },
  { value: 'coda', label: 'Coda' },
]

const STATUS_OPTIONS: { value: SyncStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'completed', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'partial', label: 'Partial' },
  { value: 'running', label: 'Running' },
]

const TABLE_OPTIONS = [
  { value: '', label: 'All Tables' },
  { value: 'patients', label: 'patients' },
  { value: 'appointments', label: 'appointments' },
  { value: 'clinical_notes', label: 'clinical_notes' },
  { value: 'medications', label: 'medications' },
  { value: 'problems', label: 'problems' },
  { value: 'allergies', label: 'allergies' },
]

function getStatusColor(status: SyncStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'partial':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'running':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
  }
}

function getSourceIcon(source: SyncSource): React.ReactNode {
  const iconClass = "w-4 h-4"
  switch (source) {
    case 'drchrono':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    case 'deepcura':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    case 'coda':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function SyncLogRow({
  log,
  isExpanded,
  onToggle,
  onViewLog
}: {
  log: SyncLog
  isExpanded: boolean
  onToggle: () => void
  onViewLog?: (id: string) => void
}) {
  return (
    <>
      <tr
        className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {formatTimestamp(log.startedAt)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            {getSourceIcon(log.source)}
            <span className="capitalize">{log.source}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {log.tableName}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
            {log.recordsTotal}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(log.status)}`}>
            {log.status === 'completed' ? 'Success' : log.status.charAt(0).toUpperCase() + log.status.slice(1)}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {formatDuration(log.durationMs)}
          </span>
        </td>
        <td className="px-4 py-3">
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50 dark:bg-slate-800/30">
          <td colSpan={7} className="px-4 py-4">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Records: </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {log.recordsTotal} total | {log.recordsCreated} created | {log.recordsUpdated} updated | {log.recordsFailed} failed
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Triggered by: </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 capitalize">
                    {log.triggeredBy}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Operation: </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 capitalize">
                    {log.operation.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {log.errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">Error</div>
                  <pre className="font-mono text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">
                    {log.errorMessage}
                  </pre>
                </div>
              )}

              {log.warningMessage && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">Warning</div>
                  <pre className="font-mono text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                    {log.warningMessage}
                  </pre>
                </div>
              )}

              {log.drchronoId && (
                <div className="text-sm">
                  <span className="text-slate-500 dark:text-slate-400">DrChrono ID: </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">{log.drchronoId}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onViewLog?.(log.id) }}
                  className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                >
                  View Full Details →
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function SyncLogsView({
  syncLogs,
  onViewSyncLog,
  onSearchSyncLogs,
  onFilterSyncLogs,
  onRefresh
}: SyncLogsViewComponentProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<SyncLogFilters>({})
  const [currentPage, setCurrentPage] = useState(1)
  const logsPerPage = 20

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearchSyncLogs?.(query)
  }

  const handleFilterChange = (key: keyof SyncLogFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined }
    setFilters(newFilters)
    onFilterSyncLogs?.(newFilters)
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
    onFilterSyncLogs?.({})
  }

  const totalPages = Math.ceil(syncLogs.length / logsPerPage)
  const paginatedLogs = syncLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Sync Logs
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Browse and search sync operation history
              </p>
            </div>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <section className="mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by Record ID or UUID..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Source Filter */}
              <select
                value={filters.source || ''}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Table Filter */}
              <select
                value={filters.tableName || ''}
                onChange={(e) => handleFilterChange('tableName', e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {TABLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Clear Filters */}
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        {/* Logs Table */}
        <section>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Table</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Records</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Duration</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => (
                    <SyncLogRow
                      key={log.id}
                      log={log}
                      isExpanded={expandedId === log.id}
                      onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      onViewLog={onViewSyncLog}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Showing <span className="font-mono">{(currentPage - 1) * logsPerPage + 1}</span>-<span className="font-mono">{Math.min(currentPage * logsPerPage, syncLogs.length)}</span> of <span className="font-mono">{syncLogs.length}</span> logs
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

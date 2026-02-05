import type { ServiceHealth } from '../types'

interface ServiceHealthCardProps {
  service: ServiceHealth
  onClick?: () => void
}

const statusConfig = {
  healthy: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Healthy'
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Warning'
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    label: 'Error'
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export function ServiceHealthCard({ service, onClick }: ServiceHealthCardProps) {
  const config = statusConfig[service.status]

  return (
    <button
      onClick={onClick}
      className={`
        w-full h-full text-left p-5 rounded-xl border transition-all duration-200
        flex flex-col
        ${config.bg} ${config.border}
        hover:shadow-md hover:scale-[1.01] active:scale-[0.99]
        focus:outline-none focus:ring-2 focus:ring-amber-500/50
      `}
    >
      {/* Header - fixed height */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            {service.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
            <span className={`text-sm font-medium ${config.text}`}>
              {config.label}
            </span>
          </div>
        </div>
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {formatTimeAgo(service.lastSyncAt)}
        </span>
      </div>

      {/* Warning message - flexible area */}
      <div className="flex-1 flex items-center py-3">
        {service.warningMessage && (
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            {service.warningMessage}
          </p>
        )}
      </div>

      {/* Metrics - always at bottom */}
      <div className={`grid gap-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 ${service.errorCountLast24h > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Records (24h)
          </p>
          <p className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
            {service.recordsSyncedLast24h.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Last Duration
          </p>
          <p className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatDuration(service.lastSyncDurationMs)}
          </p>
        </div>
        {service.errorCountLast24h > 0 && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Errors (24h)
            </p>
            <p className="font-mono text-lg font-semibold text-red-600 dark:text-red-400">
              {service.errorCountLast24h}
            </p>
          </div>
        )}
      </div>
    </button>
  )
}

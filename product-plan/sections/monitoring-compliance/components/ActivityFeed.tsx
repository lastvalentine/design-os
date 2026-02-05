import type { SyncLog } from '../types'

interface ActivityFeedProps {
  logs: SyncLog[]
  onViewLog?: (id: string) => void
}

const sourceIcons: Record<string, React.ReactNode> = {
  drchrono: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  deepcura: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  coda: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  )
}

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export function ActivityFeed({ logs, onViewLog }: ActivityFeedProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Recent Activity
        </h3>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {logs.slice(0, 8).map((log) => (
          <button
            key={log.id}
            onClick={() => onViewLog?.(log.id)}
            className="w-full px-5 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              {sourceIcons[log.source]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100 capitalize">
                  {log.source}
                </span>
                <span className="text-slate-400 dark:text-slate-500">→</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {log.tableName}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {formatTime(log.startedAt)}
                </span>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  {formatDuration(log.durationMs)}
                </span>
                {log.recordsUpdated > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {log.recordsUpdated} updated
                  </span>
                )}
                {log.recordsCreated > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {log.recordsCreated} created
                  </span>
                )}
              </div>
            </div>

            <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusStyles[log.status]}`}>
              {log.status}
            </span>
          </button>
        ))}
      </div>

      {logs.length > 8 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <button className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors">
            View all {logs.length} logs →
          </button>
        </div>
      )}
    </div>
  )
}

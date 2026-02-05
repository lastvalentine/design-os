import type { SyncError, ErrorTypeStat } from '../types'

interface ErrorSummaryProps {
  errors: SyncError[]
  errorsByType: ErrorTypeStat[]
  onViewErrors?: () => void
}


function formatErrorType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function ErrorSummary({ errors, errorsByType, onViewErrors }: ErrorSummaryProps) {
  const openErrors = errors.filter(e => e.status === 'open')
  const criticalCount = openErrors.filter(e => e.severity === 'critical').length
  const highCount = openErrors.filter(e => e.severity === 'high').length

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Errors Requiring Attention
        </h3>
        {openErrors.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
            {openErrors.length}
          </span>
        )}
      </div>

      {openErrors.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No open errors
          </p>
        </div>
      ) : (
        <>
          <div className="px-5 py-4">
            <div className="flex items-center gap-4">
              {criticalCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    {criticalCount} critical
                  </span>
                </div>
              )}
              {highCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    {highCount} high
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 pb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Errors by Type (7 days)
            </p>
            <div className="space-y-2">
              {errorsByType.map((stat) => (
                <div key={stat.type} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {formatErrorType(stat.type)}
                  </span>
                  <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                    {stat.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={onViewErrors}
              className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
            >
              View all errors →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

import type { OverviewViewProps } from '@/../product/sections/monitoring-compliance/types'
import { ServiceHealthCard } from './ServiceHealthCard'
import { MetricCard } from './MetricCard'
import { SyncChart } from './SyncChart'
import { ActivityFeed } from './ActivityFeed'
import { ErrorSummary } from './ErrorSummary'
import { RecordCounts } from './RecordCounts'

interface OverviewDashboardProps extends OverviewViewProps {
  syncMetrics: OverviewViewProps['syncMetrics']
  syncErrors?: { status: string; severity: string }[]
  onViewService?: (id: string) => void
  onViewSyncLog?: (id: string) => void
  onViewErrors?: () => void
}

function formatLastRefresh(date?: string): string {
  if (!date) return 'Just now'
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

export function OverviewDashboard({
  serviceHealth,
  syncMetrics,
  recentSyncLogs,
  unresolvedErrorCount,
  syncErrors = [],
  onRefresh,
  onViewService,
  onViewSyncLog,
  onViewErrors
}: OverviewDashboardProps) {
  const { last24Hours, last7Days, totalRecordsInDb } = syncMetrics
  const successRate = last24Hours.totalSyncs > 0
    ? ((last24Hours.successfulSyncs / last24Hours.totalSyncs) * 100).toFixed(1)
    : '100'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                System Overview
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Real-time sync health and operational metrics
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Last updated: <span className="font-mono">{formatLastRefresh()}</span>
              </span>
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service Health Cards */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Service Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {serviceHealth.map((service) => (
              <ServiceHealthCard
                key={service.id}
                service={service}
                onClick={() => onViewService?.(service.id)}
              />
            ))}
          </div>
        </section>

        {/* Key Metrics */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Last 24 Hours
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Success Rate"
              value={`${successRate}%`}
              subValue={`${last24Hours.successfulSyncs} of ${last24Hours.totalSyncs} syncs`}
              trend={parseFloat(successRate) >= 95 ? 'up' : 'down'}
              trendValue={parseFloat(successRate) >= 95 ? 'Good' : 'Low'}
            />
            <MetricCard
              label="Avg Latency"
              value={`${(last24Hours.averageLatencyMs / 1000).toFixed(1)}s`}
              subValue="Per sync operation"
              trend="neutral"
            />
            <MetricCard
              label="Records Synced"
              value={last24Hours.recordsCreated + last24Hours.recordsUpdated}
              subValue={`${last24Hours.recordsCreated} created, ${last24Hours.recordsUpdated} updated`}
            />
            <MetricCard
              label="Open Errors"
              value={unresolvedErrorCount}
              trend={unresolvedErrorCount === 0 ? 'up' : 'down'}
              trendValue={unresolvedErrorCount === 0 ? 'Clear' : 'Needs attention'}
            />
          </div>
        </section>

        {/* Charts and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <SyncChart data={last7Days.syncsByDay} />
          </div>
          <div>
            <ErrorSummary
              errors={syncErrors as any}
              errorsByType={last7Days.errorsByType}
              onViewErrors={onViewErrors}
            />
          </div>
        </div>

        {/* Record Counts */}
        <section className="mb-8">
          <RecordCounts counts={totalRecordsInDb} />
        </section>

        {/* Activity Feed */}
        <section>
          <ActivityFeed
            logs={recentSyncLogs}
            onViewLog={onViewSyncLog}
          />
        </section>
      </div>
    </div>
  )
}

import data from '@/../product/sections/monitoring-compliance/data.json'
import { OverviewDashboard } from './components/OverviewDashboard'
import type { ServiceHealth, SyncMetrics, SyncLog, SyncError } from '@/../product/sections/monitoring-compliance/types'

export default function OverviewDashboardPreview() {
  const syncErrors = data.syncErrors as SyncError[]
  const unresolvedErrorCount = syncErrors.filter(e => e.status === 'open').length

  return (
    <OverviewDashboard
      serviceHealth={data.serviceHealth as ServiceHealth[]}
      syncMetrics={data.syncMetrics as SyncMetrics}
      recentSyncLogs={data.syncLogs as SyncLog[]}
      unresolvedErrorCount={unresolvedErrorCount}
      syncErrors={data.syncErrors}
      onRefresh={() => console.log('Refresh triggered')}
      onViewService={(id) => console.log('View service:', id)}
      onViewSyncLog={(id) => console.log('View sync log:', id)}
      onViewErrors={() => console.log('Navigate to errors view')}
    />
  )
}

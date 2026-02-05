import data from '@/../product/sections/monitoring-compliance/data.json'
import { SyncLogsView } from './components/SyncLogsView'
import type { SyncLog } from '@/../product/sections/monitoring-compliance/types'

export default function SyncLogsViewPreview() {
  return (
    <SyncLogsView
      syncLogs={data.syncLogs as SyncLog[]}
      onRefresh={() => console.log('Refresh triggered')}
      onViewSyncLog={(id) => console.log('View sync log:', id)}
      onSearchSyncLogs={(query) => console.log('Search:', query)}
      onFilterSyncLogs={(filters) => console.log('Filter:', filters)}
    />
  )
}

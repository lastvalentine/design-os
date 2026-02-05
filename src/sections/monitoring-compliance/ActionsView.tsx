import data from '@/../product/sections/monitoring-compliance/data.json'
import { ActionsView } from './components/ActionsView'
import type { SyncAction, RunningSyncOperation, CurrentUser } from '@/../product/sections/monitoring-compliance/types'

export default function ActionsViewPreview() {
  return (
    <ActionsView
      syncActions={data.syncActions as SyncAction[]}
      runningSyncOperations={data.runningSyncOperations as RunningSyncOperation[]}
      currentUser={data.currentUser as CurrentUser}
      onTriggerSyncAction={(actionId) => console.log('Trigger action:', actionId)}
    />
  )
}

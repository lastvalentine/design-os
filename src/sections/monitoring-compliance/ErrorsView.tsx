import data from '@/../product/sections/monitoring-compliance/data.json'
import { ErrorsView } from './components/ErrorsView'
import type { SyncError, UnlinkedDeepCuraNote, CurrentUser } from '@/../product/sections/monitoring-compliance/types'

export default function ErrorsViewPreview() {
  return (
    <ErrorsView
      syncErrors={data.syncErrors as SyncError[]}
      unlinkedDeepCuraNotes={data.unlinkedDeepCuraNotes as UnlinkedDeepCuraNote[]}
      currentUser={data.currentUser as CurrentUser}
      onAcknowledgeError={(id) => console.log('Acknowledge error:', id)}
      onRetryError={(id) => console.log('Retry error:', id)}
      onAssignError={(id, assignee) => console.log('Assign error:', id, assignee)}
      onAddErrorNote={(id, note) => console.log('Add note:', id, note)}
      onResolveError={(id) => console.log('Resolve error:', id)}
      onLinkDeepCuraNote={(deepCuraNoteId, clinicalNoteId) => console.log('Link note:', deepCuraNoteId, clinicalNoteId)}
      onDismissDeepCuraNote={(id, reason) => console.log('Dismiss note:', id, reason)}
    />
  )
}

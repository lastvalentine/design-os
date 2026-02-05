import { useState } from 'react'
import type { ActionsViewProps, SyncAction, RunningSyncOperation } from '@/../product/sections/monitoring-compliance/types'

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

function getTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just started'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function getActionIcon(actionName: string): React.ReactNode {
  const iconClass = "w-6 h-6"

  if (actionName.toLowerCase().includes('reconciliation')) {
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )
  }
  if (actionName.toLowerCase().includes('drchrono')) {
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    )
  }
  if (actionName.toLowerCase().includes('coda')) {
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    )
  }
  if (actionName.toLowerCase().includes('deep cura') || actionName.toLowerCase().includes('deepcura')) {
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  }
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function RunningOperationCard({ operation }: { operation: RunningSyncOperation }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">{operation.actionName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Started by {operation.startedBy}</p>
          </div>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">{getTimeAgo(operation.startedAt)}</span>
      </div>

      {operation.progress !== undefined && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Progress</span>
            <span className="font-mono text-slate-900 dark:text-slate-100">{operation.progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${operation.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ActionCard({
  action,
  currentUserRole,
  isRunning,
  onTrigger
}: {
  action: SyncAction
  currentUserRole: string
  isRunning: boolean
  onTrigger: () => void
}) {
  const canTrigger = (currentUserRole === 'admin' || currentUserRole === 'operator') && action.requiredRole !== 'admin' || currentUserRole === 'admin'
  const isDisabled = !canTrigger || isRunning

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
          {getActionIcon(action.name)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{action.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{action.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {action.estimatedDuration}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {action.requiredRole} only
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onTrigger}
        disabled={isDisabled}
        className={`w-full mt-4 px-4 py-2 rounded-lg font-medium transition-colors ${
          isDisabled
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            : 'bg-amber-500 hover:bg-amber-600 text-white'
        }`}
      >
        {isRunning ? 'Running...' : 'Trigger'}
      </button>
    </div>
  )
}

function ConfirmationModal({
  action,
  onConfirm,
  onCancel
}: {
  action: SyncAction
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirm {action.name}</h3>
          </div>
        </div>

        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {action.confirmationMessage}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
          >
            Confirm & Start
          </button>
        </div>
      </div>
    </div>
  )
}

interface RecentAction {
  id: string
  actionName: string
  triggeredBy: string
  triggeredAt: string
  status: 'completed' | 'failed'
  duration: string
}

export function ActionsView({
  syncActions,
  runningSyncOperations,
  currentUser,
  onTriggerSyncAction
}: ActionsViewProps & { onRefresh?: () => void }) {
  const [confirmingAction, setConfirmingAction] = useState<SyncAction | null>(null)

  // Mock recent actions for display (in real app, this would come from props)
  const recentActions: RecentAction[] = [
    {
      id: '1',
      actionName: 'Full Reconciliation',
      triggeredBy: 'admin@feelaugust.com',
      triggeredAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed',
      duration: '18m 32s'
    },
    {
      id: '2',
      actionName: 'DrChrono Sync (patients)',
      triggeredBy: 'operator@feelaugust.com',
      triggeredAt: new Date(Date.now() - 86400000).toISOString(),
      status: 'completed',
      duration: '2m 15s'
    }
  ]

  const handleTrigger = (action: SyncAction) => {
    setConfirmingAction(action)
  }

  const handleConfirm = () => {
    if (confirmingAction) {
      onTriggerSyncAction?.(confirmingAction.id)
      setConfirmingAction(null)
    }
  }

  const runningActionIds = new Set(runningSyncOperations.map(op => op.actionId))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Manual Actions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Trigger sync operations manually
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Currently Running */}
        {runningSyncOperations.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              Currently Running
            </h2>
            <div className="space-y-4">
              {runningSyncOperations.map(op => (
                <RunningOperationCard key={op.id} operation={op} />
              ))}
            </div>
          </section>
        )}

        {/* Available Actions */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Available Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {syncActions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                currentUserRole={currentUser.role}
                isRunning={runningActionIds.has(action.id)}
                onTrigger={() => handleTrigger(action)}
              />
            ))}
          </div>

          {syncActions.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-slate-500 dark:text-slate-400">No actions available</p>
            </div>
          )}
        </section>

        {/* Recent Actions */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Recent Manual Actions
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Triggered By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActions.map((action) => (
                    <tr key={action.id} className="border-b border-slate-200 dark:border-slate-800">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                          {formatTimestamp(action.triggeredAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                        {action.actionName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                          {action.triggeredBy}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          action.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                          {action.duration}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Confirmation Modal */}
      {confirmingAction && (
        <ConfirmationModal
          action={confirmingAction}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmingAction(null)}
        />
      )}
    </div>
  )
}

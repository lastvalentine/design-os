import { LayoutDashboard, ScrollText, AlertTriangle, Play } from 'lucide-react'
import { AppShell } from './components/AppShell'

export default function ShellPreview() {
  const navigationItems = [
    {
      label: 'Overview',
      href: '/overview',
      icon: <LayoutDashboard className="w-5 h-5" />,
      isActive: true,
    },
    {
      label: 'Sync Logs',
      href: '/sync-logs',
      icon: <ScrollText className="w-5 h-5" />,
    },
    {
      label: 'Errors',
      href: '/errors',
      icon: <AlertTriangle className="w-5 h-5" />,
      badge: 3,
    },
    {
      label: 'Actions',
      href: '/actions',
      icon: <Play className="w-5 h-5" />,
    },
  ]

  const user = {
    name: 'Bobby Chen',
    avatarUrl: undefined,
  }

  return (
    <AppShell
      navigationItems={navigationItems}
      user={user}
      syncStatus="healthy"
      onNavigate={(href) => console.log('Navigate to:', href)}
      onLogout={() => console.log('Logout')}
    >
      <div className="p-6 lg:p-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sync status and health metrics for Feel August Platform
          </p>
        </div>

        {/* Sample content - status cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'DrChrono Sync', status: 'Healthy', time: '2 min ago', color: 'emerald' },
            { label: 'Deep Cura', status: 'Healthy', time: '5 min ago', color: 'emerald' },
            { label: 'Coda Push', status: 'Warning', time: '15 min ago', color: 'amber' },
            { label: 'Email Processor', status: 'Healthy', time: '1 hr ago', color: 'emerald' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {item.label}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    item.color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {item.status}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                Last sync: {item.time}
              </p>
            </div>
          ))}
        </div>

        {/* Sample content - recent activity */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-medium text-slate-900 dark:text-slate-100">
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {[
              { type: 'patients', action: 'Full sync completed', count: 847, time: '2 min ago' },
              { type: 'appointments', action: 'Webhook received', count: 1, time: '5 min ago' },
              { type: 'deepcura', action: 'Gridhook processed', count: 3, time: '12 min ago' },
              { type: 'coda', action: 'Push completed', count: 52, time: '15 min ago' },
            ].map((item, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {item.action}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {item.type} • {item.count} records
                  </p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

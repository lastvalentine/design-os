import { useState } from 'react'
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { MainNav } from './MainNav'
import { UserMenu } from './UserMenu'

export interface NavigationItem {
  label: string
  href: string
  icon?: React.ReactNode
  isActive?: boolean
  badge?: number
}

export interface AppShellProps {
  children: React.ReactNode
  navigationItems: NavigationItem[]
  user?: { name: string; avatarUrl?: string; role?: string }
  syncStatus?: 'healthy' | 'warning' | 'error'
  onNavigate?: (href: string) => void
  onLogout?: () => void
}

export function AppShell({
  children,
  navigationItems,
  user,
  syncStatus = 'healthy',
  onNavigate,
  onLogout,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const statusColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
          transform transition-all duration-200 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Brand header */}
          <div className={`flex items-center h-16 border-b border-slate-200 dark:border-slate-800 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
            <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColors[syncStatus]}`} />
              {!collapsed && (
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Feel August
                </span>
              )}
            </div>
            <button
              className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-4">
            <MainNav items={navigationItems} onNavigate={onNavigate} collapsed={collapsed} />
          </div>

          {/* User menu */}
          {user && (
            <div className="border-t border-slate-200 dark:border-slate-800">
              <UserMenu user={user} onLogout={onLogout} collapsed={collapsed} />
            </div>
          )}

          {/* Collapse toggle */}
          <div className={`hidden lg:flex border-t border-slate-200 dark:border-slate-800 ${collapsed ? 'justify-center' : 'justify-end'} p-2`}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`transition-all duration-200 ${collapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 lg:hidden">
          <button
            className="p-2 -ml-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div className={`w-2 h-2 rounded-full ${statusColors[syncStatus]}`} />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Feel August
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] lg:min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}

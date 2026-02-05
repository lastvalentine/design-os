import type { NavigationItem } from './AppShell'

interface MainNavProps {
  items: NavigationItem[]
  onNavigate?: (href: string) => void
  collapsed?: boolean
}

export function MainNav({ items, onNavigate, collapsed = false }: MainNavProps) {
  return (
    <nav className={`space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => onNavigate?.(item.href)}
          title={collapsed ? item.label : undefined}
          className={`
            w-full flex items-center rounded-lg text-sm font-medium
            transition-colors duration-150 relative
            ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}
            ${
              item.isActive
                ? collapsed
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-l-2 border-amber-500 -ml-0.5 pl-[calc(0.75rem+2px)]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }
          `}
        >
          {item.icon && (
            <span className={`flex-shrink-0 ${item.isActive ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              {item.icon}
            </span>
          )}
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full
                    ${
                      item.isActive
                        ? 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                    }
                  `}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </>
          )}
          {collapsed && item.badge !== undefined && item.badge > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      ))}
    </nav>
  )
}

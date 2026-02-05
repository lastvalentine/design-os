import { LogOut } from 'lucide-react'

interface UserMenuProps {
  user: { name: string; avatarUrl?: string; role?: string }
  onLogout?: () => void
  collapsed?: boolean
}

export function UserMenu({ user, onLogout, collapsed = false }: UserMenuProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (collapsed) {
    return (
      <div className="p-2 flex flex-col items-center gap-2">
        {/* Avatar only */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-9 h-9 rounded-full object-cover"
            title={user.name}
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center"
            title={user.name}
          >
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {initials}
            </span>
          </div>
        )}
        {/* Logout button */}
        <button
          onClick={onLogout}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        {/* Avatar */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {initials}
            </span>
          </div>
        )}

        {/* Name and logout */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {user.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {user.role || 'Admin'}
          </p>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

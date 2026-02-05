# Milestone 2: Application Shell

Build the application shell with sidebar navigation, user menu, and responsive layout.

---

## 2.1 Shell Components

Copy these components from `shell/components/`:

1. **AppShell.tsx** - Main layout wrapper
2. **MainNav.tsx** - Navigation item list
3. **UserMenu.tsx** - User avatar and logout
4. **index.ts** - Barrel exports

Place them in your project:

```
src/
└── components/
    └── shell/
        ├── AppShell.tsx
        ├── MainNav.tsx
        ├── UserMenu.tsx
        └── index.ts
```

## 2.2 Update Imports

The copied components import types with path aliases. Update imports to match your project:

```typescript
// Before (Design OS paths)
import type { NavigationItem } from './AppShell'

// After (your project)
import type { NavigationItem } from './AppShell'
// (This one should work as-is since it's a relative import)
```

For icon imports, ensure lucide-react is installed:

```typescript
import { Menu, X, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
```

## 2.3 Navigation Items

Define your navigation items with icons from lucide-react:

```typescript
import { LayoutDashboard, ScrollText, AlertTriangle, Play } from 'lucide-react'

const navigationItems = [
  {
    label: 'Overview',
    href: '/overview',
    icon: <LayoutDashboard className="w-5 h-5" />,
    isActive: location.pathname === '/overview',
  },
  {
    label: 'Sync Logs',
    href: '/sync-logs',
    icon: <ScrollText className="w-5 h-5" />,
    isActive: location.pathname === '/sync-logs',
  },
  {
    label: 'Errors',
    href: '/errors',
    icon: <AlertTriangle className="w-5 h-5" />,
    isActive: location.pathname === '/errors',
    badge: unresolvedErrorCount, // Show count when > 0
  },
  {
    label: 'Actions',
    href: '/actions',
    icon: <Play className="w-5 h-5" />,
    isActive: location.pathname === '/actions',
  },
]
```

## 2.4 Integrate with Router

Connect the shell to your routing library:

**React Router example:**

```typescript
import { useLocation, useNavigate } from 'react-router-dom'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleNavigate = (href: string) => {
    navigate(href)
  }

  return (
    <AppShell
      navigationItems={navigationItems}
      user={currentUser}
      syncStatus={overallSyncStatus}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  )
}
```

## 2.5 Sync Status Indicator

The shell displays a sync status indicator (colored dot) based on overall system health:

```typescript
// Compute overall status from service health
function getOverallStatus(services: ServiceHealth[]): 'healthy' | 'warning' | 'error' {
  if (services.some(s => s.status === 'error')) return 'error'
  if (services.some(s => s.status === 'warning')) return 'warning'
  return 'healthy'
}
```

## 2.6 User Menu

The user menu shows:
- User initials or avatar
- User name and role
- Logout button

Pass user data from your auth context:

```typescript
const user = {
  name: currentUser.name,
  role: currentUser.role,
  avatarUrl: undefined, // Optional avatar image
}
```

## 2.7 Set Up Routes

Create route configuration:

```typescript
// React Router example
const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/overview" /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'sync-logs', element: <SyncLogsPage /> },
      { path: 'errors', element: <ErrorsPage /> },
      { path: 'actions', element: <ActionsPage /> },
    ],
  },
]
```

## 2.8 Responsive Behavior

The shell handles responsiveness automatically:

| Breakpoint | Sidebar Behavior |
|------------|------------------|
| Desktop (1024px+) | Fixed sidebar, always visible |
| Tablet (768px-1023px) | Collapsible, toggle button |
| Mobile (<768px) | Hidden, hamburger menu overlay |

Test on different screen sizes to verify.

---

## Completion Checklist

- [ ] Shell components copied and imports fixed
- [ ] Navigation items defined with icons
- [ ] Router integration working
- [ ] Active nav item highlights correctly
- [ ] Error badge shows on Errors nav item
- [ ] Sync status indicator displays
- [ ] User menu shows name and role
- [ ] Sidebar collapses on desktop toggle
- [ ] Mobile hamburger menu works
- [ ] Routes navigate correctly

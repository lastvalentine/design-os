# Application Shell Specification

## Overview

The Feel August Platform admin dashboard uses a sidebar navigation pattern optimized for monitoring and operations tasks. The shell provides persistent navigation across four main views while maintaining a clean, focused interface for the co-owners who will use it.

## Navigation Structure

- **Overview** → Dashboard home with sync health metrics, service status, and recent activity
- **Sync Logs** → Detailed sync operation history with filtering by source, status, and date
- **Errors** → Failed syncs, unlinked Deep Cura notes, and items requiring attention
- **Actions** → Manual reconciliation triggers, retry failed syncs, administrative operations

## User Menu

- **Location:** Bottom of sidebar
- **Contents:** User initials avatar, display name, logout button
- **Style:** Minimal display appropriate for small team (co-owners only)

## Layout Pattern

- **Sidebar:** Fixed left sidebar (240px width on desktop)
- **Content Area:** Flexible width, fills remaining viewport
- **Header:** Optional contextual header within content area for page titles and actions

## Responsive Behavior

- **Desktop (1024px+):** Full sidebar always visible, content area with generous padding
- **Tablet (768px-1023px):** Collapsible sidebar with toggle button in header, overlay mode when open
- **Mobile (<768px):** Sidebar hidden by default, hamburger menu in header triggers slide-out overlay

## Design Tokens

### Colors
- **Primary (amber):** Active nav items, action buttons, key highlights
- **Neutral (slate):** Backgrounds, borders, text, inactive states

### Typography
- **Inter:** Navigation labels, headings, body text
- **JetBrains Mono:** Sync IDs, timestamps, log entries, technical data

### Color Mode
- Full support for light and dark modes using Tailwind `dark:` variants
- Dark mode uses slate-900/950 backgrounds with lighter text
- Light mode uses white/slate-50 backgrounds with darker text

## Authentication

- **Method:** Google Cloud Identity-Aware Proxy (IAP)
- **Identity Provider:** Google Workspace Enterprise (SAML)
- **User Identity:** Provided via IAP headers (`X-Goog-Authenticated-User-Email`, `X-Goog-Authenticated-User-Id`)
- **Access Control:** IAP restricts to authorized Google Workspace users; StaffRole table provides RBAC within the app
- **Roles:**
  - `admin` — Full access, can trigger manual actions, modify settings
  - `operator` — View all data, acknowledge errors, cannot modify settings
  - `viewer` — Read-only access to dashboards and logs

## Design Notes

- Navigation icons use lucide-react for consistency
- Active nav item has amber accent (left border or background tint)
- Hover states use subtle slate background shift
- Sidebar includes "Feel August" branding at top
- Error count badge on "Errors" nav item when issues exist
- Sync status indicator (green/yellow/red dot) visible in sidebar header

# Milestone 1: Foundation

Set up the project foundation with types, design tokens, and base configuration.

---

## 1.1 Project Setup

Create a new React + TypeScript project with Tailwind CSS v4.

```bash
# Create project (use your preferred method)
npm create vite@latest feel-august-admin -- --template react-ts

# Install Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Install icons
npm install lucide-react
```

## 1.2 Configure Tailwind CSS v4

In your CSS entry point (e.g., `src/index.css`):

```css
@import "tailwindcss";

/* Import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

In `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

## 1.3 Design Tokens

The design system uses:

**Colors:**
- Primary: `amber` (Tailwind built-in)
- Secondary: `slate` (Tailwind built-in)
- Neutral: `slate` (Tailwind built-in)

**Typography:**
- Headings: Inter
- Body: Inter
- Mono: JetBrains Mono

Apply these in your components using Tailwind classes:
- `text-amber-500` for primary accents
- `text-slate-900 dark:text-slate-100` for primary text
- `font-mono` for code/timestamps (ensure JetBrains Mono is loaded)

## 1.4 Copy TypeScript Types

Copy the types file from `data-model/types.ts` (or `sections/monitoring-compliance/types.ts`) to your project:

```
src/
└── types/
    └── monitoring.ts
```

These types define:
- `ServiceHealth` - Service status tracking
- `SyncMetrics` - Aggregated metrics
- `SyncLog` - Individual sync operations
- `SyncError` - Error records
- `UnlinkedDeepCuraNote` - Notes pending review
- `SyncAction` - Manual sync triggers
- `CurrentUser` - Authenticated user
- View props interfaces

## 1.5 Copy Sample Data

Copy `sections/monitoring-compliance/data.json` for development testing:

```
src/
└── data/
    └── sample-data.json
```

## 1.6 Base Layout

Create a minimal app layout:

```typescript
// src/App.tsx
function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Shell will go here */}
      <main className="p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Feel August Admin
        </h1>
      </main>
    </div>
  )
}
```

## 1.7 Dark Mode Setup

Ensure dark mode works with Tailwind's class strategy. Add a dark mode toggle or respect system preference:

```typescript
// Respect system preference
useEffect(() => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }
}, [])
```

---

## Completion Checklist

- [ ] Project created with React + TypeScript
- [ ] Tailwind CSS v4 configured
- [ ] Google Fonts loading (Inter, JetBrains Mono)
- [ ] Types file copied to project
- [ ] Sample data file copied
- [ ] Basic app renders with correct fonts
- [ ] Dark mode works with `dark:` variants

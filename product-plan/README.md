# Feel August Platform - Implementation Package

This export package contains everything needed to implement the Feel August Platform admin dashboard.

## Quick Start

1. **Review the product overview** in `product-overview.md` to understand the product vision
2. **Choose your implementation approach:**
   - **One-shot**: Use `prompts/one-shot-prompt.md` to implement everything at once
   - **Incremental**: Use section prompts from `prompts/section-prompt.md` to build milestone by milestone

3. **Implementation instructions** are in the `instructions/` folder
4. **Components are ready to copy** from `shell/` and `sections/`

## Package Contents

```
product-plan/
├── README.md                 # This file
├── product-overview.md       # Product vision and scope
│
├── prompts/                  # Ready-to-use prompts for coding agents
│   ├── one-shot-prompt.md    # Full implementation in one session
│   └── section-prompt.md     # Template for incremental implementation
│
├── instructions/             # Implementation guides
│   ├── one-shot-instructions.md
│   └── incremental/
│       ├── 01-foundation.md
│       ├── 02-shell.md
│       └── 03-monitoring-compliance.md
│
├── design-system/           # Design tokens
│   ├── colors.json
│   └── typography.json
│
├── data-model/              # Types and sample data
│   └── data-model.md
│
├── shell/                   # Application shell components
│   └── components/
│       ├── AppShell.tsx
│       ├── MainNav.tsx
│       ├── UserMenu.tsx
│       └── index.ts
│
└── sections/
    └── monitoring-compliance/
        ├── spec.md
        ├── types.ts
        ├── data.json
        ├── tests.md
        └── components/
            ├── OverviewDashboard.tsx
            ├── ServiceHealthCard.tsx
            ├── MetricCard.tsx
            ├── SyncChart.tsx
            ├── ActivityFeed.tsx
            ├── ErrorSummary.tsx
            ├── RecordCounts.tsx
            ├── SyncLogsView.tsx
            ├── ErrorsView.tsx
            ├── ActionsView.tsx
            └── index.ts
```

## Design System

- **Primary color**: `amber` (Tailwind)
- **Neutral color**: `slate` (Tailwind)
- **Heading font**: Inter (Google Fonts)
- **Body font**: Inter (Google Fonts)
- **Mono font**: JetBrains Mono (Google Fonts)

## Tech Stack Assumptions

The components are built with:
- React 18+
- TypeScript
- Tailwind CSS v4
- lucide-react for icons

Adjust imports and dependencies based on your actual tech stack.

## Authentication

The admin dashboard uses Google Cloud Identity-Aware Proxy (IAP) for authentication. The implementation agent will need to configure:
- IAP headers for user identity
- StaffRole table for RBAC
- Role-based UI visibility (admin, operator, viewer)

---

Generated with [Design OS](https://github.com/design-os)

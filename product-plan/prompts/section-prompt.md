# Section Implementation Prompt Template

Use this template when implementing the platform incrementally, one milestone at a time.

---

## Prompt Template

I need you to implement **[MILESTONE NAME]** for the Feel August Platform admin dashboard.

**Context:**
- Product overview: [paste from product-overview.md or reference it]
- This is milestone [N] of 3
- Previous milestones completed: [list what's already built]

**Before you begin, please confirm:**

1. Your tech stack (React, TypeScript, Tailwind version, routing library)
2. How authentication is being handled
3. Your API communication approach

**For this milestone, implement:**

[Paste the specific milestone instructions from `instructions/incremental/`]

**Design tokens:**
- Primary: `amber` (Tailwind)
- Neutral: `slate` (Tailwind)
- Fonts: Inter (headings/body), JetBrains Mono (code/timestamps)
- Dark mode support required

**Test plan:**
[Paste relevant tests from `sections/[section]/tests.md`]

---

## Example: Implementing Milestone 2 (Shell)

I need you to implement **the Application Shell** for the Feel August Platform admin dashboard.

**Context:**
- See attached product-overview.md for full context
- This is milestone 2 of 3
- Milestone 1 (Foundation) is complete: types, design tokens, project structure

**Before you begin, please confirm:**
1. Your routing library (React Router, Next.js, etc.)
2. How you want to handle navigation state

**For this milestone, implement:**

[Paste contents of `instructions/incremental/02-shell.md`]

---

## Example: Implementing Milestone 3 (Monitoring & Compliance)

I need you to implement **the Monitoring & Compliance section** for the Feel August Platform admin dashboard.

**Context:**
- See attached product-overview.md for full context
- This is milestone 3 of 3
- Shell is complete with sidebar navigation working

**Before you begin, please confirm:**
1. Your API communication approach (REST endpoints? Mock data?)
2. Any state management preferences for the dashboard data

**For this milestone, implement:**

[Paste contents of `instructions/incremental/03-monitoring-compliance.md`]

**Test plan:**

[Paste contents of `sections/monitoring-compliance/tests.md`]

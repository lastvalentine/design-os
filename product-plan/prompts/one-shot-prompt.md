# One-Shot Implementation Prompt

Copy and paste this prompt into your coding agent (Claude, Cursor, etc.) along with the contents of `instructions/one-shot-instructions.md`.

---

## Prompt

I need you to implement the **Feel August Platform** admin dashboard based on the provided design specifications and components.

**Before you begin, please ask me:**

1. **Tech stack confirmation**: What frameworks are you using? (The components assume React 18+, TypeScript, Tailwind CSS v4, but please confirm your setup)

2. **Authentication approach**: The spec calls for Google Cloud IAP. How should we handle authentication in this implementation?
   - Mock authentication for development?
   - Real IAP integration?
   - Different auth provider?

3. **Backend API**: How should the frontend communicate with the backend?
   - REST API endpoints you've already built?
   - GraphQL?
   - Mock data initially?

4. **Routing**: What routing library are you using?
   - React Router?
   - Next.js app router?
   - Other?

5. **State management**: Any preference for global state?
   - React Context?
   - Zustand?
   - Redux?
   - Server state only (React Query/SWR)?

**Once I answer these questions**, implement the admin dashboard following these priorities:

1. Set up the application shell with sidebar navigation
2. Implement the Overview Dashboard with service health cards
3. Add the Sync Logs view with filtering and pagination
4. Add the Errors view with severity grouping and Deep Cura notes table
5. Add the Actions view with confirmation modals
6. Wire up auto-refresh (30-60 second intervals)
7. Implement role-based UI visibility

**Design tokens:**
- Primary: `amber` (Tailwind)
- Neutral: `slate` (Tailwind)
- Fonts: Inter (headings/body), JetBrains Mono (code/timestamps)
- Dark mode support required

**Important:**
- All components are props-based—never import data directly in components
- Use the TypeScript types provided in `sections/monitoring-compliance/types.ts`
- Follow the component patterns in the provided `.tsx` files
- Ensure mobile responsiveness using Tailwind breakpoints

The full implementation instructions follow below.

---

[Paste contents of `instructions/one-shot-instructions.md` here]

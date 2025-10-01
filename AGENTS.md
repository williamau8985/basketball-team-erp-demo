# Project Guidance for Basketball Team ERP

## Core Principles
- **Local-first only**: The entire application must run in the browser. Do not introduce APIs, server routes, or dependencies that require backend runtimes.
- **localStorage persistence**: All data must ultimately live in the user's browser storage. Use the existing `sql.js` setup and helper hooks so that SQLite changes continue to persist through `localStorage`. Avoid features that break this persistence (e.g., IndexedDB migrations) unless explicitly approved.
- **Portfolio ready**: Keep the footprint lightweight and compatible with static hosting on Vercel/Netlify/GitHub Pages.

## Architectural Notes
- React + TypeScript project bootstrapped with Vite. Path alias `@/` maps to `src/`.
- Data layer flows through `src/lib/database.ts` (SQLite init) and `src/hooks/useDatabase.ts` (query helpers). Prefer adding SQL helpers here instead of scattering raw `sql.js` calls.
- Feature views live in `src/features/*`. Shared UI lives in `src/components` (`ui`, `layout`, `common`). When adding new UI primitives, colocate them appropriately and export via existing barrel files if present. Use Shadcn UI Library when possible.
- Global styles use Tailwind CSS 4. Extend utility classes via the Tailwind config instead of hard-coded inline styles when possible.

## Working With the Database
- Expect schema changes. Update the schema definition inside the database bootstrap files and provide migration logic that keeps existing localStorage users from breaking (e.g., feature-detected schema upgrades executed on load).
- When adjusting schema or seed data, ensure `useDatabase` and any feature-specific hooks (`useRoster`, etc.) remain in sync.
- Provide helper utilities for import/export in `src/hooks/useDbBackup.ts` so users can back up their data before major changes.

## Testing & Tooling
- Preferred dev commands: `npm run dev`, `npm run build`, `npm run lint`.
- Keep TypeScript types strict and resolve ESLint warnings before committing.
- When adding new scripts or commands, ensure they still function in a zero-backend static hosting environment.

## Documentation Expectations
- Update `README.md` and any relevant feature docs when schemas or user flows change.
- Document breaking changes to the SQLite schema and provide guidance on how users can migrate their local data (e.g., export/import instructions).

## Pull Request Tips
- Explain how changes respect the local-first constraint and any migration steps required for existing users.
- If you touch multiple feature areas, summarize the ripple effects (UI, hooks, schema) so reviewers understand necessary manual testing steps.


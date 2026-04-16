# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## SalesCRM Application

A full-stack Sales CRM with:
- **Frontend**: React + Vite at `artifacts/crm` (served at `/`)
- **Backend**: Express API server at `artifacts/api-server` (served at `/api`)
- **Database**: PostgreSQL with Drizzle ORM (`lib/db`)
- **API spec**: OpenAPI at `lib/api-spec/openapi.yaml`, generated client at `lib/api-client-react`

### Features
- JWT authentication (stored in localStorage as `crm_token`) with admin/sales roles
- Role-scoped lead access: sales reps see only their own leads; admins see all
- Customer profiles with interaction history timeline
- Lead pipeline management (9 statuses: New → Qualify → Discovery → Proposal → Negotiate → Close Win / Close Loss → Maintain → Grow)
- Inline status pill selector on leads list (colour-coded, saves on change)
- Inline rep reassignment (admin-only column in leads list)
- "This Week" follow-up view — leads grouped by day (Overdue/Today/weekday), sorted by follow-up date
- Lead deduplication via `isActive` flag — creating a new lead for a customer auto-archives all previous leads; archived leads shown with greyed-out "Archived" badge in customer history
- Google Maps navigation links per lead (when customer has address)
- Follow-up email endpoint (Nodemailer, SMTP env vars optional — logs if not configured)
- Admin panel for user management and reminder scheduling (admin-only)
- **Reports page** (`/admin/reports`, admin-only): print-ready report with "Leads by Sales Rep", "Overdue Activity", and "New Activity (last 7 days)" sections; print/save-as-PDF via `window.print()` with `@media print` CSS
- Dashboard with stats cards and lead status pie chart

### Demo Credentials
- Admin: `admin@crm.com` / `admin123`
- Sales Rep: `sarah@crm.com` / `sales123`
- Sales Rep: `mike@crm.com` / `sales123`

### Auth Architecture
- `setAuthTokenGetter` from `@workspace/api-client-react` wires JWT bearer token into every API request
- Called in `artifacts/crm/src/main.tsx` via `setupApiAuth()`
- `useAuth` hook uses `useGetMe` to validate token; exposes `isAuthenticated`, `userRole`, `logout`
- Protected routes redirect to `/login` if no token; admin-only routes redirect to `/` for non-admins

### Environment Variables
- `SESSION_SECRET` — JWT signing secret (required, set as Replit secret)
- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT` — optional, for real email delivery

# MenuPlanner

Touch-first family meal and grocery planner with a shared calendar, recipe book, ingredient lane, leftovers tracking, and School Lunch planning/approval flows.

## Recent updates (Phase 3.5+)

- Added auth/session foundation:
  - Added `proxy.ts` (Next.js v16 replacement for `middleware.ts`) for school-lunch route protection.
  - Added session normalization so missing/invalid sessions become guest sessions on startup and in request checks.
  - Kept `/login` and `/logout` flow with terminal sign-out reset behavior.
- Added migration planning:
  - Expanded implementation planning with `Phase 3.6 – Real Auth Adapter & Session Hardening` in `docs/IMPLEMENTATION_PLAN.md`.
- Added regression/guard tests:
  - `tests/proxy.test.ts` for auth route policy behavior (unauthenticated, child, adult, malformed sessions).
- Started Phase 3.6 hardening:
  - Added `realAuthGateway` request path behind `NEXT_PUBLIC_USE_REAL_AUTH`.
  - Added API-backed session endpoints: `/api/auth/session`, `/api/auth/signin`, `/api/auth/signout`.
  - Added HTTP-only cookie issuance and cookie expiry checks for real-mode restore/sign-out behavior.
- Added `POST /api/auth/refresh` token refresh endpoint and expiry-triggered refresh logging (`auth.refresh`, `auth.tokenInvalid`).
- Added NextAuth.js credentials provider bootstrap in `src/lib/auth/nextAuth.ts` and wired it through `/api/auth/[...nextauth]/route.ts`.
- Added NextAuth-compatible login path when `NEXT_PUBLIC_USE_REAL_AUTH=true` (`/login` now requests username/password and calls NextAuth sign-in).
- Added Prisma-backed auth identity storage (SQLite + hashed passwords via bcryptjs) and moved `/api/auth/register` + credential validation to database-backed persistence.
- Added Phase 3.7 auth governance controls:
  - Added `/api/auth/policy` endpoint so adult actors can set child `editPolicy`.
  - Added `/school-lunch/adult/policies` UI for child permission administration.
  - Added policy persistence service path with `policy.updated` logging and update-path tests.

## Tech stack

- React + TypeScript
- Next.js (App Router)
- Tailwind CSS
- Zustand for state management
- Jest/Vitest + React Testing Library for tests

## Project structure

- `docs/` – Product design and implementation plan.
- `src/app/` – Next.js routes and top-level layouts.
- `src/components/` – Reusable UI components.
- `src/lib/` – Utilities (logging, helpers).
- `src/stores/` – Zustand state slices.
- `src/types/` – Shared types and interfaces.
- `tests/` – Unit and component tests.

## Getting started

_Implementation is being brought up in phases. Commands below are already available._

### Commands

- `npm run dev` – Start the Next.js dev server (default at `http://localhost:3000`).
- `npm run build` – Create a production build.
- `npm start` – Run the production build.
- `npm run lint` – Run ESLint across source and app files.
- `npm test` – Run unit tests (Jest).
- `npm run typecheck` – Run TypeScript type checking.
- `npm run lint:tests` – Run tests only (legacy lint-like verification alias).
- `npm run ci:check` – Run lint + tests + build.
- `npm run db:generate` – Generate Prisma client from schema.
- `npm run db:migrate:dev` – Create/apply local migrations during development.
- `npm run db:migrate:deploy` – Apply migrations in deployment/local recovery flows.
- `npm run db:push` – Apply Prisma schema directly (quick bootstrap only).

#### Production publish runbook

- Ensure environment:
  - `NODE_ENV=production`
  - `NEXT_PUBLIC_USE_REAL_AUTH=true`
  - `NEXTAUTH_SECRET` set (long random value)
  - `NEXTAUTH_URL` set to production origin
  - `NEXTAUTH_TRUST_HOST=true` for hosted/proxied environments
  - `DATABASE_URL` pointing at the production datastore
- Migrate database:
  - `npm run db:generate`
  - `npm run db:migrate:deploy`
- Validate before publish:
  - `npm run ci:check`

### Environment

- Copy `.env.example` to `.env.local` and configure:
  - `NEXT_PUBLIC_USE_REAL_AUTH` to `true` for NextAuth-backed auth.
  - `NEXTAUTH_SECRET` for stable NextAuth session signing.
  - `DATABASE_URL` for Prisma auth-user storage (default local SQLite: `file:./dev.db`).
  - `NEXTAUTH_IDENTITY_CREDENTIALS` (JSON object) for optional per-user demo credentials.
  - `NEXT_PUBLIC_DEMO_AUTH_PASSWORD` / `NEXTAUTH_DEMO_PASSWORD` for fallback password.
  - `NEXTAUTH_URL` for deployed host and callback configuration.
  - `NEXTAUTH_TRUST_HOST` when behind a proxy.
  - `MENU_ADMIN_USER_IDS` for explicit admin grant IDs.

For local real-auth bootstrap and ongoing onboarding, users can:
- Open the in-app registration page at `/register`, or
- call `POST /api/auth/register` directly with:
`{ userId, name, role, password, familyId? }`.

These now write to the local Prisma auth database (SQLite by default).

### Current routes (Phase 3.5)

- `/planner` – Weekly planner with Coffee/Breakfast/Lunch/School Lunch/Dinner slots, week navigation, demo meals, and a placeholder ingredient lane.
- `/recipes` – Simple Recipe Book listing demo recipes with search.
- `/recipes/[id]` – Recipe detail view with ingredients, steps, and an “add to planner” flow for the current week.
- `/school-lunch/child` – Child School Lunch view with pending-approval UX for requestors.
- `/school-lunch/adult` – Adult School Lunch review and approve/reject workflow.
- `/school-lunch/adult/policies` – Authenticated adult policy controls for child edit permissions.
- `/login` – Mock auth session login used for dev/demo.
- `/logout` – Session clear and signed-out redirect.
- `/register` – Create a real account (username, password, role, optional family ID).
- `/api/auth/session` – Real-auth session introspection endpoint backed by NextAuth.
- `/api/auth/signin` – Credential sign-in compatibility endpoint for adapter fallback.
- `/api/auth/signout` – Real-auth session clear endpoint with NextAuth cookie cleanup.
- `/api/auth/refresh` – Real-auth session renewal endpoint.
- `/api/auth/policy` – Authorized admin endpoint to update child `editPolicy`.
- `/api/auth/register` – Register a username/password/role in the local Prisma auth store (development bootstrap).
- `/account` – Authenticated user account settings and password update.
- `/admin` – Protected admin dashboard for user/family overview.
- `/admin/users` – Admin users directory listing.
- `/admin/families` – Admin families directory listing.
- `/api/auth/[...nextauth]` – NextAuth.js provider bootstrap (credentials flow) and session machinery.

### Auth & route protection (Phase 3.5)

- Added session boundary layer in `src/lib/auth/` with mock gateway + session state helpers.
- Added route gate with `proxy.ts` (Next.js replacement for `middleware.ts`) to protect school-lunch routes.
- Added missing session hardening:
  - missing/invalid sessions normalize to guest on startup and in route checks,
  - `signOut` is terminal and clears persisted session state.
- Added focused route policy tests in `tests/proxy.test.ts`.
- Expanded implementation planning with `Phase 3.6` for real auth adapter migration.
- `realAuthGateway` can now target `/api/auth/*` endpoints when `NEXT_PUBLIC_USE_REAL_AUTH=true`, with NextAuth-backed session checks in `/api/auth/session`.
- NextAuth credential verification in real mode now supports:
  - `NEXT_PUBLIC_DEMO_AUTH_PASSWORD` / `NEXTAUTH_DEMO_PASSWORD` fallback password, and
  - `NEXTAUTH_IDENTITY_CREDENTIALS` for per-user password overrides (JSON map by user id).


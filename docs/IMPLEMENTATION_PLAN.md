# MenuPlanner – Implementation Plan (Cursor Phases)

This plan breaks implementation into vertical phases for use with Cursor AI. Each phase is end-to-end useful and adds quality (logging, tests, CI) progressively.

---

## Phase 0 – Project Prep & Foundations

**Goal**: Prepare the repository and tooling so that Phase 1 can focus only on building features, not project scaffolding.

### Features / tasks

- Repository hygiene:
  - Create a top-level `README.md` describing the app, tech stack, and how to run it.
  - Add a `.gitignore` appropriate for Node/Next.js/TypeScript.
  - Optionally add a `LICENSE` (even for personal use).
- Cursor / agents:
  - Create `AGENTS.md` to describe how Cursor AI should work in this repo:
    - Coding style preferences (TypeScript, React components, Tailwind usage).
    - Branch / commit patterns.
    - How to run tests and linting.
- Project structure:
  - Set up initial folders (even if empty or minimal):
    - `src/app` (Next.js routes),
    - `src/components`,
    - `src/lib` (utilities and logging),
    - `src/stores` (Zustand slices),
    - `src/types` (shared types/interfaces),
    - `tests` (unit/component tests).
- Logging:
  - Implement `src/lib/log.ts` with:
    - `log.info`, `log.warn`, `log.error`.
    - Standard shape: `{ module, message, data }` and environment-aware behavior (e.g., only verbose logs in development).
- Testing:
  - Configure Jest or Vitest + React Testing Library.
  - Add a trivial sample test (e.g., a dummy component) to prove the setup works.
- CI/CD:
  - Create a basic GitHub Actions workflow that:
    - Checks out code.
    - Installs dependencies.
    - Runs `npm test` and `npm run lint`.
- Git workflow:
  - Initialize the git repository if not already.
  - Make the **initial commit** capturing:
    - `README.md`, `.gitignore`, `AGENTS.md`, initial folder structure, logging & testing setup, and CI workflow.
  - Tag this commit logically (e.g., `v0.0.0-initial-setup`) if desired.

---

## Phase 1 – Project Scaffold & “Toy” Planner

**Goal**: Simple weekly planner view with a few hardcoded meals.
**Status**: Implemented on branch `feature/phase1-planner-scaffold` with a working weekly grid, demo meals, and basic detail panel.

### Features

- `/planner`:
  - Current week only (no users/families).
  - Fixed slots: Coffee, Breakfast, Lunch, Dinner.
  - Grid layout with `MealChip` components in cells, backed by a small in-memory planner store.
- `MealChip`:
  - Tap opens a `MealDetailPanel` with placeholder info (Phase 1 stub).
- In-memory recipe list to populate demo meals.

### Tech & tooling

- Initialize Next.js (TypeScript) + Tailwind CSS. ✅
- Add Zustand with minimal `plannerStore` and `recipesStore` for demo meals and recipe summaries. ✅
- **Logging v1**:
  - `src/lib/log.ts` with `log.info/warn/error` wrapping `console.log`, including a consistent prefix and optional context object.
- **Testing v1**:
  - Jest or Vitest + React Testing Library.
  - Initial tests currently cover:
    - `getCurrentWeekDays` helper for week computation.
    - `log` utility behavior.
  - A future improvement (optional) is to add a React component test for the `/planner` page once the Jest config is aligned with Next’s JSX transform out of the box.
- **CI v1 (GitHub Actions)**:
  - Workflow: run `npm test` and `npm run lint` on push/PR.
- **Git usage**:
  - Branch: `feature/phase1-planner-scaffold`.
  - Small commits: grid layout, meal chip, detail panel.

---

## Phase 2 – Real Planner & Basic Recipe Book

**Goal**: Plan real meals for a week and browse recipes.
**Status**: Implemented on branch `feature/phase2-planner-and-recipes` with week navigation, a configurable School Lunch slot, a basic ingredient lane placeholder, and a simple Recipe Book.

### Features

- `/planner`:
  - True **current week** (using JS date).
  - Configurable week start (Sunday/Monday) in settings.
  - Configurable `MealSlotConfig` (includes School Lunch, but as a simple slot for now). *(Currently modeled as a fixed `MEAL_SLOTS` array that includes "School Lunch"; full per-family configuration will come in later phases.)*
  - Ingredient lane placeholder showing “N leftover items” from mock data. *(Implemented as a simple counter surfaced under the planner grid.)*
- `/recipes`:
  - Recipe list with search/filter by name.
  - `/recipes/[id]` showing ingredients and steps (single version).
- From recipe detail:
  - Add recipe to a date + slot on planner.

### Tech & tooling

- Expand Zustand:
  - `plannerStore`: calendar entries, slots (including School Lunch), week navigation (previous/next/this week), and a simple mock leftover count.
  - `recipesStore`: recipe list, ingredients, steps, and lookup.
- **Logging v2**:
  - Add module categorization: `log.info({ module: "planner", ... })`. *(Used when adding meals to the planner from the recipe detail page.)*
- **Testing v2**:
  - Planner tests:
    - Add/remove meal in a slot. *(Partially covered by store tests and will be expanded in later phases.)*
  - Recipe tests:
    - Filter list, open details. *(Currently covered by store-level tests for `recipesStore`; UI-level tests can be added later once Jest is further aligned with Next.js JSX transforms.)*
- **CI v2**:
  - Add `npm run build` to workflow. ✅

---

## Phase 3 – Families, Users & School Lunch Approvals

**Goal**: Support adults/children, families, and School Lunch approval flow.
**Status**: Implemented and aligned with the session-aware rework.

### Features

- Basic auth/family model:
  - Hardcoded users (Mom, Dad, Sarah, Elizabeth, Daniel, Elijah).
  - One `FamilyGroup` with these members.
  - “Switch user” menu in top bar.
- Child edit policies:
  - `Membership` includes `editPolicy: free | approval_required | no_edit`.
- Calendar approvals:
  - For `approval_required` children:
    - Their edits become pending until adult review.
    - UI shows original choice crossed out and proposed choice underlined/italicized.
    - Adults see **Approve / Reject**; decision updates actual meal.
- School Lunch structure & views:
  - `SchoolLunchEntry` type tied to School Lunch slot.
  - `/school-lunch/child`:
    - Child sees week of School Lunch slots.
    - Per day: choose home lunch recipe or School Hot Lunch.
    - Submit week for review.
  - `/school-lunch/adult`:
    - All children’s weeks in sections.
    - **Approve All** per child.
    - Per-day approvals/rejections + comments.
    - Ability to tweak a day even post-approval.

### Tech & tooling

- New Zustand slices:
  - `authAndFamilyStore`: current user, family, memberships.
  - `schoolLunchStore`: per-child school lunch data layered on planner.
- **Logging v3**:
  - Structured events:
    - `schoolLunch.submitted`
    - `schoolLunch.approved`
    - `schoolLunch.rejected`
  - Always include `userId`, `familyId`, `childId` when relevant.
- **Testing v3**:
  - Logic tests:
    - PendingChange creation and resolution.
  - Component tests:
    - Child and adult School Lunch pages.
- CI: unchanged, more tests only.

---

## Phase 3.5 – Auth Foundation & Migration Hook

**Goal**: Add a mock-to-real authentication/session seam now, so Phase 3 rework can complete without risky rewrites later.

### Features

- Auth/session boundary:
  - Add lightweight mock login/logout pages (`/login`, `/logout`) and session state.
  - Keep current hardcoded users/family in mock source data, but route all active-user reads/writes through session service functions.
  - Preserve role context (`adult`/`child`) and `currentFamilyId` via session selectors.
- Migration hook:
  - Add a simple auth gateway contract:
    - `src/lib/auth/session.ts` (session lifecycle and selectors).
    - `src/lib/auth/authGateway.ts` (interface + `mockAuthGateway` + `realAuthGateway` adapter shape).
  - Define explicit seam points in stores/UI:
    - `getSessionActor()` helper in one shared module.
    - Session-based action input for any user-affecting mutation.
  - Ensure switching to real auth later is a migration task that swaps persistence + gateway + verified session decoding, not store contracts.
- Layout and route integration:
  - Rework top-level shell to include a temporary session switch control for mock mode.
  - Add role checks for `/school-lunch/child` and `/school-lunch/adult`.
- Hardening:
  - Add `proxy.ts` route enforcement so school-lunch routes require an active session and adult routes require an adult actor.
  - Keep proxy checks narrowly focused on request boundary authorization (is authenticated + has required actor role), with policy enforcement delegated to store/UI logic.
- School Lunch + policies rework:
  - Ensure child/plan actions are session- and policy-aware:
    - `free`: immediate updates.
    - `approval_required`: pending/approval-required path.
    - `no_edit`: blocked actions with clear reason.
  - Ensure child choice updates are not approximated via approval actions.
- Ensure all mutation actions (`addMeal`, `setDayChoice`, `submitPlan`) require a session actor; no anonymous write path.
- Logging v3.5:
  - Keep event names: `schoolLunch.submitted`, `schoolLunch.approved`, `schoolLunch.rejected`.
  - Include actor/family context: `actorUserId`, `familyId`, and `childId` where relevant.
  - Log invalid/missing session restoration attempts in `auth` module with redacted identifiers for diagnostics.
- Testing:
  - Add unit tests for auth gateway/session contracts and route policy checks.
  - Add/adjust component tests for `/login`, child day-choice updates, and policy restrictions.

### Additional hardening
- Treat missing storage/session as guest: app starts unauthenticated unless an explicit session exists.
- Keep mock-session switch as development-only (no-op in production/runtime hardening mode).

### Acceptance criteria

- Mock users can sign in, switch identity, and access only the correct School Lunch routes.
- Existing demo data works without rewriting core Phase 3 stores directly; only auth session/adapters are extended.
- Child edit actions in school-lunch/planner behave according to `editPolicy`.
- New or updated logs include actor/family context and consistent event names.
- Swapping to real auth later is a local replacement of adapter code, not a store refactor.
- Proxy and route checks remain stable when swapping auth adapters.

---

## Phase 3.6 – Real Auth Adapter & Session Hardening

**Goal**: Replace mock auth compatibility layer with a real, production-grade auth integration while preserving existing store contracts.

### Features

- Production gateway integration:
  - Implement `realAuthGateway` against actual identity system of choice.
  - Replace `localStorage` session persistence in production mode with secure session transport (signed cookie or server session).
  - Ensure `restoreSession`, `signIn`, and `signOut` are backed by real tokens.
  - 2026-03-10 update: integrated `NextAuth.js` with credentials provider under `src/lib/auth/nextAuth.ts` and `src/app/api/auth/[...nextauth]/route.ts`.
  - 2026-03-10 update: added Prisma SQLite auth identity store (`prisma/schema.prisma`) and migrated credential verification + registration persistence to DB-backed records with hashed passwords.
- Canonical session verification:
  - Validate actor identity and family membership from server-auth source or signed claims.
  - Ensure `proxy.ts` and app route checks use verified actor metadata.
  - In real-auth mode, `GET /api/auth/session` and `POST /api/auth/refresh` now use `authIdentity.server` lookup to re-check user family membership.
  - Normalize family membership mismatches to unauthenticated/guest state.
- Real login flow:
  - Move from mock-select switch to actual login UX (credentials/OAuth/SSO as needed).
  - Keep `/login`, `/logout` pages and route redirect behavior (`redirectTo`) intact.
  - Preserve existing acceptance flow to `/planner` and school-lunch routes.
  - Add user-facing self-registration at `/register` (username, password, role, optional family ID) and connect it to `POST /api/auth/register` + immediate sign-in.
- Security hardening:
  - Add session expiry/rotation handling.
  - Define cookie policy (`Secure` + `SameSite` + `HttpOnly`) and CSRF-safe mutation entry points.
  - Add explicit migration behavior for stale/invalid sessions.
  - For mock/local mode, strengthen session cookie transport by normalizing max-age/expiry flags and secure attributes where supported.
  - Add production deployment requirements for `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `NEXTAUTH_TRUST_HOST`.

### Tech & tooling

- Session seam:
  - Keep `session.ts`, `authGateway.ts`, and actor helper API unchanged for calling sites.
  - Document how to swap from mock to real adapter without touching planners/stores.
- Route guard:
  - Confirm `proxy.ts` remains the boundary gate for protected routes and is covered by contract tests.
  - Expand route guard checks to all private routes as product privacy requirements expand.
- Logging:
  - Add real-auth specific logs:
    - `auth.refresh`,
    - `auth.tokenInvalid`,
    - `auth.signInFailure`.

### Testing

- Auth contract tests:
  - Real gateway adapter contract tests (or test doubles) for restore/signIn/signOut.
  - Session expiry/invalid token behavior with forced logout.
- Route-policy tests:
  - Proxy tests for missing, expired, and invalid sessions.
  - Confirm role-gating remains stable with non-cookie local state.
- Regression:
  - Run all existing phase 3/3.5 store and UI tests unchanged (no behavioral regression).

### Implementation checklist (execution-ready)

- [x] Add auth provider bootstrap:
  - Add environment switches to select `mock` vs `real` auth provider.
  - Add `realAuthGateway` implementation that returns standardized `AuthSessionRecord`.
  - Integrate `NextAuth.js` bootstrap and route handler in `src/lib/auth/nextAuth.ts` and `src/app/api/auth/[...nextauth]/route.ts`.
  - Add DB-backed identity source (`Prisma` + local `SQLite`) for credentials verification and registration.
  - Add documented credential configuration (`.env.example`) for:
    - `NEXTAUTH_IDENTITY_CREDENTIALS`
    - `NEXTAUTH_SECRET`
    - `NEXTAUTH_URL`
    - `NEXTAUTH_TRUST_HOST`
  - Added local registration bootstrap via `POST /api/auth/register` (Prisma-backed local identity source).
- [x] Adopt migration-based DB operations:
  - Add `db:migrate:dev` and `db:migrate:deploy` scripts for Prisma workflow.
  - Add initial migration in `prisma/migrations` for `AuthUser` schema bootstrap.
  - Update publish/runbook docs to use `prisma migrate deploy` for production schema changes.
- [x] Introduce verified session decoding path:
  - Add expiry-based canonical session validation in shared cookie parser and restore flow.
  - Keep mock mode compatibility for tests and local demo data.
  - (Token/claims verification remains a follow-on implementation item under the same checklist.)
- [x] Replace session persistence with secure transport in real mode:
  - Use signed/HTTP-only cookie or server session for `restoreSession` and `signOut`.
  - Ensure `clearSessionCookie`/equivalent behavior removes all auth artifacts on sign-out and invalid sessions.
  - Implemented `GET /api/auth/session` and `POST /api/auth/signout` against NextAuth session state.
- [x] Harden `signIn`/`signOut` flows:
  - Preserve redirect-to behavior from `/login?redirectTo=...`.
  - Ensure failed sign-in emits `auth.signInFailure` and stays on `/login`.
  - Preserve existing `/logout` endpoint semantics with hard terminal reset.
  - Added password-based login path in `src/app/login/page.tsx` for real mode.
- [x] Expand route protection:
  - Keep `/school-lunch/*` checks as baseline.
  - Add proxy guard coverage for missing/invalid/expired sessions.
  - Defer additional private-route coverage to the next privacy/visibility phase.
  - Added `tests/proxy-real-auth.test.ts` for NextAuth/JWT-backed token scenarios.
- [x] Add user-facing registration UX:
  - Added `/register` page with input validation and success/error states.
  - Kept compatibility with `/api/auth/register` and wired it to Prisma-backed real-auth identity creation.
  - Added focused component coverage in `tests/register-page.test.tsx`.
- [x] Add lifecycle hardening:
  - Add token refresh/expiry checks and refresh flow where applicable.
  - Add `auth.refresh` and `auth.tokenInvalid` logging paths.
- [x] Final migration cleanup:
  - Remove mock session-switch override from production shell.
  - Document a cutover checklist and rollback strategy in docs.
  - Switched real-mode login shell to username/password input (mock-selector retained in non-real mode).
- [ ] Cutover checklist (to run when real auth provider is ready):
  - switch `NEXT_PUBLIC_USE_REAL_AUTH` only via deployment environment,
  - remove seeded identity assumptions from login shell for production users (implemented with username/password real-mode entry),
  - keep mock auth paths intact for local development,
  - keep a rollback toggle for the same release branch if token issues appear.
  - verify `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `DATABASE_URL` are set in deployment and monitor launch failures.
- [x] Registration payload contract decision:
  - Keep `/api/auth/register` payload limited to `userId`, `name`, `role`, `password`, and optional `familyId`.
  - `editPolicy` remains derived from app/family policy, not user-provided at registration time.
- [ ] Validation pass:
  - [x] Execute full existing suite first (`npm test -- --runInBand`).
  - [x] Run proxy tests for missing/invalid/expired sessions.
  - [x] Add one manual verification: sign in as child/adult and confirm route boundary behavior end-to-end.

---

## Phase 3.7 – Auth Governance & Policy Control

**Goal**: Keep registration focused on identity while moving mutable permission policy to a controlled admin workflow.

### Features

- Add post-onboarding policy management:
  - Introduce an admin-only path to set `editPolicy` for child actors.
  - Keep `/api/auth/register` limited to identity creation only (`userId`, `name`, `role`, `password`, optional `familyId`).
  - Ensure policy cannot be self-assigned during sign-up.
- Add server-side guardrails:
  - Validate role/permission for policy writes with explicit actor checks.
  - Reuse existing family context checks from real-auth session sources.
- Add lightweight migration/cleanup:
  - Review seeded/demo identities and map existing children to default `editPolicy` values as needed.

### Testing

- Unit test for policy-assignment API authorization failures and success path.
- Regression test that `/api/auth/register` rejects unknown `editPolicy` payload fields (if strict parsing is enforced).
- Verify child policy updates are ignored unless request actor has admin permission.

### Implementation checklist (execution-ready)

- [x] Add policy management endpoint for authenticated admins/family managers.
- [x] Add service-level write path to persist `editPolicy`.
- [x] Add policy-change audit log event (actor user, target user, previous policy, next policy).
- [x] Add UI shell entry to expose policy controls only for authorized actors.
- [x] Add tests for authorization and policy update flow.

---

## Phase 3.8 – User Account Settings & Self-Service

**Goal**: Give signed-in users a dedicated place to view/update their identity and account settings, including secure password changes.

### Features

- Add user settings page:
  - Route: `/account` (authenticated only, no admin requirement).
  - Show current identity snapshot: display name, user ID, family ID, role, family-related fields, and session context.
  - Provide editable fields for user-safe values (initially: display name, display preferences).
- Add password-management workflow:
  - Current-password + new-password + confirmation inputs.
  - Strong local validation (length and confirmation match).
  - Call server action/API to rotate credentials using current auth session.
  - Show success and scoped failure messaging.
- Add family settings surface for non-admin family members:
  - Show current family join/defaults/settings values.
  - Allow safe family fields relevant to the member role (no cross-family impact, no permission escalation).
- Add API surface:
  - `GET/PUT /api/auth/me` (or equivalent) for user profile read/write.
  - `POST /api/auth/me/password` for password rotation.
  - Use session actor from verified session source; deny mismatched actor operations.
- Add settings navigation:
  - Add authenticated user menu entry in `SiteShell` to `/account`.
  - Add logout/session timeout and error handling messages as part of settings UX.

### Tech & tooling

- Data boundaries:
  - Add a dedicated settings service layer (or extend existing auth identity service) for profile and password mutation.
  - Keep API payloads strict and validated (no unknown top-level keys).
- Security/UX:
  - Re-authenticate-sensitive operations where appropriate (current password required).
  - Return generic errors for failures to avoid leakage.
- Testing:
  - Add auth settings API tests for:
    - non-authenticated access denied,
    - wrong current-password rejection,
    - successful update + persisted value checks.
  - Add `tests/account-page.test.tsx` for form behavior and state transitions.
  - Keep existing auth/session suites unchanged.

### Implementation checklist (execution-ready)

- [ ] Add `/account` page with authenticated route protection.
- [ ] Add profile read/update API path and persistence path.
- [ ] Add secure password rotation API path with current-password verification.
- [ ] Add session-based validation guardrails for all account writes.
- [ ] Add audit logging for account settings updates (`account.profileUpdated`, `account.passwordChanged`).
- [ ] Add focused tests for account read/update/password flows.
- [ ] Add `SiteShell` link and access to `/account`.

---

## Phase 3.9 – Admin Console & Cross-Entity Management

**Goal**: Introduce an admin plane for global visibility and write control across users, families, recipes, planner data, and school-lunch records.

### Features

- Define admin authorization model:
  - Add explicit admin role/capability to session/auth identity (`systemRole` or admin entitlement claim).
  - Keep backward compatibility with existing adult/child behaviors; admin is an explicit override set.
- Add protected admin route surface:
  - Route: `/admin`.
  - Add `proxy.ts` enforcement for admin-only access (`/admin/*`).
  - Add role-aware navigation entry points.
- Add cross-user/family visibility pages:
  - Users directory (all users, families, memberships).
  - Families directory (family details, members, active/inactive settings).
  - Recipe catalog management (global create/edit/delete with audit trail as features are expanded).
  - Planner and School Lunch cross-entity visibility for reporting and support scenarios.
- Add cross-entity mutation capabilities (phased):
  - Start with read-only + manual support actions.
  - Add controlled write actions:
    - move user between families,
    - edit user role/family assignment,
    - update family metadata and policy defaults,
    - override child school-lunch/planner state for support/debug use.
- Add admin audit:
  - Add structured log events for admin actions and previous/new values.
  - Log actor, target, and operation context (userId/familyId/planId/resourceId).

### Tech & tooling

- Data and policy:
  - Reuse existing auth/session seam so admin checks remain centralized at request boundary and policy checks remain service-level.
  - Add admin-scoped service methods for users/families/plans/recipes to avoid store mutation leaks.
  - Add soft guards for irreversible actions and explicit confirmation UX.
- Testing:
  - Add API integration tests for:
    - admin requirement enforcement,
    - cross-family/user mutation denied for non-admin,
    - successful cross-entity updates with state transitions.
  - Add admin UI smoke tests for list + detail + action controls.
- Documentation:
  - Add a short “admin capabilities matrix” section in `README.md` with safe role expectations.

### Implementation checklist (execution-ready)

- [ ] Add admin capability in auth/session identity model.
- [ ] Protect `/admin/*` in route proxy with explicit admin actor checks.
- [ ] Build admin dashboard entry and base list views for users/families.
- [ ] Add read-only cross-entity admin views for recipes/planner/school-lunch.
- [ ] Add first-stage cross-entity mutation actions with confirmation.
- [ ] Add audit events for admin mutation paths.
- [ ] Add focused admin policy/test coverage.

---

## Phase 4 – Ingredient Lane, Leftovers & Basic Nutrition

**Goal**: Make planner ingredient-aware; implement Ingredient Lane, leftovers, and initial nutrition.

### Features

- Ingredient & leftovers:
  - `IngredientBalance` and `LeftoverBatch` in `plannerStore`.
  - Lane shows:
    - Leftovers (ingredient, quantity, expiration, source meal).
    - Disappearance when consumed or expired.
- LeftoverOpportunityPrompt:
  - When scheduling/editing meal that could use a leftover:
    - Offer “Use leftover + cook less” vs “Discard leftover + cook full”.
- Basic nutrition:
  - Mock `NutritionProfile` per ingredient.
  - Compute per-recipe and per-serving nutrition.
  - Display `NutritionSummary` on Meal Detail.

### Tech & tooling

- Pure functions:
  - `computeIngredientBalance(...)`, `computeLeftoverBatches(...)`.
- **Persistence**:
  - Use Zustand persistence (e.g., `persist` middleware with `localStorage`) so planner, recipes, and leftovers survive full page reloads and browser restarts, at least for a single device/household.
- **Logging**:
  - Log leftover lifecycle:
    - created / consumed / expired.
- **Testing**:
  - Rice scenarios A/B/C.
  - Prompt behavior when leftovers partially meet recipe requirements.
  - Ingredient Lane snapshot tests for a known week.

---

## Phase 5 – Recipe Versioning, Sub-Recipes, Ratings & Usage Stats

**Goal**: Enable evolving recipes and sub-recipes with feedback.

### Features

- Versioning:
  - `RecipeVersion` + `RecipeVersionHistory` in `recipesStore`.
  - Modify → auto-create vN+1 and add `RecipeTestRecord`.
- Sub-recipes:
  - `SubRecipeRef` & `SubRecipeChip`.
  - Editing shared sub-recipe:
    - Prompt to update all dependents or fork a new version.
  - `SubRecipeVersionPicker`:
    - Shows current version.
    - Diff vs previous version.
    - Switch to another version.
- Ratings & usage:
  - `RecipeRatingWidget` (thumbs up/down per user, including creator).
  - `UsageStats`:
    - Times recipe added to calendar.
    - Times it remains past date (treated as cooked).
- School Lunch “Forgot Lunch At Home”:
  - When selected for a day:
    - Offer to remove next day’s lunch (except Friday→Monday) and reuse.

### Tech & tooling

- Extend `recipesStore` for versions, sub-recipes, ratings, stats.
- **Logging**:
  - `recipe.versionCreated`
  - `recipe.subRecipeUpdated`
  - `recipe.rated`
- **Testing**:
  - Version creation.
  - Sub-recipe propagation vs fork.
  - Ratings aggregation and usage counter behavior.

---

## Phase 6 – Public Calendar View, Polish & Deployment

**Goal**: Make daily use pleasant and set up deployable CI/CD.

### Features

- Public vs private calendars:
  - `CalendarConfig.visibility`:
    - `public`: shareable `/public/[familyToken]` view-only planner.
    - `private`: auth required for view/edit.
- UI polish:
  - Responsive tuning.
  - Smooth transitions.
  - Final visual tweaks.

### Tech & tooling

- Logging:
  - Stabilize event names and data shapes for easier future analysis.
- End-to-end tests (optional but ideal):
  - Planner + Ingredient Lane core flows.
  - School Lunch child → adult approval path.
- CI/CD:
  - GitHub Actions:
    - Jobs: `lint`, `test`, `build` on `main`.
    - Deploy to chosen host (e.g., Vercel) on push to `main` or tags.
    - Add deployment-time auth checks:
      - required environment variables for real auth provider,
      - smoke check for protected route redirect behavior.
  - Optional preview deployments per PR.

---

## Git Practices

- **Branches**: one feature-focused branch per chunk (e.g., `feature/phase4-ingredient-lane`).
- **Commits**: small, descriptive, and focused; keep `main` always buildable and deployable.


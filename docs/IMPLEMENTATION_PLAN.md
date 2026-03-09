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

### Features

- `/planner`:
  - Current week only (no users/families).
  - Fixed slots: Coffee, Breakfast, Lunch, Dinner.
  - Grid layout with `MealChip` components in cells.
- `MealChip`:
  - Tap opens a `MealDetailPanel` with placeholder info.
- In-memory recipe list to populate demo meals.

### Tech & tooling

- Initialize Next.js (TypeScript) + Tailwind CSS.
- Add Zustand with minimal `plannerStore` and `recipesStore`.
- **Logging v1**:
  - `src/lib/log.ts` with `log.info/warn/error` wrapping `console.log`, including a consistent prefix and optional context object.
- **Testing v1**:
  - Jest or Vitest + React Testing Library.
  - Smoke tests:
    - `/planner` renders week grid.
    - Clicking a meal opens detail panel.
- **CI v1 (GitHub Actions)**:
  - Workflow: run `npm test` and `npm run lint` on push/PR.
- **Git usage**:
  - Branch: `feature/phase1-planner-scaffold`.
  - Small commits: grid layout, meal chip, detail panel.

---

## Phase 2 – Real Planner & Basic Recipe Book

**Goal**: Plan real meals for a week and browse recipes.

### Features

- `/planner`:
  - True **current week** (using JS date).
  - Configurable week start (Sunday/Monday) in settings.
  - Configurable `MealSlotConfig` (includes School Lunch, but as a simple slot for now).
  - Ingredient lane placeholder showing “N leftover items” from mock data.
- `/recipes`:
  - Recipe list with search/filter by name.
  - `/recipes/[id]` showing ingredients and steps (single version).
- From recipe detail:
  - Add recipe to a date + slot on planner.

### Tech & tooling

- Expand Zustand:
  - `plannerStore`: calendar entries, slots, week navigation.
  - `recipesStore`: recipe list and lookup.
- **Logging v2**:
  - Add module categorization: `log.info({ module: "planner", ... })`.
- **Testing v2**:
  - Planner tests:
    - Add/remove meal in a slot.
  - Recipe tests:
    - Filter list, open details.
- **CI v2**:
  - Add `npm run build` to workflow.

---

## Phase 3 – Families, Users & School Lunch Approvals

**Goal**: Support adults/children, families, and School Lunch approval flow.

### Features

- Basic auth/family model:
  - Hardcoded users (Mom, Dad, Sarah, Elizabeth, Daniel, Elijah).
  - One `FamilyGroup` with these members.
  - “Switch user” menu in top bar.
- Child edit policies:
  - `Membership` includes `editPolicy: free | approval_required | no_edit`.
- Calendar approvals:
  - For `approval_required` children:
    - Their edits become `PendingChange`.
    - UI shows original meal crossed out, proposed meal underlined/italicized.
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
  - Optional preview deployments per PR.

---

## Git Practices

- **Branches**: one feature-focused branch per chunk (e.g., `feature/phase4-ingredient-lane`).
- **Commits**: small, descriptive, and focused; keep `main` always buildable and deployable.


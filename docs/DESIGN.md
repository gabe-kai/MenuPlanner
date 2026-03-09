# MenuPlanner – Product & UX Design

## 1. Problem & Goals

### 1.1 Problem statement

Families want an easy, touch-friendly way to collaboratively plan meals on a shared calendar, reuse and evolve recipes over time, automatically manage groceries and leftovers, and cook with confidence using consistent methods and nutrition awareness.

### 1.2 Primary goals

- **Touch-first planning**: Calendar-based planner with meal slots (Coffee, Breakfast, Morning Snack, Lunch, School Lunch, Afternoon Snack, Dinner, Evening Snack) across day/week/two-week/month views, optimized for tablets and touch laptops.
- **Rich meal details**: Each meal expands to show ingredients, recipe steps, prep relationships, cooking methods, and nutrition per recipe and per serving.
- **Ingredient lane & leftovers**: Visualize ingredient usage and leftovers over time, highlight opportunities to use expiring leftovers, and make it obvious when food will be wasted.
- **Smooth grocery workflow**: Derive grouped grocery lists from planned meals, allowing toggling of items and touch-friendly checkoff while shopping.
- **Evolving recipes**: Support recipe versioning, sub-recipes (e.g., seasoning mixes), ratings, test notes, and usage statistics so the family’s cooking knowledge improves over time.
- **Family-shared experience**: Multiple accounts (adults and children) share a family calendar and recipe book, with configurable child edit policies and approval flows.
- **School Lunch planning**: Dedicated flows for children to plan school lunches and for adults to review/approve or revise them efficiently.
- **Delightful UI**: Simple, modern UI that feels native on touch devices: large tap targets, clear typography, minimal chrome.

---

## 2. Target Devices, Tech Stack & Interaction Model

### 2.1 Devices & input

- **Devices**: Large tablets and touch-enabled laptops, primarily landscape.
- **Input**:
  - Primary: touch (tap, long-press, drag, swipe).
  - Secondary: keyboard/mouse.
- **Hit targets**: ≈44×44px minimum with generous spacing.

### 2.2 Layout assumptions

- **Main layout**:
  - **2–3 columns** on wide screens: calendar, detail pane, optional side panel.
  - **Single-column** adaptive layout on narrow viewports.
- **Calendar views**:
  - **Day**, **week**, **two-week**, and **month** views.
  - Each view has an aligned **Ingredient Lane** summarizing ingredient/leftover state at that zoom level.

### 2.3 Tech stack (front-end)

- **Framework**: React + TypeScript.
- **Routing / shell**: Next.js (App Router), SPA-style with SSR where helpful.
- **Styling**: Tailwind CSS + small custom component library for touch-friendly UI.
- **State management**:
  - Zustand slices for:
    - `auth-and-family`
    - `planner`
    - `recipes`
    - `school-lunch`
    - `sharing-and-approvals`
  - Optional React Query later for real APIs.
- **Mock backend**:
  - In-memory data layer (optionally `localStorage`-backed) simulating APIs for:
    - Auth & families
    - Planner & ingredient lane
    - Recipes & sub-recipes
    - School Lunch flows
    - Sharing & approvals

---

## 3. Core UX Flows

### 3.1 Meal planning on the calendar

- Add meals to a date and slot (Coffee, Breakfast, Morning Snack, Lunch, School Lunch, Afternoon Snack, Dinner, Evening Snack).
- Drag-and-drop meals between days/slots.
- Duplicate or shift days/weeks.
- Switch between day/week/two-week/month.

### 3.2 Meal card interaction

- Tap a `MealChip` to open `MealDetailPanel`:
  - **Summary**: title, tags, total time, diners.
  - **Ingredients**: scaled by servings, toggles for grocery inclusion.
  - **Recipe steps**: with inline `MethodLink`s for cooking methods.
  - **Prep links**: show related meals via `PrepBlock`s.
  - **Cooking methods**: `MethodSheet` explaining techniques (time, temp, cues).
  - **Nutrition**: `NutritionSummary` (per-recipe, per-serving).
  - **Versioning & sub-recipes**: current version, sub-recipes, version switchers.

### 3.3 Recipe versioning & sub-recipes

- **Recipe**: stable identity (e.g., “Daniel’s Sirloin Steaks”).
- **RecipeVersion**:
  - Steps, media, notes, default servings.
  - Optional `nutritionPerRecipe`, `nutritionPerServing`.
  - `versionNumber`, `createdAt`, `versionNotes`.
- Users can:
  - Modify a version → auto-create vN+1 and a `RecipeTestRecord` (date + notes).
  - Browse `RecipeVersionHistory` and choose which version a `Meal` uses.
- **Sub-recipes**:
  - Portions of a recipe (e.g., “Steakhouse Seasoning Mix”) promoted as standalone recipes via `SubRecipeRef`.
  - Editing a sub-recipe used by many parents prompts:
    - Update all dependents, or
    - Fork a new sub-recipe version.
  - `SubRecipeVersionPicker` in parent recipes:
    - Shows current sub-recipe version.
    - Highlights differences vs previous versions.
    - Allows switching to another sub-recipe version.

### 3.4 Recipe book browsing

- **RecipeBookView**:
  - Grid/list of recipes: name, tags, last cooked date, current version, rating.
- Filters/sorting:
  - Name, last cooked, popularity, tags, meal type, diet, equipment.
- From a recipe:
  - View details.
  - Choose a version.
  - Add to planner as a meal.

### 3.5 Ingredient & grocery flow

- From a selected range (e.g., week), derive a **GroceryList**:
  - Merge ingredients by name/unit.
  - Group by category (produce, dairy, pantry, etc.).
- Users can:
  - Toggle ingredients (already have, don’t need).
  - Check off items with large touch checkboxes while shopping.

### 3.6 Prep-linking flow

- Mark steps as **prep-once, use-many** via `PrepBlock`s.
- Planner shows:
  - Which meals share each prep block.
  - Prep reminders on earlier days when common prep is scheduled.

### 3.7 Ingredient lane & leftovers

- **Ingredient Lane**:
  - Appears below the calendar grid in all views.
  - Summarizes ingredient usage, leftovers, and expirations.
- **LeftoverBatch**:
  - Ingredient, quantity, created date, expiration date, source meal.
- Scenarios:
  - **Scenario A**:
    - Friday dinner produces `LeftoverBatch`: 1 cup rice, expires Monday.
    - Monday lunch burrito bowls require 1 cup rice.
    - Lane shows batch consumed at Monday lunch; disappears afterward.
  - **Scenario B**:
    - Same leftover; Monday uses no rice.
    - Batch remains visible through Monday, disappears at end-of-day as expired.
  - **Scenario C**:
    - Monday dinner burrito bowls require 3 cups rice.
    - Lane + `LeftoverOpportunityPrompt` show:
      - Only 1 cup leftover.
      - Options:
        - Use leftover + cook 2 cups new.
        - Discard leftover + cook all 3 cups fresh.
    - Prompt appears both when adding that meal and when inspecting the lane.

### 3.8 Users, families & shared calendars

- **User**:
  - Adult or child.
- **FamilyGroup**:
  - Shared planner, grocery lists, recipe book.
- **CalendarConfig**:
  - Visibility: `public` or `private`.
- Public:
  - Shareable link shows read-only planner + details.
- Private:
  - Auth + membership required, even for viewing.

### 3.9 Child editing & approvals

- Child memberships have edit policies:
  - `free`, `approval_required`, `no_edit`.
- For `approval_required`:
  - Child edits become `PendingChange`.
  - Planner shows:
    - Original meal crossed out.
    - Proposed meal underlined/italicized.
  - Adults see **Approve / Reject**:
    - Approve → apply change.
    - Reject → revert to original.
  - Changes logged in `EditLog`.

### 3.10 Onboarding & default view

- First run:
  - Land on `/planner` for current week.
  - Use configured week start (Sunday/Monday).
  - Show default meal slots and Ingredient Lane.
  - Prominent link to Recipe Book.
- Settings:
  - Week start.
  - Default meal slots (labels, colors).

### 3.11 School Lunch planning & approvals

- **Child view** (`/school-lunch/child`):
  - Child sees weekly School Lunch slots.
  - Per day: choose home recipe or “School Hot Lunch”.
  - Submit week for review.
- **Adult view** (`/school-lunch/adult`):
  - Each child in its own section.
  - Actions:
    - **Approve All** per child.
    - Approve/reject individual days with comments.
    - Modify a day directly, even post-approval.
  - Children see comments, revise, resubmit.
  - Approval history retained.

---

## 4. Example User Stories

- **Leftover rice**:
  - Three scenarios as described above (A/B/C).
- **Eli’s Sandwich**:
  - Eli modifies v2 → v6, adds Cheetos, tests it, rates it.
  - Other family members rate v6.
  - `UsageStats` track planned vs cooked counts.
  - School Lunch entries with “Forgot Lunch At Home” can offer to reuse lunch by removing the next day’s lunch (except Friday→Monday).
- **Daniel’s Steakhouse seasoning**:
  - Editing a shared seasoning sub-recipe prompts:
    - Update dependent steak recipes, or
    - Fork new seasoning sub-recipe version.
  - Opening those steak recipes later:
    - Shows current seasoning version.
    - `SubRecipeVersionPicker` compares with previous version and lets users switch.

---

## 5. Information Architecture & Data Model (Summary)

Core concepts (front-end):

- **Planner / calendar**:
  - `Meal`, `MealSlotConfig`, `CalendarEntry`, `CalendarConfig`, `PrepBlock`.
- **Ingredients & leftovers**:
  - `Ingredient`, `IngredientBalance` (derived), `LeftoverBatch`, `GroceryList`.
- **Recipes**:
  - `Recipe`, `RecipeVersion`, `RecipeStep`, `SubRecipeRef`, `RecipeRating`,
    `RecipeTestRecord`, `UsageStats`, `CookingMethod`, `NutritionProfile`.
- **Users & families**:
  - `User` (adult/child), `FamilyGroup`, `Membership`, `EditLog`, `PendingChange`,
    `SchoolLunchEntry`.

---

## 6. Key Screens

- `/planner`: Planner grid + Ingredient Lane + detail panel.
- `/recipes`: Recipe Book / Meal Library.
- `/recipes/[id]`: Recipe detail with versions, sub-recipes, methods, nutrition, ratings, test logs.
- `/school-lunch/child`: Child School Lunch planner.
- `/school-lunch/adult`: Adult School Lunch approvals.
- `/settings`: Week start, meal slots, personal preferences.
- `/family`: Family members, roles, child edit policies, calendar visibility, public links.


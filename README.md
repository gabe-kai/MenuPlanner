# MenuPlanner

Touch-first family meal and grocery planner with a shared calendar, recipe book, ingredient lane, leftovers tracking, and School Lunch planning/approval flows.

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

_Implementation is being brought up in phases. Phases 0–2 are in progress; the commands below are already available._

### Commands

- `npm run dev` – Start the Next.js dev server (default at `http://localhost:3000`).
- `npm run build` – Create a production build.
- `npm start` – Run the production build.
- `npm test` – Run unit tests (Jest).
- `npm run typecheck` – Run TypeScript type checking.
- `npm run lint` – Run linters (currently a placeholder echo).

### Current routes (Phase 2)

- `/planner` – Weekly planner with Coffee/Breakfast/Lunch/School Lunch/Dinner slots, week navigation, demo meals, and a placeholder ingredient lane.
- `/recipes` – Simple Recipe Book listing demo recipes with search.
- `/recipes/[id]` – Recipe detail view with ingredients, steps, and an “add to planner” flow for the current week.


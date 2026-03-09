# Agents Guide for MenuPlanner

This repository is built with help from AI coding agents (Cursor). This guide explains how agents should work here.

## Goals

- Keep the app maintainable and predictable for a single-household, long-lived project.
- Prefer small, vertical increments following the phases in `docs/IMPLEMENTATION_PLAN.md`.
- Respect the product design in `docs/DESIGN.md`.

## Tech & style

- **Language**: TypeScript everywhere.
- **Framework**: React + Next.js (App Router).
- **Styling**: Tailwind CSS; avoid ad-hoc inline styles unless necessary.
- **State**: Zustand slices under `src/stores/`.
- **Utilities**: Shared helpers under `src/lib/`.

## Logging

- Use `src/lib/log.ts` for all non-trivial logging.
- Prefer structured logs:
  - `log.info({ module: "planner", message: "meal added", data: { date, slot, mealId } })`.
- Avoid sprinkling raw `console.log` calls.

## Testing

- Use Jest/Vitest + React Testing Library.
- Co-locate tests under `tests/` mirroring `src/` structure.
- For new features:
  - Add at least one unit or component test covering the main behavior.

## Phased implementation

- Follow the phases in `docs/IMPLEMENTATION_PLAN.md`:
  - Phase 0: project prep, logging, testing, CI.
  - Phase 1+: feature work (planner, recipes, families, ingredient lane, etc.).
- Avoid jumping ahead several phases in a single PR/branch.

## Git habits

- Keep commits small and descriptive.
- Keep `main` buildable and deployable at all times.
- Use feature branches like:
  - `feature/phase1-planner-scaffold`
  - `feature/phase3-school-lunch-child`

## Non-goals

- No premature optimization or over-engineering for scale beyond this household.
- No backend implementation in this repo yet; treat data as coming from a mock layer.


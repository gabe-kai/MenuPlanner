"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MealChip } from "@/components/MealChip";
import { MealDetailPanel } from "@/components/MealDetailPanel";
import {
  computeIngredientBalance,
  computeLeftoverBatches,
  type IngredientBalance,
  type LeftoverBatch,
} from "@/lib/ingredientLane";
import { usePlannerStore, MEAL_SLOTS } from "@/stores/plannerStore";
import { useRecipesStore } from "@/stores/recipesStore";
import { getCurrentWeekDays } from "@/lib/week";

export default function PlannerPage() {
  const {
    weekOffset,
    weekStart,
    meals,
    selectedMealId,
    selectMeal,
    nextWeek,
    previousWeek,
    resetWeek,
  } = usePlannerStore();
  const { getRecipeById, recipes } = useRecipesStore();
  const recipesById = useMemo(
    () =>
      recipes.reduce(
        (acc, recipe) => {
          acc[recipe.id] = recipe;
          return acc;
        },
        {} as Record<string, (typeof recipes)[number]>,
      ),
    [recipes],
  );

  const leftovers: LeftoverBatch[] = useMemo(
    () => computeLeftoverBatches(meals, recipesById),
    [meals, recipesById],
  );
  const ingredientBalances: IngredientBalance[] = useMemo(
    () => computeIngredientBalance(meals, recipesById, leftovers),
    [meals, recipesById, leftovers],
  );

  const visibleLeftoverCount = leftovers.length;

  const referenceDate = useMemo(() => {
    const base = new Date();
    const shifted = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + weekOffset * 7,
    );
    return shifted;
  }, [weekOffset]);

  const weekDays = useMemo(
    () => getCurrentWeekDays(referenceDate, weekStart),
    [referenceDate, weekStart],
  );

  const selectedMeal = useMemo(
    () => meals.find((m) => m.id === selectedMealId) ?? null,
    [meals, selectedMealId],
  );
  const selectedRecipe = selectedMeal
    ? getRecipeById(selectedMeal.recipeId)
    : undefined;

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Planner</h2>
          <p className="text-sm text-slate-400">
            Phase 2 planner – current week view with fixed Coffee/Breakfast/
            Lunch/School Lunch/Dinner slots and a few demo meals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 p-0.5">
            <button
              type="button"
              className="rounded-full px-3 py-1 font-medium text-slate-200 hover:bg-slate-800"
              onClick={previousWeek}
            >
              ◀ Prev
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1 font-medium text-slate-200 hover:bg-slate-800"
              onClick={resetWeek}
            >
              This week
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1 font-medium text-slate-200 hover:bg-slate-800"
              onClick={nextWeek}
            >
              Next ▶
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            {weekDays[0]?.label} – {weekDays[6]?.label}
          </span>
          <Link
            href="/recipes"
            className="ml-2 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            Open recipe book
          </Link>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Slot
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.key}
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  <div>{day.weekday}</div>
                  <div className="text-[10px] text-slate-500">{day.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_SLOTS.map((slot) => (
              <tr key={slot} className="border-t border-slate-800">
                <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left text-xs font-medium text-slate-300">
                  {slot}
                </th>
                {weekDays.map((day) => {
                  const cellMeals = meals.filter(
                    (m) => m.dayKey === day.key && m.slot === slot,
                  );

                  return (
                    <td
                      key={day.key}
                      className="h-24 border-l border-slate-800 px-2 py-2 align-top"
                    >
                      <div className="flex h-full flex-col gap-2">
                        {cellMeals.map((meal) => (
                          <MealChip
                            key={meal.id}
                            meal={meal}
                            recipe={getRecipeById(meal.recipeId)}
                            isSelected={meal.id === selectedMealId}
                            onSelect={() =>
                              selectMeal(
                                meal.id === selectedMealId ? null : meal.id,
                              )
                            }
                          />
                        ))}
                        {cellMeals.length === 0 && (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            <span className="rounded-full border border-dashed border-slate-700 px-2 py-1">
                              Add meal
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
        <span className="font-semibold text-slate-200">Ingredient lane</span>{" "}
        {visibleLeftoverCount} leftover
        {visibleLeftoverCount === 1 ? "" : "s"} tracked this week
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-3 text-xs text-slate-200">
        <h3 className="mb-2 text-sm font-semibold tracking-tight text-slate-100">
          Leftover lane
        </h3>
        {leftovers.length === 0 ? (
          <p className="text-slate-500">No leftovers currently available.</p>
        ) : (
          <ul className="space-y-2">
            {leftovers.map((leftover) => (
              <li
                key={leftover.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2"
              >
                <span className="capitalize">
                  {leftover.ingredient} · {leftover.quantity} {leftover.unit}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Exp {leftover.expiresAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-xs text-slate-200">
        <h3 className="mb-2 text-sm font-semibold tracking-tight text-slate-100">
          Ingredient balance
        </h3>
        {ingredientBalances.length === 0 ? (
          <p className="text-slate-500">
            Add meals to build an ingredient balance and see shortages.
          </p>
        ) : (
          <ul className="space-y-2">
            {ingredientBalances.map((balance) => (
              <li
                key={`${balance.ingredient}::${balance.unit}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2"
              >
                <span className="text-slate-200 capitalize">
                  {balance.ingredient} ({balance.unit})
                </span>
                <span className="text-slate-400">
                  need {balance.required}, left {balance.available}
                  {balance.remainingShortage > 0
                    ? ` / short ${balance.remainingShortage}`
                    : " / covered"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedMeal && (
        <div className="mt-4 md:mt-6">
          <MealDetailPanel
            meal={selectedMeal}
            recipe={selectedRecipe}
            onClose={() => selectMeal(null)}
          />
        </div>
      )}
    </div>
  );
}


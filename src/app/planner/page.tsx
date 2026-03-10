"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MealChip } from "@/components/MealChip";
import { MealDetailPanel } from "@/components/MealDetailPanel";
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
    mockLeftoverCount,
  } = usePlannerStore();
  const { getRecipeById } = useRecipesStore();

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
        (placeholder): {mockLeftoverCount} leftover item
        {mockLeftoverCount === 1 ? "" : "s"} this week (mock data).
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


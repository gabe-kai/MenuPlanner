"use client";

import { useMemo } from "react";
import { MealChip } from "@/components/MealChip";
import { MealDetailPanel } from "@/components/MealDetailPanel";
import { usePlannerStore, MEAL_SLOTS } from "@/stores/plannerStore";
import { useRecipesStore } from "@/stores/recipesStore";

export default function PlannerPage() {
  const { weekDays, meals, selectedMealId, selectMeal } = usePlannerStore();
  const { getRecipeById } = useRecipesStore();

  const selectedMeal = useMemo(
    () => meals.find((m) => m.id === selectedMealId) ?? null,
    [meals, selectedMealId],
  );
  const selectedRecipe = selectedMeal
    ? getRecipeById(selectedMeal.recipeId)
    : undefined;

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Planner</h2>
        <p className="text-sm text-slate-400">
          Phase 1 toy planner – fixed Coffee/Breakfast/Lunch/Dinner slots for
          the current week, with a few demo meals.
        </p>
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


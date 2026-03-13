"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { usePlannerStore } from "@/stores/plannerStore";
import { useRecipesStore } from "@/stores/recipesStore";
import { useSchoolLunchStore } from "@/stores/schoolLunchStore";

export default function AdminDashboardPage() {
  const { users, families, currentUserId } = useAuthAndFamilyStore();
  const recipeCount = useRecipesStore((state) => state.recipes.length);
  const recipes = useRecipesStore((state) => state.recipes);
  const { meals, clearMeals, deleteMeal } = usePlannerStore();
  const schoolLunchPlanCount = useSchoolLunchStore((state) => state.plans.length);
  const plannerRows = useMemo(
    () =>
      meals.map((meal) => ({
        id: meal.id,
        dayKey: meal.dayKey,
        slot: meal.slot,
        recipeName: recipes.find((recipe) => recipe.id === meal.recipeId)?.name ?? meal.recipeId,
      })),
    [meals, recipes],
  );

  function handleClearMeals() {
    if (!currentUserId || meals.length === 0) return;
    if (!window.confirm(`Delete all ${meals.length} planner meals?`)) return;
    clearMeals(currentUserId);
  }

  function handleDeleteMeal(mealId: string) {
    if (!currentUserId) return;
    if (!window.confirm(`Delete planner meal ${mealId}?`)) return;
    deleteMeal(mealId, currentUserId);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Admin dashboard</h2>
          <p className="text-sm text-slate-400">
            Cross-entity overview with first-stage support actions for global maintenance.
          </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Users</p>
          <p className="text-2xl font-semibold text-slate-50">{users.length}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Families</p>
          <p className="text-2xl font-semibold text-slate-50">{families.length}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Recipes</p>
          <p className="text-2xl font-semibold text-slate-50">{recipeCount}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Planner meals</p>
          <p className="text-2xl font-semibold text-slate-50">{meals.length}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">School lunch plans</p>
          <p className="text-2xl font-semibold text-slate-50">{schoolLunchPlanCount}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold tracking-tight text-slate-300">Directory</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/users"
            className="rounded-full border border-slate-500 px-3 py-1 text-xs text-slate-100 hover:bg-slate-800"
          >
            Users directory
          </Link>
          <Link
            href="/admin/families"
            className="rounded-full border border-slate-500 px-3 py-1 text-xs text-slate-100 hover:bg-slate-800"
          >
            Families directory
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-slate-300">Planner maintenance</h3>
          <button
            type="button"
            onClick={handleClearMeals}
            className="rounded-full border border-amber-500 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
              disabled={!currentUserId || meals.length === 0}
          >
            Clear all planner meals
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="border-b border-slate-700 pb-2 pr-3">Day</th>
                <th className="border-b border-slate-700 pb-2 pr-3">Slot</th>
                <th className="border-b border-slate-700 pb-2 pr-3">Recipe</th>
                <th className="border-b border-slate-700 pb-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {plannerRows.length === 0 ? (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={4}>
                    No planner meals found.
                  </td>
                </tr>
              ) : (
                plannerRows.map((meal) => (
                  <tr key={meal.id}>
                    <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{meal.dayKey}</td>
                    <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{meal.slot}</td>
                    <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{meal.recipeName}</td>
                    <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">
                      <button
                        type="button"
                        onClick={() => handleDeleteMeal(meal.id)}
                        className="rounded-full border border-rose-500/70 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20"
                        disabled={!currentUserId}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { usePlannerStore, MEAL_SLOTS } from "@/stores/plannerStore";
import { useRecipesStore } from "@/stores/recipesStore";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { getCurrentWeekDays } from "@/lib/week";
import { getActorFromStoreState } from "@/lib/auth/actors";

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { getRecipeById } = useRecipesStore();
  const { addMeal, weekOffset, weekStart } = usePlannerStore();
  const { users, families, memberships, currentUserId, currentFamilyId } =
    useAuthAndFamilyStore();
  const actor = getActorFromStoreState(
    currentUserId,
    currentFamilyId,
    users,
    families,
    memberships,
  );

  const recipe = getRecipeById(id);
  if (!recipe) {
    notFound();
  }

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

  const [dayKey, setDayKey] = useState(weekDays[0]?.key ?? "");
  const [slot, setSlot] = useState<(typeof MEAL_SLOTS)[number]>("Dinner");

  const policyMessage =
    !actor
      ? "Sign in to add meals to your planner."
      : actor.isAdult
        ? null
        : actor.editPolicy === "no_edit"
          ? "Your account cannot add meals in no-edit mode."
          : null;

  const handleAddToPlanner = () => {
    if (!dayKey) return;
    if (!actor) return;
    addMeal(dayKey, slot, recipe.id, actor.user.id);
    router.push("/planner");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {recipe.name}
          </h2>
          <p className="text-sm text-slate-400">{recipe.description}</p>
        </div>
        <Link
          href="/recipes"
          className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          Back to recipes
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <h3 className="text-sm font-semibold tracking-tight">Ingredients</h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-200">
            {recipe.ingredients.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <h3 className="text-sm font-semibold tracking-tight">Steps</h3>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-200">
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <h3 className="text-sm font-semibold tracking-tight">
          Add to this week&apos;s planner
        </h3>
        {policyMessage && (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-[11px] text-amber-200">
            {policyMessage}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <div>
            <label className="mb-1 block text-slate-400">Day</label>
            <select
              value={dayKey}
              onChange={(event) => setDayKey(event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {weekDays.map((day) => (
                <option key={day.key} value={day.key}>
                  {day.weekday} · {day.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-slate-400">Slot</label>
            <select
              value={slot}
              onChange={(event) =>
                setSlot(event.target.value as (typeof MEAL_SLOTS)[number])
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddToPlanner}
            disabled={Boolean(policyMessage)}
            className="ml-auto rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            Add to planner
          </button>
        </div>
      </section>
    </div>
  );
}

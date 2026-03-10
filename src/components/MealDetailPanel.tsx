import type { PlannedMeal } from "@/stores/plannerStore";
import type { RecipeSummary } from "@/stores/recipesStore";

interface MealDetailPanelProps {
  meal: PlannedMeal;
  recipe?: RecipeSummary | undefined;
  onClose?: (() => void) | undefined;
}

export function MealDetailPanel({
  meal,
  recipe,
  onClose,
}: MealDetailPanelProps) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 max-h-[60vh] rounded-t-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl backdrop-blur md:static md:max-h-none md:rounded-2xl md:border md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            {recipe?.name ?? "Meal details"}
          </h3>
          <p className="text-xs text-slate-400">
            {meal.slot} · {meal.dayKey}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>
      <p className="text-xs text-slate-300">
        This is a Phase 1 placeholder panel. In later phases it will show full
        recipe steps, ingredients, methods, nutrition, and prep links.
      </p>
      {recipe?.description && (
        <p className="mt-3 text-xs text-slate-400">{recipe.description}</p>
      )}
    </aside>
  );
}


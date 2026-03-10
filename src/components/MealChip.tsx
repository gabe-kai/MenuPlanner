import type { PlannedMeal } from "@/stores/plannerStore";
import type { RecipeSummary } from "@/stores/recipesStore";

interface MealChipProps {
  meal: PlannedMeal;
  recipe?: RecipeSummary | undefined;
  isSelected?: boolean | undefined;
  onSelect?: (() => void) | undefined;
}

export function MealChip({ meal, recipe, isSelected, onSelect }: MealChipProps) {
  const label = recipe?.name ?? "Meal";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-full px-3 py-1 text-xs font-medium transition ${
        isSelected
          ? "bg-emerald-500 text-slate-950"
          : "bg-slate-800/80 text-slate-100 hover:bg-slate-700"
      }`}
      aria-label={`View details for ${label}`}
    >
      <span className="block truncate">{label}</span>
      <span className="mt-0.5 block text-[10px] font-normal text-slate-300">
        {meal.slot}
      </span>
    </button>
  );
}


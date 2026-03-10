import { create } from "zustand";
import type { WeekDay } from "@/lib/week";
import { getCurrentWeekDays } from "@/lib/week";

export const MEAL_SLOTS = ["Coffee", "Breakfast", "Lunch", "Dinner"] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export interface PlannedMeal {
  id: string;
  dayKey: string;
  slot: MealSlot;
  recipeId: string;
}

interface PlannerState {
  weekDays: WeekDay[];
  meals: PlannedMeal[];
  selectedMealId: string | null;
  selectMeal: (mealId: string | null) => void;
}

const demoMeals: PlannedMeal[] = [
  {
    id: "demo-1",
    dayKey: getCurrentWeekDays()[0]?.key ?? "",
    slot: "Breakfast",
    recipeId: "eli-sandwich",
  },
  {
    id: "demo-2",
    dayKey: getCurrentWeekDays()[2]?.key ?? "",
    slot: "Dinner",
    recipeId: "burrito-bowls",
  },
];

export const usePlannerStore = create<PlannerState>((set) => ({
  weekDays: getCurrentWeekDays(),
  meals: demoMeals,
  selectedMealId: null,
  selectMeal: (selectedMealId) => set({ selectedMealId }),
}));


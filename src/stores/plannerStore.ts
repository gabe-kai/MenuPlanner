import { create } from "zustand";
import { log } from "@/lib/log";
import type { WeekStart } from "@/lib/week";
import { getCurrentWeekDays } from "@/lib/week";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

export const MEAL_SLOTS = [
  "Coffee",
  "Breakfast",
  "Lunch",
  "School Lunch",
  "Dinner",
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export interface PlannedMeal {
  id: string;
  dayKey: string;
  slot: MealSlot;
  recipeId: string;
}

interface PlannerState {
  weekOffset: number;
  weekStart: WeekStart;
  meals: PlannedMeal[];
  selectedMealId: string | null;
  mockLeftoverCount: number;
  selectMeal: (mealId: string | null) => void;
  nextWeek: () => void;
  previousWeek: () => void;
  resetWeek: () => void;
  setWeekStart: (weekStart: WeekStart) => void;
  addMeal: (
    dayKey: string,
    slot: MealSlot,
    recipeId: string,
    actorUserId: string | null,
  ) => void;
}

const baseWeekDays = getCurrentWeekDays();

const demoMeals: PlannedMeal[] = [
  {
    id: "demo-1",
    dayKey: baseWeekDays[0]?.key ?? "",
    slot: "Breakfast",
    recipeId: "eli-sandwich",
  },
  {
    id: "demo-2",
    dayKey: baseWeekDays[2]?.key ?? "",
    slot: "Dinner",
    recipeId: "burrito-bowls",
  },
];

export const usePlannerStore = create<PlannerState>((set) => ({
  weekOffset: 0,
  weekStart: "sunday",
  meals: demoMeals,
  selectedMealId: null,
  mockLeftoverCount: 2,
  selectMeal: (selectedMealId) => set({ selectedMealId }),
  nextWeek: () => set((state) => ({ weekOffset: state.weekOffset + 1 })),
  previousWeek: () => set((state) => ({ weekOffset: state.weekOffset - 1 })),
  resetWeek: () => set({ weekOffset: 0 }),
  setWeekStart: (weekStart) => set({ weekStart }),
  addMeal: (dayKey, slot, recipeId, actorUserId) => {
    const authState = useAuthAndFamilyStore.getState();
    const actor = actorUserId ? authState.getUserById(actorUserId) : undefined;
    if (!actor) {
      log.warn({
        module: "planner",
        message: "meal add blocked: missing actor",
        data: { dayKey, slot, recipeId },
      });
      return;
    }
    if (actor.role === "child") {
      const membership = authState.getMembershipForUser(actor.id);
      if (membership?.editPolicy === "no_edit") {
        log.warn({
          module: "planner",
          message: "meal add blocked by policy",
          data: {
            actorUserId: actor.id,
            childId: actor.id,
            familyId: membership.familyId,
            slot,
            dayKey,
            recipeId,
          },
        });
        return;
      }
    }

    const id = `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newMeal: PlannedMeal = { id, dayKey, slot, recipeId };
    set((state) => ({ meals: [...state.meals, newMeal] }));
    log.info({
      module: "planner",
      message: "meal added",
      data: { id, actorUserId: actor.id, dayKey, slot, recipeId },
    });
  },
}));


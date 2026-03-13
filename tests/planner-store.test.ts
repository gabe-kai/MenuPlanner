import { usePlannerStore } from "@/stores/plannerStore";

describe("planner store policy enforcement", () => {
  beforeEach(() => {
    const state = usePlannerStore.getState();
    usePlannerStore.setState({ ...state, meals: state.meals.slice(0, 2) });
  });

  it("requires an actor to add a meal", () => {
    const state = usePlannerStore.getState();
    const beforeCount = state.meals.length;
    state.addMeal("2026-01-01", "Breakfast", "eli-sandwich", null);

    expect(usePlannerStore.getState().meals.length).toBe(beforeCount);
  });

  it("allows an authenticated actor to add a meal", () => {
    const beforeCount = usePlannerStore.getState().meals.length;
    usePlannerStore
      .getState()
      .addMeal("2026-01-01", "Breakfast", "eli-sandwich", "mom");

    expect(usePlannerStore.getState().meals.length).toBe(beforeCount + 1);
  });

  it("prevents child actors from deleting meals", () => {
    const beforeCount = usePlannerStore.getState().meals.length;
    usePlannerStore.getState().deleteMeal("demo-1", "sarah");

    expect(usePlannerStore.getState().meals.length).toBe(beforeCount);
    expect(usePlannerStore.getState().meals.find((meal) => meal.id === "demo-1")).toBeDefined();
  });

  it("allows adult actors to delete meals", () => {
    const beforeCount = usePlannerStore.getState().meals.length;
    usePlannerStore.getState().deleteMeal("demo-1", "mom");

    expect(usePlannerStore.getState().meals.length).toBe(beforeCount - 1);
    expect(usePlannerStore.getState().meals.find((meal) => meal.id === "demo-1")).toBeUndefined();
  });

  it("allows adults to clear all planner meals", () => {
    usePlannerStore.getState().clearMeals("mom");

    expect(usePlannerStore.getState().meals.length).toBe(0);
  });

  it("prevents child actors from clearing all planner meals", () => {
    const beforeCount = usePlannerStore.getState().meals.length;
    usePlannerStore.getState().clearMeals("sarah");

    expect(usePlannerStore.getState().meals.length).toBe(beforeCount);
  });
});

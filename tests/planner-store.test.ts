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
});

import { computeIngredientBalance, computeLeftoverBatches } from "@/lib/ingredientLane";
import type { PlannedMeal } from "@/stores/plannerStore";
import type { RecipeSummary } from "@/stores/recipesStore";

describe("ingredient lane helpers", () => {
  const recipesById: Record<string, RecipeSummary> = {
    "eli-sandwich": {
      id: "eli-sandwich",
      name: "The Eli Sandwich",
      description: "Demo",
      ingredients: [
        "2 slices marbled rye bread",
        "3 slices salami",
      ],
      steps: [],
    },
    "burrito-bowls": {
      id: "burrito-bowls",
      name: "Leftover Burrito Bowls",
      description: "Demo",
      ingredients: ["1 cup cooked rice", "1 cup cooked beans"],
      steps: [],
    },
  };

  it("builds leftover batches from planned meals and planned recipe ingredients", () => {
    const meals: PlannedMeal[] = [
      {
        id: "meal-eli",
        dayKey: "2026-01-01",
        slot: "Dinner",
        recipeId: "eli-sandwich",
      },
    ];

    const leftovers = computeLeftoverBatches(meals, recipesById, {
      asOfDate: new Date("2026-01-01T12:00:00Z"),
    });

    expect(leftovers).toHaveLength(2);
    expect(leftovers[0]?.ingredient).toBe("marbled rye bread");
    expect(leftovers[1]?.quantity).toBe(1.2);
  });

  it("drops leftovers that expire before the as-of date", () => {
    const meals: PlannedMeal[] = [
      {
        id: "expired-meal",
        dayKey: "2026-01-01",
        slot: "Breakfast",
        recipeId: "burrito-bowls",
      },
    ];

    const leftovers = computeLeftoverBatches(meals, recipesById, {
      expirationDays: 2,
      asOfDate: new Date("2026-01-05T12:00:00Z"),
    });

    expect(leftovers).toHaveLength(0);
  });

  it("computes ingredient balance from meal needs and available leftovers", () => {
    const meals: PlannedMeal[] = [
      {
        id: "meal-eli",
        dayKey: "2026-01-01",
        slot: "Dinner",
        recipeId: "eli-sandwich",
      },
    ];
    const leftovers = computeLeftoverBatches(meals, recipesById, {
      asOfDate: new Date("2026-01-01T12:00:00Z"),
    });
    const balances = computeIngredientBalance(meals, recipesById, leftovers);

    const rye = balances.find(
      (item) => item.ingredient === "marbled rye bread" && item.unit === "slices",
    );
    const salami = balances.find((item) => item.ingredient === "salami");
    expect(rye).toBeDefined();
    expect(rye?.remainingShortage).toBe(1.2);
    expect(rye?.available).toBe(0.8);
    expect(salami?.remainingShortage).toBe(1.8);
  });
});

import { useRecipesStore } from "@/stores/recipesStore";

describe("recipes store", () => {
  it("exposes demo recipes and lookup by id", () => {
    const { recipes, getRecipeById } = useRecipesStore.getState();

    expect(recipes.length).toBeGreaterThanOrEqual(2);

    const eli = getRecipeById("eli-sandwich");
    expect(eli).toBeDefined();
    expect(eli?.name).toMatch(/Eli Sandwich/i);
  });
});


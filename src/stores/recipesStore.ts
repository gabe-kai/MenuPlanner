import { create } from "zustand";

export interface RecipeSummary {
  id: string;
  name: string;
  description: string;
}

interface RecipesState {
  recipes: RecipeSummary[];
  getRecipeById: (id: string) => RecipeSummary | undefined;
}

const demoRecipes: RecipeSummary[] = [
  {
    id: "eli-sandwich",
    name: "The Eli Sandwich",
    description: "Marbled rye, salami, cheddar – household classic.",
  },
  {
    id: "burrito-bowls",
    name: "Leftover Burrito Bowls",
    description: "Use up rice and beans with fresh toppings.",
  },
];

export const useRecipesStore = create<RecipesState>(() => ({
  recipes: demoRecipes,
  getRecipeById: (id: string) => demoRecipes.find((r) => r.id === id),
}));


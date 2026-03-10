import { create } from "zustand";

export interface RecipeSummary {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
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
    ingredients: [
      "2 slices marbled rye bread",
      "3 slices salami",
      "2 slices cheddar cheese",
      "Butter or mayo for the bread",
    ],
    steps: [
      "Spread butter or mayo on the bread.",
      "Layer salami and cheddar between the slices.",
      "Toast in a pan or sandwich press until the cheese softens.",
    ],
  },
  {
    id: "burrito-bowls",
    name: "Leftover Burrito Bowls",
    description: "Use up rice and beans with fresh toppings.",
    ingredients: [
      "1 cup cooked rice (leftover is perfect)",
      "1 cup cooked beans",
      "Chopped veggies (lettuce, tomato, onion)",
      "Shredded cheese, salsa, and sour cream",
    ],
    steps: [
      "Warm the rice and beans.",
      "Layer rice, beans, and veggies in a bowl.",
      "Top with cheese, salsa, and sour cream to taste.",
    ],
  },
];

export const useRecipesStore = create<RecipesState>(() => ({
  recipes: demoRecipes,
  getRecipeById: (id: string) => demoRecipes.find((r) => r.id === id),
}));



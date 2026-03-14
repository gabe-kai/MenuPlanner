import type { PlannedMeal } from "@/stores/plannerStore";
import type { RecipeSummary } from "@/stores/recipesStore";

export interface ParsedIngredient {
  ingredient: string;
  quantity: number;
  unit: string;
}

export interface LeftoverBatch {
  id: string;
  mealId: string;
  recipeId: string;
  ingredient: string;
  quantity: number;
  unit: string;
  sourceDayKey: string;
  producedAt: string;
  expiresAt: string;
}

export interface IngredientBalance {
  ingredient: string;
  unit: string;
  required: number;
  available: number;
  remainingShortage: number;
}

export interface ComputeLeftoverOptions {
  producedFromMealYield?: number;
  expirationDays?: number;
  asOfDate?: Date;
}

function parseIngredientQuantity(raw: string): ParsedIngredient | null {
  const normalized = raw.trim();
  const match =
    normalized.match(
      /^\s*(\d+(?:\.\d+)?|\d+\/\d+)\s+([a-zA-Z][a-zA-Z]*)\s+(.+)$/,
    );
  if (!match) return null;

  const [, rawQuantity, rawUnit, rawIngredient] = match;
  if (!rawQuantity || !rawUnit || !rawIngredient) return null;

  const quantity =
    rawQuantity.includes("/") && rawQuantity !== null
      ? Number.parseFloat(rawQuantity.split("/")[0] ?? "0") /
        Number.parseFloat(rawQuantity.split("/")[1] ?? "1")
      : Number.parseFloat(rawQuantity);

  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const ingredient = rawIngredient
    .replace(/,\s*/g, ",")
    .trim()
    .replace(/\s*\(.*?\)\s*$/g, "")
    .trim();

  const unit = rawUnit.trim().toLowerCase();
  return { ingredient: ingredient.toLowerCase(), quantity, unit };
}

function normalizeIngredientKey(ingredient: string, unit: string) {
  const normalizedIngredient = ingredient
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
  return `${normalizedIngredient}::${unit}`;
}

function parseDayKey(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split("-");
  if (!yearText || !monthText || !dayText) return null;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function clampKey(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeLeftoverBatches(
  meals: PlannedMeal[],
  recipesById: Record<string, RecipeSummary>,
  options: ComputeLeftoverOptions = {},
): LeftoverBatch[] {
  const {
    producedFromMealYield = 0.4,
    expirationDays = 3,
    asOfDate = new Date(),
  } = options;

  const asOf = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);

  const leftovers: LeftoverBatch[] = [];

  for (const meal of meals) {
    const recipe = recipesById[meal.recipeId];
    if (!recipe) continue;

    const producedDate = parseDayKey(meal.dayKey);
    if (!producedDate) continue;

    const expiresAt = addDays(producedDate, expirationDays);
    if (expiresAt < asOf) continue;

    for (let index = 0; index < recipe.ingredients.length; index += 1) {
      const parsed = parseIngredientQuantity(recipe.ingredients[index] ?? "");
      if (!parsed) continue;

      const quantity = clampKey(
        producedFromMealYield * parsed.quantity,
      );
      if (quantity <= 0) continue;

      leftovers.push({
        id: `${meal.id}-${index}-${parsed.ingredient}`,
        mealId: meal.id,
        recipeId: recipe.id,
        ingredient: parsed.ingredient,
        quantity,
        unit: parsed.unit,
        sourceDayKey: meal.dayKey,
        producedAt: producedDate.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    }
  }

  return leftovers;
}

export function computeIngredientBalance(
  meals: PlannedMeal[],
  recipesById: Record<string, RecipeSummary>,
  leftovers: LeftoverBatch[],
): IngredientBalance[] {
  const requiredByKey = new Map<string, IngredientBalance>();
  const consumeByKey = new Map<string, number>();

  for (const meal of meals) {
    const recipe = recipesById[meal.recipeId];
    if (!recipe) continue;

    for (const ingredientLine of recipe.ingredients) {
      const parsed = parseIngredientQuantity(ingredientLine);
      if (!parsed) continue;
      const key = normalizeIngredientKey(parsed.ingredient, parsed.unit);
      const existing = requiredByKey.get(key);
      if (!existing) {
        requiredByKey.set(key, {
          ingredient: parsed.ingredient,
          unit: parsed.unit,
          required: parsed.quantity,
          available: 0,
          remainingShortage: parsed.quantity,
        });
      } else {
        existing.required += parsed.quantity;
        existing.remainingShortage += parsed.quantity;
      }
    }
  }

  for (const leftover of leftovers) {
    const key = normalizeIngredientKey(leftover.ingredient, leftover.unit);
    consumeByKey.set(key, (consumeByKey.get(key) ?? 0) + leftover.quantity);
  }

  for (const [key, available] of consumeByKey.entries()) {
    const current = requiredByKey.get(key);
    if (!current) {
      requiredByKey.set(key, {
        ingredient: key.split("::")[0] ?? "",
        unit: key.split("::")[1] ?? "",
        required: 0,
        available,
        remainingShortage: -available,
      });
      continue;
    }

    current.available = clampKey(available);
    current.remainingShortage = clampKey(current.required - current.available);
    if (current.remainingShortage < 0) {
      current.remainingShortage = 0;
    }
  }

  for (const entry of requiredByKey.values()) {
    entry.required = clampKey(entry.required);
    entry.available = clampKey(entry.available);
    entry.remainingShortage = clampKey(
      Math.max(0, entry.required - entry.available),
    );
  }

  return Array.from(requiredByKey.values())
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient))
    .filter((entry) => entry.required > 0 || entry.available > 0);
}

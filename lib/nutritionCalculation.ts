// Deterministic nutrition calculation — no LLM, ever. Sums per-100g
// reference data (nutrition_data, seeded from USDA FoodData Central
// approximations — see db/migrations/0013_nutrition_data.sql) across a
// recipe's ingredients, scaled by quantity, then divides by servings.
//
// A server-side Deno port of this same algorithm lives at
// supabase/functions/_shared/nutritionCalculation.ts, used at recipe
// generation time — keep the two in sync if the algorithm changes, same
// pattern as lib/recipeMatching.ts's split.
//
// Any ingredient that can't be matched to canonical_food_id, has no seeded
// nutrition_data row, or whose quantity/unit can't be confidently
// converted to grams simply doesn't contribute to the sum — and the whole
// result is flagged `is_partial: true` rather than silently under-counting.
// "No data beats an invented number" — same principle as expiry estimation
// and dietary-restriction enforcement elsewhere in this app.

import type { NutritionData } from '../types/database';
import type { RecipeIngredient, RecipeNutrition } from '../types/recipe';

// Only real weight units convert confidently to grams. Count-ish units
// (cup, can, clove, bunch, ...) have no fixed weight without knowing the
// specific food, so an ingredient using one of those is excluded from the
// sum rather than guessed — see module header.
const WEIGHT_UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

function convertToGrams(quantityValue: number | null, quantityUnit: string | null): number | null {
  if (quantityValue == null || quantityUnit == null) return null;
  const grams = WEIGHT_UNIT_TO_GRAMS[quantityUnit.trim().toLowerCase()];
  return grams != null ? quantityValue * grams : null;
}

interface IngredientNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function computeIngredientNutrition(
  ingredient: Pick<RecipeIngredient, 'canonical_food_id' | 'quantity_value' | 'quantity_unit'>,
  nutritionByFoodId: Map<string, NutritionData>
): IngredientNutrition | null {
  if (!ingredient.canonical_food_id) return null;
  const data = nutritionByFoodId.get(ingredient.canonical_food_id);
  if (!data) return null;

  const grams = convertToGrams(ingredient.quantity_value, ingredient.quantity_unit);
  if (grams == null) return null;

  const factor = grams / 100;
  return {
    calories: data.calories_per_100g * factor,
    protein: data.protein_g_per_100g * factor,
    carbs: data.carbs_g_per_100g * factor,
    fat: data.fat_g_per_100g * factor,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Computes per-serving nutrition for a recipe. `ingredients` should be the
 * recipe's full list (matched or not — unmatched/unconvertible ones are
 * simply skipped, see module header). Divides by `servings` (treated as 1
 * if null/zero, since "per serving" needs *some* denominator).
 */
export function computeRecipeNutrition(
  ingredients: Pick<RecipeIngredient, 'canonical_food_id' | 'quantity_value' | 'quantity_unit'>[],
  nutritionData: NutritionData[],
  servings: number | null
): RecipeNutrition {
  const nutritionByFoodId = new Map(nutritionData.map((row) => [row.canonical_food_id, row]));

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let matchedCount = 0;

  for (const ingredient of ingredients) {
    const result = computeIngredientNutrition(ingredient, nutritionByFoodId);
    if (!result) continue;
    totalCalories += result.calories;
    totalProtein += result.protein;
    totalCarbs += result.carbs;
    totalFat += result.fat;
    matchedCount++;
  }

  const divisor = servings && servings > 0 ? servings : 1;

  return {
    calories_per_serving: round(totalCalories / divisor),
    protein_g_per_serving: round(totalProtein / divisor),
    carbs_g_per_serving: round(totalCarbs / divisor),
    fat_g_per_serving: round(totalFat / divisor),
    is_partial: matchedCount < ingredients.length,
    matched_ingredient_count: matchedCount,
    total_ingredient_count: ingredients.length,
  };
}

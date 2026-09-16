// Deno port of lib/nutritionCalculation.ts — same algorithm, kept in sync
// manually (see that file's header). Self-contained, only the fields it
// needs, same pattern as the rest of supabase/functions/_shared/.

export interface NutritionDataRow {
  canonical_food_id: string;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
}

export interface NutritionableIngredient {
  canonical_food_id: string | null;
  quantity_value: number | null;
  quantity_unit: string | null;
}

export interface RecipeNutrition {
  calories_per_serving: number;
  protein_g_per_serving: number;
  carbs_g_per_serving: number;
  fat_g_per_serving: number;
  is_partial: boolean;
  matched_ingredient_count: number;
  total_ingredient_count: number;
}

const WEIGHT_UNIT_TO_GRAMS: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

function convertToGrams(quantityValue: number | null, quantityUnit: string | null): number | null {
  if (quantityValue == null || quantityUnit == null) return null;
  const grams = WEIGHT_UNIT_TO_GRAMS[quantityUnit.trim().toLowerCase()];
  return grams != null ? quantityValue * grams : null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeRecipeNutrition(
  ingredients: NutritionableIngredient[],
  nutritionData: NutritionDataRow[],
  servings: number | null
): RecipeNutrition {
  const nutritionByFoodId = new Map(nutritionData.map((row) => [row.canonical_food_id, row]));

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let matchedCount = 0;

  for (const ingredient of ingredients) {
    if (!ingredient.canonical_food_id) continue;
    const data = nutritionByFoodId.get(ingredient.canonical_food_id);
    if (!data) continue;
    const grams = convertToGrams(ingredient.quantity_value, ingredient.quantity_unit);
    if (grams == null) continue;

    const factor = grams / 100;
    totalCalories += data.calories_per_100g * factor;
    totalProtein += data.protein_g_per_100g * factor;
    totalCarbs += data.carbs_g_per_100g * factor;
    totalFat += data.fat_g_per_100g * factor;
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

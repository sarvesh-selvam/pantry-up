// Consumption-triggered macro logging for eating a leftover — the second
// of the two paths that can write to daily_nutrition (the first is Finish
// Cooking, see app/recipe/[id]/finish.tsx). Used by both Kitchen Check-In's
// "Ate It" response and Pantry's "I ate this" quick action, so there's one
// implementation of "what does eating a leftover mean for nutrition,"
// not two that could drift.
//
// Assumes the leftover's full remaining quantity_value (servings) is being
// consumed — "Ate It" / "I ate this" means the item is gone now, so that's
// the honest default rather than prompting for a count, which Check-In's
// instant-tap design (Phase 5) has no room for anyway.
//
// If the leftover has no source_recipe_id (created before this phase, or
// the source recipe was later deleted), or that recipe has no computed
// nutrition, this is a no-op — there's no data to log from, and inventing
// a number here would violate this app's standing "no data beats a
// guess" rule (same one behind expiry estimation and dietary enforcement).

import { logDailyNutrition, todayLocalDate } from './api/dailyNutrition';
import { fetchRecipeById } from './api/recipes';
import type { InventoryItem } from '../types/database';
import type { ConsumedNutrition } from '../types/cookEvent';

export interface LeftoverConsumptionResult {
  logged: boolean;
  consumed: ConsumedNutrition | null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function logLeftoverConsumption(
  item: Pick<InventoryItem, 'source_recipe_id' | 'quantity_value'>,
  userId: string
): Promise<LeftoverConsumptionResult> {
  if (!item.source_recipe_id) return { logged: false, consumed: null };

  const recipe = await fetchRecipeById(item.source_recipe_id);
  if (!recipe || !recipe.nutrition) return { logged: false, consumed: null };

  const servingsConsumed = Number.isFinite(item.quantity_value) ? (item.quantity_value as number) : 1;

  const consumed: ConsumedNutrition = {
    calories: round(recipe.nutrition.calories_per_serving * servingsConsumed),
    protein_g: round(recipe.nutrition.protein_g_per_serving * servingsConsumed),
    carbs_g: round(recipe.nutrition.carbs_g_per_serving * servingsConsumed),
    fat_g: round(recipe.nutrition.fat_g_per_serving * servingsConsumed),
    servings_consumed: servingsConsumed,
    is_partial: recipe.nutrition.is_partial,
  };

  await logDailyNutrition(userId, todayLocalDate(), {
    calories: consumed.calories,
    protein_g: consumed.protein_g,
    carbs_g: consumed.carbs_g,
    fat_g: consumed.fat_g,
  });

  return { logged: true, consumed };
}

// Cook event domain types — Phase 4. See db/migrations/0010_cook_events.sql
// for the backing table and lib/cookingMutations.ts for the module that
// produces AppliedMutation records.

import type { QuantityState } from './database';

export type MutationMode = 'quantity' | 'state';

/** What was actually applied to an inventory_item on "Update Pantry" —
 * an audit record, stored in cook_events.inventory_mutations. */
export type AppliedMutation = {
  inventory_item_id: string;
  display_name: string;
  mode: MutationMode;
  previous_quantity_value: number | null;
  new_quantity_value: number | null;
  previous_quantity_state: QuantityState | null;
  new_quantity_state: QuantityState | null;
  /** True if the item was fully consumed and deleted rather than updated. */
  removed: boolean;
};

/** A leftover inventory_item created from this cook, stored in
 * cook_events.leftovers_created. */
export type LeftoverRecord = {
  inventory_item_id: string;
  display_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
};

/** Nutrition actually logged for a consumption event — computed
 * deterministically from the recipe's per-serving RecipeNutrition ×
 * servings consumed (see lib/nutritionLogging.ts). Only ever written when
 * consumption is confirmed, never on recipe generation/save. */
export type ConsumedNutrition = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  servings_consumed: number;
  /** Mirrors the source RecipeNutrition's is_partial — some ingredients
   * may not have contributed to the per-serving figures this was scaled from. */
  is_partial: boolean;
};

export type CookEvent = {
  id: string;
  user_id: string;
  recipe_id: string;
  cooked_at: string;
  servings_prepared: number | null;
  servings_consumed: number | null;
  inventory_mutations: AppliedMutation[];
  nutrition_consumed: ConsumedNutrition | null;
  leftovers_created: LeftoverRecord[] | null;
  user_feedback: string | null;
  created_at: string;
};

export type CookEventInsert = Omit<CookEvent, 'id' | 'user_id' | 'created_at'> &
  Partial<Pick<CookEvent, 'created_at'>>;

export type CookEventDbInsert = CookEventInsert & Pick<CookEvent, 'user_id'>;

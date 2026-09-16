// Gathers the real data Sous Chef's tools and the automatic recipe
// suggestions pipeline are grounded in — inventory, rescue items,
// preferences, canonical foods. Shared so both entry points build the
// exact same context the same way (get_inventory / get_rescue_items /
// get_user_preferences in Sous Chef's tool set are thin wrappers around
// this for the chat's tool-calling loop; recipe-suggestions calls it
// directly since there's no conversational orchestration needed).

import { getUserSupabaseClient } from './supabaseClient.ts';
import { getRescueRowEntries, type RescueInventoryItem } from './rescueRow.ts';
import type { CanonicalFoodRef } from './matching.ts';

export interface PantryContext {
  inventoryItems: Record<string, unknown>[];
  rescueItemNames: string[];
  canonicalFoods: CanonicalFoodRef[];
  dietaryRestrictions: string[];
  cuisineWeights: Record<string, number>;
  skillLevel: string;
  inventorySummaryLines: string[];
}

export async function loadPantryContext(
  supabase: ReturnType<typeof getUserSupabaseClient>,
  userId: string
): Promise<PantryContext> {
  const [inventoryResult, canonicalFoodsResult, prefsResult] = await Promise.all([
    supabase.from('inventory_items').select('*'),
    supabase.from('canonical_foods').select('id, canonical_name, category, aliases'),
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (inventoryResult.error) {
    throw new Error(`Failed to load inventory: ${inventoryResult.error.message}`);
  }
  if (canonicalFoodsResult.error) {
    throw new Error(`Failed to load canonical foods: ${canonicalFoodsResult.error.message}`);
  }
  if (prefsResult.error) {
    throw new Error(`Failed to load preferences: ${prefsResult.error.message}`);
  }

  const items = (inventoryResult.data ?? []) as Record<string, unknown>[];

  const rescueEntries = getRescueRowEntries(items as unknown as RescueInventoryItem[]);
  const rescueItemNames = rescueEntries.map((entry) => entry.item.display_name);

  const inventorySummaryLines = items.map((item) => {
    const quantity =
      item.quantity_value != null
        ? `${item.quantity_value}${item.quantity_unit ? ` ${item.quantity_unit}` : ''}`
        : (item.quantity_state as string | null) ?? 'unknown quantity';
    const uncertain = item.verification_status !== 'confirmed' ? ' (unconfirmed)' : '';
    return `- ${item.display_name} [canonical_food_id=${item.canonical_food_id ?? 'null'}]: ${quantity}, ${item.storage_location}, ${item.preparation_state}${uncertain}`;
  });

  const prefs = prefsResult.data as {
    dietary_restrictions?: string[];
    cuisine_weights?: Record<string, number>;
    skill_level?: string;
  } | null;

  return {
    inventoryItems: items,
    rescueItemNames,
    canonicalFoods: (canonicalFoodsResult.data ?? []) as CanonicalFoodRef[],
    dietaryRestrictions: prefs?.dietary_restrictions ?? [],
    cuisineWeights: prefs?.cuisine_weights ?? {},
    skillLevel: prefs?.skill_level ?? 'intermediate',
    inventorySummaryLines,
  };
}

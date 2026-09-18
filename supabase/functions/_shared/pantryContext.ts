// Gathers the real data Sous Chef's tools and the automatic recipe
// suggestions pipeline are grounded in — inventory, rescue items,
// preferences, canonical foods. Shared so both entry points build the
// exact same context the same way (get_inventory / get_rescue_items /
// get_user_preferences in Sous Chef's tool set are thin wrappers around
// this for the chat's tool-calling loop; recipe-suggestions calls it
// directly since there's no conversational orchestration needed).

import { getUserSupabaseClient } from './supabaseClient.ts';
import { getRescueRowEntries, type RescueInventoryItem, type RescueRowEntry } from './rescueRow.ts';
import type { CanonicalFoodRef } from './matching.ts';
import type { NutritionDataRow } from './nutritionCalculation.ts';

/** One recent cook, reduced to just what recommendationScoring.ts's
 * novelty/repetition terms need — cuisine and which ingredient categories
 * were used (a rough "was this a protein-heavy meal" signal, see that
 * module's header comment on the same category-based approximation used
 * for "favorite proteins" elsewhere). */
export interface RecentCookEvent {
  cuisine: string | null;
  ingredientCategories: string[];
  cookedAt: string;
}

const RECENT_COOK_EVENTS_WINDOW_DAYS = 30;
const RECENT_COOK_EVENTS_LIMIT = 50;

export interface PantryContext {
  inventoryItems: Record<string, unknown>[];
  rescueItemNames: string[];
  /** Full rescue classification (reason, urgency sortKey), not just
   * names — recommendationScoring.ts's expiry_rescue_score needs the
   * actual urgency, not just "which items are rescue-eligible." */
  rescueEntries: RescueRowEntry[];
  canonicalFoods: CanonicalFoodRef[];
  nutritionData: NutritionDataRow[];
  dietaryRestrictions: string[];
  cuisineWeights: Record<string, number>;
  skillLevel: string;
  /** Was already being fetched (full user_preferences row) but silently
   * dropped before Phase 8 — now actually reaches GenerationContext and
   * the equipment_match scoring term. */
  equipment: string[];
  recentCookEvents: RecentCookEvent[];
  inventorySummaryLines: string[];
}

export async function loadPantryContext(
  supabase: ReturnType<typeof getUserSupabaseClient>,
  userId: string
): Promise<PantryContext> {
  const cookEventsSince = new Date(Date.now() - RECENT_COOK_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [inventoryResult, canonicalFoodsResult, prefsResult, nutritionResult, cookEventsResult] = await Promise.all([
    supabase.from('inventory_items').select('*'),
    supabase.from('canonical_foods').select('id, canonical_name, category, aliases'),
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('nutrition_data').select('canonical_food_id, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g'),
    supabase
      .from('cook_events')
      .select('recipe_id, cooked_at')
      .gte('cooked_at', cookEventsSince)
      .order('cooked_at', { ascending: false })
      .limit(RECENT_COOK_EVENTS_LIMIT),
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
  if (nutritionResult.error) {
    throw new Error(`Failed to load nutrition data: ${nutritionResult.error.message}`);
  }
  if (cookEventsResult.error) {
    throw new Error(`Failed to load recent cook events: ${cookEventsResult.error.message}`);
  }

  const items = (inventoryResult.data ?? []) as Record<string, unknown>[];
  const canonicalFoods = (canonicalFoodsResult.data ?? []) as CanonicalFoodRef[];

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
    equipment?: string[];
  } | null;

  const recentCookEvents = await loadRecentCookEvents(supabase, cookEventsResult.data ?? [], canonicalFoods);

  return {
    inventoryItems: items,
    rescueItemNames,
    rescueEntries,
    canonicalFoods,
    nutritionData: (nutritionResult.data ?? []) as NutritionDataRow[],
    dietaryRestrictions: prefs?.dietary_restrictions ?? [],
    cuisineWeights: prefs?.cuisine_weights ?? {},
    skillLevel: prefs?.skill_level ?? 'intermediate',
    equipment: prefs?.equipment ?? [],
    recentCookEvents,
    inventorySummaryLines,
  };
}

/**
 * A second query joining cook_events → recipes (same "two simple queries
 * over an embedded select" pattern as lib/api/cookEvents.ts's
 * fetchCookEvents — this schema's Relationships arrays are all empty on
 * purpose, see CLAUDE.md's Supabase typing gotcha). Reduces each cooked
 * recipe to just cuisine + which ingredient categories it used, which is
 * all recommendationScoring.ts's novelty/repetition terms need.
 */
async function loadRecentCookEvents(
  supabase: ReturnType<typeof getUserSupabaseClient>,
  events: { recipe_id: string | null; cooked_at: string }[],
  canonicalFoods: CanonicalFoodRef[]
): Promise<RecentCookEvent[]> {
  if (events.length === 0) return [];

  // recipe_id is null once a recipe has been deleted (0021) — the cook
  // still counts, it just contributes no cuisine/category signal.
  const recipeIds = [...new Set(events.flatMap((event) => (event.recipe_id ? [event.recipe_id] : [])))];
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, cuisine, ingredients')
    .in('id', recipeIds);
  if (error) throw new Error(`Failed to load recipes for cook history: ${error.message}`);

  const categoryByFoodId = new Map(canonicalFoods.map((food) => [food.id, food.category]));
  const recipeById = new Map(
    (recipes ?? []).map((recipe) => {
      const ingredients = Array.isArray(recipe.ingredients) ? (recipe.ingredients as Record<string, unknown>[]) : [];
      const categories = new Set<string>();
      for (const ingredient of ingredients) {
        const foodId = typeof ingredient.canonical_food_id === 'string' ? ingredient.canonical_food_id : null;
        const category = foodId ? categoryByFoodId.get(foodId) : undefined;
        if (category) categories.add(category);
      }
      return [recipe.id, { cuisine: recipe.cuisine as string | null, categories: [...categories] }];
    })
  );

  return events.map((event) => {
    const recipe = event.recipe_id ? recipeById.get(event.recipe_id) : undefined;
    return {
      cuisine: recipe?.cuisine ?? null,
      ingredientCategories: recipe?.categories ?? [],
      cookedAt: event.cooked_at,
    };
  });
}

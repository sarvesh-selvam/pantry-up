// Recipe-to-inventory matching engine — deterministic, no LLM. Reused
// everywhere a recipe is shown (Sous Chef's inline card, Home's suggestion
// cards, the recipe detail screen): given a recipe's ingredient list and the
// user's current inventory, classify each ingredient as Already Have /
// Verify / Missing and compute overall pantry coverage.
//
// A server-side Deno port of this same algorithm lives at
// supabase/functions/_shared/recipeMatching.ts, used by the
// match_recipe_to_inventory tool and the automatic Home suggestions
// pipeline — keep the two in sync if the algorithm changes (see that
// file's header comment).

import { isUncertain } from './formatInventory';
import type { InventoryItem } from '../types/database';
import type { IngredientMatch, RecipeIngredient, RecipeMatchResult } from '../types/recipe';

// Small synonym map so "lb"/"lbs", "oz"/"ounce"/"ounces" etc. are treated as
// the same unit when summing quantities. Not a full unit-conversion system
// (no lb<->oz, no metric<->imperial) — deliberately simple, see
// lib/quickAddParser.ts's UNIT_WORDS for the sibling list on the input side.
const UNIT_SYNONYMS: Record<string, string> = {
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  cup: 'cup',
  cups: 'cup',
  can: 'can',
  cans: 'can',
  jar: 'jar',
  jars: 'jar',
  bottle: 'bottle',
  bottles: 'bottle',
  bunch: 'bunch',
  bunches: 'bunch',
  clove: 'clove',
  cloves: 'clove',
  stalk: 'stalk',
  stalks: 'stalk',
  head: 'head',
  heads: 'head',
  loaf: 'loaf',
  loaves: 'loaf',
  dozen: 'dozen',
  pack: 'pack',
  packs: 'pack',
  package: 'pack',
  packages: 'pack',
  gallon: 'gallon',
  gallons: 'gallon',
  quart: 'quart',
  quarts: 'quart',
  stick: 'stick',
  sticks: 'stick',
  block: 'block',
  blocks: 'block',
  container: 'container',
  containers: 'container',
  count: 'count',
};

/** Exported for reuse by lib/cookingMutations.ts, which needs the same
 * unit-synonym normalization when proposing inventory deductions. */
export function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase();
  return UNIT_SYNONYMS[key] ?? key;
}

/** Matches a single recipe ingredient against the given inventory. */
export function matchIngredient(
  ingredient: Pick<RecipeIngredient, 'canonical_food_id' | 'quantity_value' | 'quantity_unit'>,
  inventoryItems: InventoryItem[]
): IngredientMatch {
  if (!ingredient.canonical_food_id) {
    return { status: 'missing', available_quantity: null, matched_inventory_item_ids: [] };
  }

  const matches = inventoryItems.filter(
    (item) => item.canonical_food_id === ingredient.canonical_food_id
  );
  if (matches.length === 0) {
    return { status: 'missing', available_quantity: null, matched_inventory_item_ids: [] };
  }

  const matchedIds = matches.map((item) => item.id);
  const anyUncertain = matches.some((item) => isUncertain(item));

  // No specific quantity requested — presence in inventory is enough.
  if (ingredient.quantity_value == null) {
    return {
      status: anyUncertain ? 'verify' : 'have',
      available_quantity: null,
      matched_inventory_item_ids: matchedIds,
    };
  }

  const requestedUnit = normalizeUnit(ingredient.quantity_unit);
  const comparable = matches.filter(
    (item) => item.quantity_value != null && normalizeUnit(item.quantity_unit) === requestedUnit
  );

  if (comparable.length === 0) {
    // Matched the food itself, but nothing with a quantity we can compare
    // in the same unit — can't confidently say "have" or "missing".
    return { status: 'verify', available_quantity: null, matched_inventory_item_ids: matchedIds };
  }

  const totalAvailable = comparable.reduce((sum, item) => sum + (item.quantity_value ?? 0), 0);

  if (anyUncertain) {
    return { status: 'verify', available_quantity: totalAvailable, matched_inventory_item_ids: matchedIds };
  }

  return {
    status: totalAvailable >= ingredient.quantity_value ? 'have' : 'missing',
    available_quantity: totalAvailable,
    matched_inventory_item_ids: matchedIds,
  };
}

/** Matches every ingredient in a recipe and computes overall coverage. */
export function matchRecipeToInventory(
  ingredients: RecipeIngredient[],
  inventoryItems: InventoryItem[]
): RecipeMatchResult {
  const matched = ingredients.map((ingredient) => ({
    ...ingredient,
    inventory_match: matchIngredient(ingredient, inventoryItems),
  }));

  const haveCount = matched.filter((ing) => ing.inventory_match.status === 'have').length;
  const missingIngredientCount = matched.filter(
    (ing) => ing.inventory_match.status === 'missing'
  ).length;

  return {
    ingredients: matched,
    pantryCoverageLabel: `${haveCount} of ${matched.length} ingredients`,
    haveCount,
    totalCount: matched.length,
    missingIngredientCount,
  };
}

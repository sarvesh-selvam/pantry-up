// Deno port of lib/recipeMatching.ts — same algorithm, kept in sync
// manually (see that file's header). Self-contained, only the fields it
// needs, same pattern as the rest of supabase/functions/_shared/.

export interface MatchInventoryItem {
  id: string;
  canonical_food_id: string | null;
  quantity_value: number | null;
  quantity_unit: string | null;
  verification_status: string;
}

export type IngredientMatchStatus = 'have' | 'verify' | 'missing';

export interface IngredientMatch {
  status: IngredientMatchStatus;
  available_quantity: number | null;
  matched_inventory_item_ids: string[];
}

export interface MatchableIngredient {
  canonical_food_id: string | null;
  quantity_value: number | null;
  quantity_unit: string | null;
}

const UNIT_SYNONYMS: Record<string, string> = {
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg',
  cup: 'cup', cups: 'cup',
  can: 'can', cans: 'can',
  jar: 'jar', jars: 'jar',
  bottle: 'bottle', bottles: 'bottle',
  bunch: 'bunch', bunches: 'bunch',
  clove: 'clove', cloves: 'clove',
  stalk: 'stalk', stalks: 'stalk',
  head: 'head', heads: 'head',
  loaf: 'loaf', loaves: 'loaf',
  dozen: 'dozen',
  pack: 'pack', packs: 'pack', package: 'pack', packages: 'pack',
  gallon: 'gallon', gallons: 'gallon',
  quart: 'quart', quarts: 'quart',
  stick: 'stick', sticks: 'stick',
  block: 'block', blocks: 'block',
  container: 'container', containers: 'container',
  count: 'count',
};

function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase();
  return UNIT_SYNONYMS[key] ?? key;
}

function isUncertain(item: MatchInventoryItem): boolean {
  return item.verification_status === 'ai_estimated' || item.verification_status === 'needs_verification';
}

export function matchIngredient(
  ingredient: MatchableIngredient,
  inventoryItems: MatchInventoryItem[]
): IngredientMatch {
  if (!ingredient.canonical_food_id) {
    return { status: 'missing', available_quantity: null, matched_inventory_item_ids: [] };
  }

  const matches = inventoryItems.filter((item) => item.canonical_food_id === ingredient.canonical_food_id);
  if (matches.length === 0) {
    return { status: 'missing', available_quantity: null, matched_inventory_item_ids: [] };
  }

  const matchedIds = matches.map((item) => item.id);
  const anyUncertain = matches.some(isUncertain);

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

export function matchRecipeToInventory<T extends MatchableIngredient>(
  ingredients: T[],
  inventoryItems: MatchInventoryItem[]
): {
  ingredients: (T & { inventory_match: IngredientMatch })[];
  pantryCoverageLabel: string;
  haveCount: number;
  totalCount: number;
  missingIngredientCount: number;
} {
  const matched = ingredients.map((ingredient) => ({
    ...ingredient,
    inventory_match: matchIngredient(ingredient, inventoryItems),
  }));

  const haveCount = matched.filter((ing) => ing.inventory_match.status === 'have').length;
  const missingIngredientCount = matched.filter((ing) => ing.inventory_match.status === 'missing').length;

  return {
    ingredients: matched,
    pantryCoverageLabel: `${haveCount} of ${matched.length} ingredients`,
    haveCount,
    totalCount: matched.length,
    missingIngredientCount,
  };
}

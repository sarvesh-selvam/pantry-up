// Pure helpers for the shopping list ("Need to Buy") — no queries, no LLM.

import type {
  CanonicalFood,
  FoodCategory,
  ShoppingItem,
  StorageLocation,
} from '../../types/database';
import type { RecipeIngredient } from '../../types/recipe';

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat & Seafood',
  grains: 'Grains & Bread',
  canned_goods: 'Canned Goods',
  condiments: 'Condiments',
  pantry_staple: 'Pantry Staples',
  prepared: 'Prepared',
  other: 'Other',
};

const CATEGORY_ORDER: FoodCategory[] = [
  'produce',
  'dairy',
  'meat',
  'grains',
  'canned_goods',
  'condiments',
  'pantry_staple',
  'prepared',
  'other',
];

export interface ShoppingSection {
  key: string;
  title: string;
  data: ShoppingItem[];
}

/** Unchecked items grouped by category in a fixed aisle-ish order, with
 * unmatched free-text items in "Uncategorized" and checked items in their
 * own section — both at the bottom. */
export function groupShoppingItems(items: ShoppingItem[]): ShoppingSection[] {
  const byCategory = new Map<FoodCategory | null, ShoppingItem[]>();
  const checked: ShoppingItem[] = [];
  for (const item of items) {
    if (item.is_checked) {
      checked.push(item);
      continue;
    }
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const sections: ShoppingSection[] = CATEGORY_ORDER.filter((category) => byCategory.get(category)?.length).map(
    (category) => ({
      key: category,
      title: FOOD_CATEGORY_LABELS[category],
      data: byCategory.get(category) ?? [],
    })
  );
  const uncategorized = byCategory.get(null);
  if (uncategorized?.length) {
    sections.push({ key: 'uncategorized', title: 'Uncategorized', data: uncategorized });
  }
  if (checked.length) {
    sections.push({ key: 'checked', title: 'Checked', data: checked });
  }
  return sections;
}

/** Instant, deterministic match for the common case of typing a plain food
 * name ("milk", "scallions") — exact canonical name or alias, case- and
 * trailing-"s"-insensitive. Anything fancier ("2 lemons", "a bag of rice")
 * falls through to the quick-add-parse Edge Function. */
export function findExactCanonicalMatch(text: string, canonicalFoods: CanonicalFood[]): CanonicalFood | null {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/s$/, '');
  const needle = normalize(text);
  if (!needle) return null;
  return (
    canonicalFoods.find((food) =>
      [food.canonical_name, ...food.aliases].some((name) => normalize(name) === needle)
    ) ?? null
  );
}

/** Where a freshly bought item most likely goes — editable per item on the
 * review screen. Unknown categories default to the pantry shelf. */
export function defaultStorageLocation(category: FoodCategory | null): StorageLocation {
  switch (category) {
    case 'produce':
    case 'dairy':
    case 'meat':
    case 'prepared':
      return 'fridge';
    default:
      return 'pantry';
  }
}

/** Splits a recipe's Missing ingredients into ones to add vs. ones already
 * on the list (unchecked). Matched ingredients dedupe by canonical_food_id;
 * unmatched ones fall back to a case-insensitive display-name comparison so
 * re-tapping the button doesn't pile up duplicate free-text rows either. */
export function partitionMissingIngredients(
  missing: RecipeIngredient[],
  shoppingItems: ShoppingItem[]
): { toAdd: RecipeIngredient[]; alreadyListed: RecipeIngredient[] } {
  const unchecked = shoppingItems.filter((item) => !item.is_checked);
  const listedFoodIds = new Set(unchecked.map((item) => item.canonical_food_id).filter(Boolean));
  const listedNames = new Set(
    unchecked.filter((item) => !item.canonical_food_id).map((item) => item.display_name.trim().toLowerCase())
  );

  const toAdd: RecipeIngredient[] = [];
  const alreadyListed: RecipeIngredient[] = [];
  for (const ingredient of missing) {
    const isListed = ingredient.canonical_food_id
      ? listedFoodIds.has(ingredient.canonical_food_id)
      : listedNames.has(ingredient.display_name.trim().toLowerCase());
    if (isListed) {
      alreadyListed.push(ingredient);
    } else {
      toAdd.push(ingredient);
      // Guard against the same food appearing twice in one recipe.
      if (ingredient.canonical_food_id) listedFoodIds.add(ingredient.canonical_food_id);
      else listedNames.add(ingredient.display_name.trim().toLowerCase());
    }
  }
  return { toAdd, alreadyListed };
}

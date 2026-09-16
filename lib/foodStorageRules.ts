import type { FoodStorageRule, InventoryItem } from '../types/database';

/**
 * Finds the food_storage_rules row (if any) backing an item's
 * expiry_estimated, so the UI can tell a quality/freshness estimate apart
 * from a food-safety-critical one (is_safety_critical) — these must read in
 * a different tone, per PantryUp's uncertainty rule. Mirrors the lookup done
 * server-side by the compute_expiry_estimated trigger (falls back to the
 * unopened rule when there's no opened-specific one).
 */
export function findStorageRule(
  item: Pick<InventoryItem, 'canonical_food_id' | 'preparation_state' | 'storage_location' | 'opened_at'>,
  rules: FoodStorageRule[]
): FoodStorageRule | null {
  if (!item.canonical_food_id) return null;

  const isOpened = item.opened_at != null;
  const matches = rules.filter(
    (rule) =>
      rule.canonical_food_id === item.canonical_food_id &&
      rule.preparation_state === item.preparation_state &&
      rule.storage_location === item.storage_location
  );

  return (
    matches.find((rule) => rule.is_opened === isOpened) ??
    (isOpened ? matches.find((rule) => !rule.is_opened) : undefined) ??
    null
  );
}

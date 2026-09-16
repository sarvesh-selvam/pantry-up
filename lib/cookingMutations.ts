// Inventory mutation proposal engine — Phase 4's "Reconcile" step.
// Deterministic, no LLM: given a recipe's ingredients, the user's current
// inventory, and how many servings were actually made, proposes specific
// deductions from specific inventory_items. Nothing here writes anything —
// see app/recipe/[id]/finish.tsx for where a user-confirmed proposal is
// actually applied via InventoryContext.editItem/removeItem.
//
// Two deduction modes:
//  - 'quantity': the ingredient and a matched item both have a numeric
//    quantity in a comparable unit — deduct a scaled amount, spread across
//    matched items (oldest/first match first) until covered.
//  - 'state': the matched item only has an approximate quantity_state
//    (e.g. "Half") — step it down one level (Full -> Mostly Full -> Half ->
//    Low -> Almost Empty). Never auto-removed; Almost Empty is a floor, per
//    PantryUp's "leave it at Almost Empty" default.
// An ingredient with no canonical match, or a match with neither a
// comparable quantity nor a quantity_state, produces no proposal — nothing
// to responsibly adjust.

import { normalizeUnit } from './recipeMatching';
import type { InventoryItem, QuantityState } from '../types/database';
import type { RecipeIngredient } from '../types/recipe';

export type MutationMode = 'quantity' | 'state';

export interface ProposedMutation {
  key: string;
  inventoryItemId: string;
  inventoryDisplayName: string;
  recipeIngredientDisplayName: string;
  mode: MutationMode;
  quantityUnit: string | null;
  currentQuantityValue: number | null;
  /** Editable by the user before confirming. */
  deductQuantityValue: number | null;
  currentState: QuantityState | null;
  nextState: QuantityState | null;
  /** Editable by the user before confirming — unchecking excludes this
   * mutation entirely. */
  included: boolean;
}

const STATE_STEP_DOWN: Record<QuantityState, QuantityState> = {
  full: 'mostly_full',
  mostly_full: 'half',
  half: 'low',
  low: 'almost_empty',
  almost_empty: 'almost_empty',
};

/**
 * Proposes inventory deductions for a recipe cooked at `servingsPrepared`
 * out of the recipe's stated `recipeServings` (scales quantity-mode
 * ingredients proportionally; state-mode step-downs are servings-agnostic
 * by design — "used some of the half-full jar" doesn't scale linearly).
 */
export function proposeInventoryMutations(
  ingredients: RecipeIngredient[],
  inventoryItems: InventoryItem[],
  servingsPrepared: number,
  recipeServings: number | null
): ProposedMutation[] {
  const servingsRatio = recipeServings && recipeServings > 0 ? servingsPrepared / recipeServings : 1;
  const proposals: ProposedMutation[] = [];

  for (const ingredient of ingredients) {
    if (!ingredient.canonical_food_id) continue;

    const matches = inventoryItems.filter(
      (item) => item.canonical_food_id === ingredient.canonical_food_id
    );
    if (matches.length === 0) continue; // Missing — nothing to deduct

    if (ingredient.quantity_value != null) {
      const requestedUnit = normalizeUnit(ingredient.quantity_unit);
      const comparable = matches.filter(
        (item) => item.quantity_value != null && normalizeUnit(item.quantity_unit) === requestedUnit
      );

      if (comparable.length > 0) {
        let remaining = ingredient.quantity_value * servingsRatio;
        for (const item of comparable) {
          if (remaining <= 0) break;
          const available = item.quantity_value ?? 0;
          const deduct = Math.min(available, remaining);
          if (deduct <= 0) continue;
          proposals.push({
            key: `${ingredient.canonical_food_id}-${item.id}`,
            inventoryItemId: item.id,
            inventoryDisplayName: item.display_name,
            recipeIngredientDisplayName: ingredient.display_name,
            mode: 'quantity',
            quantityUnit: item.quantity_unit,
            currentQuantityValue: available,
            deductQuantityValue: roundToTwoDecimals(deduct),
            currentState: null,
            nextState: null,
            included: true,
          });
          remaining -= deduct;
        }
        continue;
      }
    }

    // Approximate/state-based ingredient — step down the first matched
    // item. (If multiple items match, we only touch one; picking which one
    // to deduct a fractional "some of it" from more precisely isn't
    // meaningful without real quantities.)
    const primary = matches[0];
    if (primary.quantity_state) {
      proposals.push({
        key: `${ingredient.canonical_food_id}-${primary.id}`,
        inventoryItemId: primary.id,
        inventoryDisplayName: primary.display_name,
        recipeIngredientDisplayName: ingredient.display_name,
        mode: 'state',
        quantityUnit: null,
        currentQuantityValue: null,
        deductQuantityValue: null,
        currentState: primary.quantity_state,
        nextState: STATE_STEP_DOWN[primary.quantity_state],
        included: true,
      });
    }
    // Else: matched, but no quantity_value and no quantity_state at all —
    // nothing responsible to propose (e.g. a bare presence-only item).
  }

  return proposals;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

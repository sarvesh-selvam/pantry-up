// Real (LLM-backed) Quick Add normalization — Phase 2.
//
// This is the swap-in Phase 1 was built for: same exported
// `parseQuickAddText` name and `ParsedQuickAddItem` shape as the old
// deterministic regex/Levenshtein parser, but now backed by the
// quick-add-parse Supabase Edge Function (a server-side Claude call — the
// API key never touches the client). Callers just need to await the result
// and handle the network-error case a local function never had.
//
// The Edge Function only ever returns suggestions; it never writes to
// inventory_items. Every result from this module still goes through the
// Quick Add review/confirm screen before anything is saved. lib/receiptScanner.ts
// reuses the response shape and mapping below for the same reason.

import { supabase } from './supabase';
import { describeFunctionInvokeError } from './functionsError';
import { FOOD_CATEGORIES, type CanonicalFood, type FoodCategory } from '../types/database';

/** Coerces the model's free-text category guess into a known FoodCategory,
 * or null if it doesn't match one — never trust unvalidated model output
 * as a DB enum value. */
export function coerceFoodCategory(value: string | null): FoodCategory | null {
  if (!value) return null;
  return (FOOD_CATEGORIES as readonly string[]).includes(value) ? (value as FoodCategory) : null;
}

export interface ParsedQuickAddItem {
  /** The original phrase/line this item was parsed from. */
  rawText: string;
  /** Best-guess user-facing name, e.g. "chicken breasts". */
  displayName: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  /** Matched canonical food, if the model was confident enough. */
  canonicalFood: CanonicalFood | null;
  /** 0-1 model confidence in the canonical match — informational only, every
   * result from this parser is still saved as needs_verification. */
  matchScore: number;
  /** The model's best-guess food category, used when there's no canonical match. */
  categoryGuess: string | null;
}

/** The JSON shape both quick-add-parse and receipt-scan return per item. */
export interface NormalizedItemResponse {
  raw_text: string;
  canonical_food_id_guess: string | null;
  display_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  category_guess: string | null;
  confidence: number;
}

/** Shared by quickAddParser and receiptScanner — same response contract. */
export function mapNormalizedItems(
  items: NormalizedItemResponse[],
  canonicalFoods: CanonicalFood[]
): ParsedQuickAddItem[] {
  const foodsById = new Map(canonicalFoods.map((food) => [food.id, food]));
  return items.map((item) => ({
    rawText: item.raw_text,
    displayName: item.display_name,
    quantityValue: item.quantity_value,
    quantityUnit: item.quantity_unit,
    canonicalFood: item.canonical_food_id_guess
      ? (foodsById.get(item.canonical_food_id_guess) ?? null)
      : null,
    matchScore: item.confidence,
    categoryGuess: item.category_guess,
  }));
}

/**
 * Sends freeform Quick Add text (e.g. "2 chicken breasts, milk, onions,
 * cilantro and rice") to the quick-add-parse Edge Function and returns
 * structured suggestions. Throws if the request fails or the model's
 * response couldn't be parsed at all — the caller should surface that as an
 * error rather than silently falling back to nothing.
 */
export async function parseQuickAddText(
  text: string,
  canonicalFoods: CanonicalFood[]
): Promise<ParsedQuickAddItem[]> {
  const { data, error } = await supabase.functions.invoke<{ items: NormalizedItemResponse[] }>(
    'quick-add-parse',
    { body: { text } }
  );

  if (error) {
    throw new Error(await describeFunctionInvokeError(error, 'Quick Add parsing failed'));
  }
  if (!data) {
    throw new Error('Quick Add parsing returned no data');
  }

  return mapNormalizedItems(data.items, canonicalFoods);
}

// Shared normalization pipeline used by BOTH quick-add-parse and
// receipt-scan: the prompt fragment that describes canonical_foods and the
// required output shape, and the parser/validator for the model's response.
// This is what "reuse the normalization pipeline from Quick Add" means in
// practice — one prompt contract, one response validator, two entry points
// (free text vs. a receipt photo) that each build a user message around it.

export interface CanonicalFoodRef {
  id: string;
  canonical_name: string;
  category: string;
  aliases: string[];
}

export interface NormalizedItem {
  raw_text: string;
  canonical_food_id_guess: string | null;
  display_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  category_guess: string | null;
  /** 0-1 model-reported confidence in the canonical match. Informational —
   * every LLM-sourced item is created as needs_verification regardless. */
  confidence: number;
}

export function buildCanonicalFoodsReference(canonicalFoods: CanonicalFoodRef[]): string {
  const lines = canonicalFoods.map(
    (food) =>
      `- id=${food.id} name="${food.canonical_name}" category=${food.category}${
        food.aliases.length ? ` aliases=[${food.aliases.join(', ')}]` : ''
      }`
  );
  return lines.join('\n');
}

export const NORMALIZATION_OUTPUT_INSTRUCTIONS = `
Respond with ONLY a JSON array (no prose, no markdown code fences). Each
element must have exactly these fields:

{
  "raw_text": string,               // the original item text/phrase this came from
  "canonical_food_id_guess": string | null,  // the "id" of the best-matching food from
                                              // the reference list below, or null if none
                                              // is a confident match
  "display_name": string,           // a clean, human-readable name for this item
  "quantity_value": number | null,  // numeric quantity if stated or legible, else null
  "quantity_unit": string | null,   // unit if stated or legible (e.g. "lb", "oz", "can"), else null
  "category_guess": string | null,  // your best guess at a food category even if canonical_food_id_guess is null
  "confidence": number              // 0 to 1, your confidence in canonical_food_id_guess
}

Only set canonical_food_id_guess to an id that literally appears in the
reference list. If you are not reasonably confident of a match, set it to
null and confidence to a low number rather than guessing — do not invent an
id. Never invent items that are not actually present in the input.`.trim();

/**
 * Parses and validates the model's JSON array response. Malformed entries
 * are dropped rather than thrown on the whole batch — one bad line item
 * shouldn't sink the rest of a receipt. Returns an empty array (never
 * throws on malformed *entries*) so the caller can decide how to surface
 * "nothing usable came back" to the user.
 */
export function parseNormalizedItems(
  rawResponseText: string,
  validCanonicalFoodIds: Set<string>
): NormalizedItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch {
    throw new Error('Model did not return valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Model response was not a JSON array');
  }

  const results: NormalizedItem[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const rawText = typeof record.raw_text === 'string' ? record.raw_text : null;
    const displayName = typeof record.display_name === 'string' ? record.display_name : null;
    if (!rawText || !displayName) continue;

    const canonicalFoodIdGuess =
      typeof record.canonical_food_id_guess === 'string' &&
      validCanonicalFoodIds.has(record.canonical_food_id_guess)
        ? record.canonical_food_id_guess
        : null;

    const quantityValue =
      typeof record.quantity_value === 'number' && Number.isFinite(record.quantity_value)
        ? record.quantity_value
        : null;

    const quantityUnit = typeof record.quantity_unit === 'string' ? record.quantity_unit : null;
    const categoryGuess = typeof record.category_guess === 'string' ? record.category_guess : null;

    const rawConfidence = typeof record.confidence === 'number' ? record.confidence : 0;
    const confidence = Math.min(1, Math.max(0, rawConfidence));

    results.push({
      raw_text: rawText,
      canonical_food_id_guess: canonicalFoodIdGuess,
      display_name: displayName,
      quantity_value: quantityValue,
      quantity_unit: quantityUnit,
      category_guess: categoryGuess,
      confidence,
    });
  }

  return results;
}

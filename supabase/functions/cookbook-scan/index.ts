// Cookbook Scan — extracts a recipe (title, ingredients, instructions) from
// a photo of a physical cookbook page. Reuses the same private "receipts"
// Storage bucket as receipt-scan (a `cookbook/` path prefix keeps the two
// apart — see lib/api/receipts.ts) and the same canonical-food matching
// contract as quick-add-parse/receipt-scan for the ingredients list.
//
// Input: { storagePath: string }
// Output: { recipe: ScannedRecipeDraft } — a suggestion only. This function
// never writes to `recipes`; the client always routes the result through a
// review/confirm screen (app/(tabs)/cookbook/scan-review.tsx) before saving
// anything, same "user confirmation controls state" principle as every
// other scan/normalization flow in this app.
//
// Nutrition for the extracted ingredients is computed the same
// deterministic way as recipe generation (_shared/nutritionCalculation.ts)
// — never asked of or invented by the vision model.

import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { corsHeaders } from '../_shared/cors.ts';
import { getUserSupabaseClient } from '../_shared/supabaseClient.ts';
import { CLAUDE_MODEL, extractResponseText, getAnthropicClient } from '../_shared/anthropic.ts';
import { buildCanonicalFoodsReference, type CanonicalFoodRef } from '../_shared/matching.ts';
import { computeRecipeNutrition, type NutritionDataRow } from '../_shared/nutritionCalculation.ts';

interface ScannedIngredient {
  raw_text: string;
  canonical_food_id_guess: string | null;
  display_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  confidence: number;
}

// Below this, an individual ingredient's match is untrusted enough to help
// tip the whole recipe into needs_verification — same spirit as Phase 2's
// per-item confidence threshold, just aggregated to one recipe-level flag
// per spec ("simple per-field or whole-recipe needs_verification
// indicator" — this picks whole-recipe for simplicity).
const LOW_CONFIDENCE_THRESHOLD = 0.5;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const { storagePath } = await req.json();
    if (typeof storagePath !== 'string' || !storagePath.trim()) {
      return jsonResponse({ error: '"storagePath" is required' }, 400);
    }

    const supabase = getUserSupabaseClient(authHeader);

    const { data: imageBlob, error: downloadError } = await supabase.storage
      .from('receipts')
      .download(storagePath);
    if (downloadError || !imageBlob) {
      return jsonResponse(
        { error: `Failed to download cookbook page image: ${downloadError?.message ?? 'not found'}` },
        404
      );
    }

    const [canonicalFoodsResult, nutritionResult] = await Promise.all([
      supabase.from('canonical_foods').select('id, canonical_name, category, aliases'),
      supabase
        .from('nutrition_data')
        .select('canonical_food_id, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g'),
    ]);
    if (canonicalFoodsResult.error) {
      return jsonResponse({ error: `Failed to load canonical foods: ${canonicalFoodsResult.error.message}` }, 500);
    }
    if (nutritionResult.error) {
      return jsonResponse({ error: `Failed to load nutrition data: ${nutritionResult.error.message}` }, 500);
    }

    const foodRefs = (canonicalFoodsResult.data ?? []) as CanonicalFoodRef[];
    const validIds = new Set(foodRefs.map((food) => food.id));
    const nutritionData = (nutritionResult.data ?? []) as NutritionDataRow[];

    const imageBase64 = encodeBase64(await imageBlob.arrayBuffer());

    const system = `You extract a recipe from a photo of a physical cookbook page.

Only extract what is actually printed and legible: title, description,
cuisine, servings, prep/cook time, ingredients (with quantities where
legible), and numbered/bulleted instructions. Do NOT invent anything not
visible on the page — if a field isn't present or isn't legible, use null
(or omit it from an ingredient's quantity) rather than guessing.

Match each ingredient against the reference list of known foods below.

Reference foods:
${buildCanonicalFoodsReference(foodRefs)}

Respond with ONLY a JSON object (no prose, no markdown fences) with exactly
these fields:

{
  "title": string,
  "title_confidence": number,        // 0-1, how confident/legible the title was
  "description": string | null,
  "cuisine": string | null,
  "servings": number | null,
  "prep_time": number | null,        // minutes
  "cook_time": number | null,        // minutes
  "ingredients": [
    {
      "raw_text": string,                        // exactly as printed
      "canonical_food_id_guess": string | null,   // an "id" from the reference list, or null
      "display_name": string,
      "quantity_value": number | null,
      "quantity_unit": string | null,
      "confidence": number                        // 0-1, confidence in this line's extraction + match
    }
  ],
  "instructions": string[],           // ordered steps, exactly as printed/best transcription
  "instructions_confidence": number,  // 0-1, how legible the instructions were overall
  "tags": string[]
}

Only set canonical_food_id_guess to an id that literally appears in the
reference list above.`;

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Extract the recipe from this cookbook page.' },
          ],
        },
      ],
    });

    const draft = parseScannedRecipe(extractResponseText(response), validIds);
    const nutrition = computeRecipeNutrition(
      draft.ingredients.map((ing) => ({
        canonical_food_id: ing.canonical_food_id_guess,
        quantity_value: ing.quantity_value,
        quantity_unit: ing.quantity_unit,
      })),
      nutritionData,
      draft.servings
    );

    return jsonResponse({ recipe: { ...draft, nutrition } });
  } catch (err) {
    console.error('cookbook-scan error', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

interface ScannedRecipeDraft {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  ingredients: ScannedIngredient[];
  instructions: string[];
  tags: string[];
  needs_verification: boolean;
}

function parseScannedRecipe(rawResponseText: string, validCanonicalFoodIds: Set<string>): ScannedRecipeDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch {
    throw new Error('Model did not return valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Model response was not a JSON object');
  }
  const record = parsed as Record<string, unknown>;

  const title = typeof record.title === 'string' && record.title.trim() ? record.title : 'Untitled recipe';
  const titleConfidence = typeof record.title_confidence === 'number' ? record.title_confidence : 0;

  const rawIngredients = Array.isArray(record.ingredients) ? record.ingredients : [];
  const ingredients: ScannedIngredient[] = rawIngredients
    .map((raw: unknown) => {
      if (typeof raw !== 'object' || raw === null) return null;
      const r = raw as Record<string, unknown>;
      const displayName = typeof r.display_name === 'string' ? r.display_name : null;
      const rawText = typeof r.raw_text === 'string' ? r.raw_text : displayName;
      if (!displayName || !rawText) return null;

      const canonicalFoodIdGuess =
        typeof r.canonical_food_id_guess === 'string' && validCanonicalFoodIds.has(r.canonical_food_id_guess)
          ? r.canonical_food_id_guess
          : null;

      return {
        raw_text: rawText,
        canonical_food_id_guess: canonicalFoodIdGuess,
        display_name: displayName,
        quantity_value: typeof r.quantity_value === 'number' && Number.isFinite(r.quantity_value) ? r.quantity_value : null,
        quantity_unit: typeof r.quantity_unit === 'string' ? r.quantity_unit : null,
        confidence: Math.min(1, Math.max(0, typeof r.confidence === 'number' ? r.confidence : 0)),
      } satisfies ScannedIngredient;
    })
    .filter((ing): ing is ScannedIngredient => ing !== null);

  const instructions = Array.isArray(record.instructions)
    ? record.instructions.filter((s: unknown): s is string => typeof s === 'string')
    : [];
  const instructionsConfidence =
    typeof record.instructions_confidence === 'number' ? record.instructions_confidence : 0;

  const anyLowConfidenceIngredient = ingredients.some(
    (ing) => ing.confidence < LOW_CONFIDENCE_THRESHOLD || !ing.canonical_food_id_guess
  );
  const needsVerification =
    titleConfidence < LOW_CONFIDENCE_THRESHOLD ||
    instructionsConfidence < LOW_CONFIDENCE_THRESHOLD ||
    anyLowConfidenceIngredient ||
    ingredients.length === 0 ||
    instructions.length === 0;

  return {
    title,
    description: typeof record.description === 'string' ? record.description : null,
    cuisine: typeof record.cuisine === 'string' ? record.cuisine : null,
    servings: typeof record.servings === 'number' ? record.servings : null,
    prep_time: typeof record.prep_time === 'number' ? record.prep_time : null,
    cook_time: typeof record.cook_time === 'number' ? record.cook_time : null,
    ingredients,
    instructions,
    tags: Array.isArray(record.tags) ? record.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    needs_verification: needsVerification,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

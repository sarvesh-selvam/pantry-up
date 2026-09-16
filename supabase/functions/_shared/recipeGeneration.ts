// Recipe generation — shared by the Sous Chef chat's generate_recipe tool
// and the automatic recipe-suggestions function for Home's "What should I
// cook?" section. One Claude call produces a batch of candidate recipes;
// findDietaryViolations (dietaryRestrictions.ts) then structurally checks
// every one before it's allowed out of this module — dietary restrictions
// and allergies are a HARD constraint here, not just a system-prompt
// request the model might ignore. Non-compliant recipes are discarded and
// regenerated (see generateRecipes), never silently served.
//
// PantryUp's AI priority order, enforced by prompt structure + the
// validation above (safety/dietary are structural; everything after is
// ordering guidance to the model):
//   food safety > dietary restrictions > user's explicit request >
//   rescue ingredients > pantry availability > cooking time >
//   cuisine preference > nutrition preference > equipment > variety

import { CLAUDE_MODEL, extractResponseText, getAnthropicClient } from './anthropic.ts';
import { buildCanonicalFoodsReference, type CanonicalFoodRef } from './matching.ts';
import { findDietaryViolations, splitEnforceableRestrictions } from './dietaryRestrictions.ts';
import { computeRecipeNutrition, type NutritionDataRow, type RecipeNutrition } from './nutritionCalculation.ts';

const MAX_GENERATION_ATTEMPTS = 3;

export interface GenerationContext {
  /** Free-text description of what the user wants, or a generic prompt
   * ("use what's in the pantry, especially items that need using soon")
   * for the automatic Home suggestions path. */
  constraints: string;
  maxTimeMinutes: number | null;
  excludedIngredients: string[];
  inventorySummaryLines: string[];
  rescueItemNames: string[];
  dietaryRestrictions: string[];
  cuisineWeights: Record<string, number>;
  skillLevel: string;
  canonicalFoods: CanonicalFoodRef[];
  nutritionData: NutritionDataRow[];
}

export interface GeneratedRecipeIngredient {
  canonical_food_id: string | null;
  display_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  verification_status: 'confirmed' | 'needs_verification';
}

export interface GeneratedRecipe {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  ingredients: GeneratedRecipeIngredient[];
  instructions: string[];
  tags: string[];
  why_this_works: string;
  rescued_ingredient_names: string[];
  /** Deterministic — computed from nutrition_data after generation, never
   * asked of or invented by the model. See computeNutritionForRecipes below. */
  nutrition: RecipeNutrition | null;
}

function buildSystemPrompt(ctx: GenerationContext, recipeCount: number, correction?: string): string {
  const { enforced, promptOnly } = splitEnforceableRestrictions(ctx.dietaryRestrictions);

  return `You are Sous Chef, PantryUp's recipe-generation assistant. Generate ${recipeCount} recipe(s) as a JSON array — no prose, no markdown fences, ONLY the array.

PRIORITY ORDER when there's a conflict (highest first): food safety, dietary restrictions/allergies, the user's explicit request, using rescue (soon-to-expire/low-quantity/leftover) ingredients, using ingredients already in the pantry, staying within any stated time limit, cuisine preference, nutrition preference, available equipment, recipe variety.

HARD CONSTRAINTS — recipes containing any of these will be automatically rejected, so do not include them under any circumstances: ${enforced.length ? enforced.join(', ') : '(none structurally enforced this request)'}.
${promptOnly.length ? `Also respect (best-effort, not automatically checked): ${promptOnly.join(', ')}.` : ''}
Excluded ingredients the user asked to avoid: ${ctx.excludedIngredients.length ? ctx.excludedIngredients.join(', ') : '(none)'}

User's request / constraints: "${ctx.constraints}"
${ctx.maxTimeMinutes ? `Must be completable in ${ctx.maxTimeMinutes} minutes or less (prep + cook).` : ''}

Current pantry inventory:
${ctx.inventorySummaryLines.length ? ctx.inventorySummaryLines.join('\n') : '(pantry is empty)'}

Items that need using soon (expiring, low quantity, or aging leftovers) — prefer recipes that use these:
${ctx.rescueItemNames.length ? ctx.rescueItemNames.join(', ') : '(none right now)'}

Cuisine preference (soft signal only, weights 0-1): ${JSON.stringify(ctx.cuisineWeights)}
Cook's skill level: ${ctx.skillLevel}

Reference foods (match each ingredient to one of these by id when it's a clear match; use null if none fits well):
${buildCanonicalFoodsReference(ctx.canonicalFoods)}

Each array element must have exactly these fields:
{
  "title": string,
  "description": string,
  "cuisine": string | null,
  "servings": number | null,
  "prep_time": number | null,   // minutes
  "cook_time": number | null,   // minutes
  "ingredients": [
    {
      "canonical_food_id_guess": string | null,  // an "id" from the reference list above, or null
      "display_name": string,
      "quantity_value": number | null,
      "quantity_unit": string | null
    }
  ],
  "instructions": string[],     // ordered steps
  "tags": string[],
  "why_this_works": string,     // 1-3 sentences: what pantry/rescue items it uses and why it fits the request — never just "AI recommended"
  "rescued_ingredient_names": string[]  // which of the rescue items above this recipe actually uses, if any
}

${correction ? `IMPORTANT CORRECTION: ${correction}` : ''}`.trim();
}

interface RawRecipeIngredient {
  canonical_food_id_guess?: unknown;
  display_name?: unknown;
  quantity_value?: unknown;
  quantity_unit?: unknown;
}

function parseGeneratedRecipes(
  rawResponseText: string,
  validCanonicalFoodIds: Set<string>
): GeneratedRecipe[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch {
    throw new Error('Model did not return valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Model response was not a JSON array');
  }

  const recipes: GeneratedRecipe[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const title = typeof record.title === 'string' ? record.title : null;
    const rawIngredients = Array.isArray(record.ingredients) ? record.ingredients : [];
    const rawInstructions = Array.isArray(record.instructions) ? record.instructions : [];
    if (!title || rawIngredients.length === 0 || rawInstructions.length === 0) continue;

    const ingredients: GeneratedRecipeIngredient[] = rawIngredients
      .map((raw: RawRecipeIngredient) => {
        if (typeof raw !== 'object' || raw === null) return null;
        const displayName = typeof raw.display_name === 'string' ? raw.display_name : null;
        if (!displayName) return null;

        const canonicalFoodIdGuess =
          typeof raw.canonical_food_id_guess === 'string' &&
          validCanonicalFoodIds.has(raw.canonical_food_id_guess)
            ? raw.canonical_food_id_guess
            : null;

        return {
          canonical_food_id: canonicalFoodIdGuess,
          display_name: displayName,
          quantity_value:
            typeof raw.quantity_value === 'number' && Number.isFinite(raw.quantity_value)
              ? raw.quantity_value
              : null,
          quantity_unit: typeof raw.quantity_unit === 'string' ? raw.quantity_unit : null,
          verification_status: canonicalFoodIdGuess ? 'confirmed' : 'needs_verification',
        } satisfies GeneratedRecipeIngredient;
      })
      .filter((ing): ing is GeneratedRecipeIngredient => ing !== null);

    if (ingredients.length === 0) continue;

    recipes.push({
      title,
      description: typeof record.description === 'string' ? record.description : null,
      cuisine: typeof record.cuisine === 'string' ? record.cuisine : null,
      servings: typeof record.servings === 'number' ? record.servings : null,
      prep_time: typeof record.prep_time === 'number' ? record.prep_time : null,
      cook_time: typeof record.cook_time === 'number' ? record.cook_time : null,
      ingredients,
      instructions: rawInstructions.filter((step: unknown): step is string => typeof step === 'string'),
      tags: Array.isArray(record.tags) ? record.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
      why_this_works:
        typeof record.why_this_works === 'string' ? record.why_this_works : 'Fits your request and pantry.',
      rescued_ingredient_names: Array.isArray(record.rescued_ingredient_names)
        ? record.rescued_ingredient_names.filter((n: unknown): n is string => typeof n === 'string')
        : [],
      nutrition: null, // filled in by computeNutritionForRecipes below, after parsing
    });
  }

  return recipes;
}

/** Computes deterministic per-serving nutrition for each recipe from
 * nutrition_data — a pure post-processing step over the model's already-
 * validated output, never something the model is asked to produce itself. */
function computeNutritionForRecipes(recipes: GeneratedRecipe[], nutritionData: NutritionDataRow[]): GeneratedRecipe[] {
  return recipes.map((recipe) => ({
    ...recipe,
    nutrition: computeRecipeNutrition(recipe.ingredients, nutritionData, recipe.servings),
  }));
}

async function requestRecipesFromModel(
  ctx: GenerationContext,
  recipeCount: number,
  correction: string | undefined
): Promise<GeneratedRecipe[]> {
  const anthropic = getAnthropicClient();
  const validIds = new Set(ctx.canonicalFoods.map((food) => food.id));

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    output_config: { effort: 'high' },
    system: buildSystemPrompt(ctx, recipeCount, correction),
    messages: [{ role: 'user', content: `Generate ${recipeCount} recipe(s) now.` }],
  });

  const parsed = parseGeneratedRecipes(extractResponseText(response), validIds);
  return computeNutritionForRecipes(parsed, ctx.nutritionData);
}

/**
 * Generates up to `recipeCount` recipes, structurally rejecting any that
 * violate the user's enforceable dietary restrictions and retrying to fill
 * the gap. Returns fewer than `recipeCount` if compliant ones couldn't be
 * produced within the attempt budget; throws only if none could be.
 */
export async function generateRecipes(
  ctx: GenerationContext,
  recipeCount: number
): Promise<GeneratedRecipe[]> {
  const validRecipes: GeneratedRecipe[] = [];
  let correction: string | undefined;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const remaining = recipeCount - validRecipes.length;
    if (remaining <= 0) break;

    const candidates = await requestRecipesFromModel(ctx, remaining, correction);
    const evaluated = candidates.map((recipe) => ({
      recipe,
      violations: findDietaryViolations(
        recipe.ingredients.map((ing) => ing.display_name),
        ctx.dietaryRestrictions
      ),
    }));

    const compliant = evaluated.filter((e) => e.violations.length === 0).map((e) => e.recipe);
    validRecipes.push(...compliant);

    const nonCompliant = evaluated.filter((e) => e.violations.length > 0);
    if (nonCompliant.length === 0) break;

    correction = `These suggestions violated hard dietary constraints and must not be repeated: ${nonCompliant
      .map(
        ({ recipe, violations }) =>
          `"${recipe.title}" contained ${violations
            .map((v) => `"${v.ingredientDisplayName}" (violates ${v.restriction})`)
            .join(', ')}`
      )
      .join('; ')}. Generate different recipe(s) that fully avoid these ingredients and close substitutes.`;
  }

  if (validRecipes.length === 0) {
    throw new Error(
      'Could not generate a recipe that complies with the required dietary restrictions after multiple attempts.'
    );
  }

  return validRecipes;
}

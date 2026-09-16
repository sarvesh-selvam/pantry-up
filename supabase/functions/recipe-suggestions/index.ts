// Automatic "What should I cook?" suggestions for Home — Phase 3, Section 5.
// No chat, no explicit user request: triggered on Home load, using rescue
// items + available pantry as implicit context. Same generate_recipe +
// match_recipe_to_inventory pipeline Sous Chef uses (recipeGeneration.ts +
// recipeMatching.ts), just invoked directly instead of via a tool-calling
// loop, since there's no conversation to orchestrate.

import { corsHeaders } from '../_shared/cors.ts';
import { getUserSupabaseClient } from '../_shared/supabaseClient.ts';
import { loadPantryContext } from '../_shared/pantryContext.ts';
import { generateRecipes } from '../_shared/recipeGeneration.ts';
import { buildRecipeSuggestionPayload, buildScoringContext } from '../_shared/recipePayload.ts';
import { findDietaryViolations } from '../_shared/dietaryRestrictions.ts';
import type { MatchInventoryItem } from '../_shared/recipeMatching.ts';

const SUGGESTION_COUNT = 4;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabase = getUserSupabaseClient(authHeader);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const ctx = await loadPantryContext(supabase, user.id);

    if (ctx.inventoryItems.length === 0) {
      return jsonResponse({ recipes: [] });
    }

    const recipes = await generateRecipes(
      {
        constraints:
          'No specific request from the user this time — suggest a variety of recipes using what is already in the pantry, prioritizing items that need to be used soon (rescue items). Surprise them.',
        maxTimeMinutes: null,
        excludedIngredients: [],
        inventorySummaryLines: ctx.inventorySummaryLines,
        rescueItemNames: ctx.rescueItemNames,
        dietaryRestrictions: ctx.dietaryRestrictions,
        cuisineWeights: ctx.cuisineWeights,
        skillLevel: ctx.skillLevel,
        equipment: ctx.equipment,
        canonicalFoods: ctx.canonicalFoods,
        nutritionData: ctx.nutritionData,
      },
      SUGGESTION_COUNT
    );

    // Defensive re-check: generateRecipes already only returns compliant
    // recipes (findDietaryViolations runs inside its own retry loop), so
    // this should always be a no-op — but ranking must never be the thing
    // that lets a violation slip through, so it's verified again right
    // here rather than trusted implicitly. See recipePayload.ts's header
    // comment.
    const compliantRecipes = recipes.filter(
      (recipe) =>
        findDietaryViolations(recipe.ingredients.map((ing) => ing.display_name), ctx.dietaryRestrictions).length === 0
    );
    if (compliantRecipes.length < recipes.length) {
      console.error(
        `recipe-suggestions: ${recipes.length - compliantRecipes.length} recipe(s) failed the defensive dietary re-check after generateRecipes already filtered — this should not happen`
      );
    }

    const inventoryItems = ctx.inventoryItems as unknown as MatchInventoryItem[];
    const scoringCtx = buildScoringContext(ctx, null);
    const suggestions = compliantRecipes
      .map((recipe) => buildRecipeSuggestionPayload(recipe, inventoryItems, scoringCtx))
      .sort((a, b) => b.score - a.score);

    return jsonResponse({ recipes: suggestions });
  } catch (err) {
    console.error('recipe-suggestions error', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

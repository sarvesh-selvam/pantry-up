// Shapes a generated + matched recipe into what both sous-chef-chat and
// recipe-suggestions send to the client — one place so the two entry
// points can't drift into slightly different card shapes.

import { matchRecipeToInventory, type MatchInventoryItem } from './recipeMatching.ts';
import type { GeneratedRecipe } from './recipeGeneration.ts';
import type { RecipeNutrition } from './nutritionCalculation.ts';
import type { RecipeYoutubeMetadata } from './youtubeSearch.ts';
import type { PantryContext } from './pantryContext.ts';
import {
  buildWhyBullets,
  computeRecipeScore,
  type RecipeScoreBreakdown,
  type ScoringContext,
} from './recommendationScoring.ts';

/** Builds the scoring context both entry points need from their already-
 * loaded PantryContext, plus the one thing PantryContext can't know:
 * whether THIS particular request stated a time limit (Home's automatic
 * suggestions never do; Sous Chef's generate_recipe tool call sometimes
 * does). One place so the two call sites can't construct this
 * differently by accident. */
export function buildScoringContext(ctx: PantryContext, maxTimeMinutes: number | null): ScoringContext {
  return {
    cuisineWeights: ctx.cuisineWeights,
    equipment: ctx.equipment,
    maxTimeMinutes,
    rescueEntries: ctx.rescueEntries,
    recentCookEvents: ctx.recentCookEvents,
  };
}

export interface RecipeSuggestionPayload {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  instructions: string[];
  tags: string[];
  ingredients: ReturnType<typeof matchRecipeToInventory>['ingredients'];
  pantry_coverage_label: string;
  missing_ingredient_count: number;
  why_this_works: string;
  /** Deterministic bullets built from score_breakdown's real numbers —
   * see recommendationScoring.ts's buildWhyBullets. The grounded
   * replacement for trusting `why_this_works` prose alone. */
  why_bullets: string[];
  score: number;
  score_breakdown: RecipeScoreBreakdown;
  rescued_ingredient_names: string[];
  nutrition: RecipeNutrition | null;
  equipment_needed: string[];
  /** Always null straight out of generation — see recipe-videos/index.ts's
   * header comment for why this isn't fetched eagerly for every generated
   * candidate (quota cost vs. suggestions nobody saves). */
  youtube_metadata: RecipeYoutubeMetadata | null;
}

/**
 * The single choke point both sous-chef-chat and recipe-suggestions call
 * — computes real pantry matching AND the deterministic recommendation
 * score in one place, so the two entry points can never drift into
 * different ranking behavior. `scoringCtx` carries everything
 * recommendationScoring.ts needs beyond the recipe/match themselves
 * (cuisine weights, equipment owned, any stated time limit, rescue
 * urgency, recent cook history) — see recipe-suggestions/index.ts and
 * sous-chef-chat/index.ts for how each builds one from its own
 * PantryContext.
 */
export function buildRecipeSuggestionPayload(
  recipe: GeneratedRecipe,
  inventoryItems: MatchInventoryItem[],
  scoringCtx: ScoringContext
): RecipeSuggestionPayload {
  const match = matchRecipeToInventory(recipe.ingredients, inventoryItems);
  const { score, breakdown } = computeRecipeScore(recipe, match, scoringCtx);
  const whyBullets = buildWhyBullets(recipe, match, breakdown, scoringCtx);

  return {
    title: recipe.title,
    description: recipe.description,
    cuisine: recipe.cuisine,
    servings: recipe.servings,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    instructions: recipe.instructions,
    tags: recipe.tags,
    ingredients: match.ingredients,
    pantry_coverage_label: match.pantryCoverageLabel,
    missing_ingredient_count: match.missingIngredientCount,
    why_this_works: recipe.why_this_works,
    why_bullets: whyBullets,
    score,
    score_breakdown: breakdown,
    rescued_ingredient_names: recipe.rescued_ingredient_names,
    nutrition: recipe.nutrition,
    equipment_needed: recipe.equipment_needed,
    youtube_metadata: null,
  };
}

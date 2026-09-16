// Shapes a generated + matched recipe into what both sous-chef-chat and
// recipe-suggestions send to the client — one place so the two entry
// points can't drift into slightly different card shapes.

import { matchRecipeToInventory, type MatchInventoryItem } from './recipeMatching.ts';
import type { GeneratedRecipe } from './recipeGeneration.ts';
import type { RecipeNutrition } from './nutritionCalculation.ts';
import type { RecipeYoutubeMetadata } from './youtubeSearch.ts';

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
  rescued_ingredient_names: string[];
  nutrition: RecipeNutrition | null;
  /** Always null straight out of generation — see recipe-videos/index.ts's
   * header comment for why this isn't fetched eagerly for every generated
   * candidate (quota cost vs. suggestions nobody saves). */
  youtube_metadata: RecipeYoutubeMetadata | null;
}

export function buildRecipeSuggestionPayload(
  recipe: GeneratedRecipe,
  inventoryItems: MatchInventoryItem[]
): RecipeSuggestionPayload {
  const match = matchRecipeToInventory(recipe.ingredients, inventoryItems);
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
    rescued_ingredient_names: recipe.rescued_ingredient_names,
    nutrition: recipe.nutrition,
    youtube_metadata: null,
  };
}

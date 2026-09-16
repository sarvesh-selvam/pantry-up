// Client for the recipe-videos Edge Function — identifies a recipe's key
// technique and runs a real YouTube search for it. See that function's
// header comment for the LLM/real-data boundary.

import { supabase } from '../supabase';
import { describeFunctionInvokeError } from '../functionsError';
import type { RecipeIngredient, RecipeYoutubeMetadata } from '../../types/recipe';

export interface RecipeVideoLookupInput {
  title: string;
  ingredients: string[];
  instructions: string[];
}

function ingredientLine(ingredient: Pick<RecipeIngredient, 'quantity_value' | 'quantity_unit' | 'display_name'>): string {
  const quantity =
    ingredient.quantity_value != null
      ? `${ingredient.quantity_value}${ingredient.quantity_unit ? ` ${ingredient.quantity_unit}` : ''} `
      : '';
  return `${quantity}${ingredient.display_name}`;
}

/** Shared by every call site (recipe detail, Sous Chef chat, Cooking Mode
 * doesn't need this — it reads already-cached metadata) so the ingredient
 * line formatting stays identical everywhere a lookup is triggered. */
export function toVideoLookupInput(recipe: {
  title: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
}): RecipeVideoLookupInput {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients.map(ingredientLine),
    instructions: recipe.instructions,
  };
}

export async function fetchRecipeVideos(recipe: RecipeVideoLookupInput): Promise<RecipeYoutubeMetadata> {
  const { data, error } = await supabase.functions.invoke<RecipeYoutubeMetadata>('recipe-videos', {
    body: { recipe },
  });

  if (error) {
    throw new Error(await describeFunctionInvokeError(error, 'Failed to look up technique videos'));
  }
  if (!data) {
    throw new Error('recipe-videos returned no data');
  }
  return data;
}

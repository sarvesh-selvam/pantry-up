import { supabase } from '../supabase';
import type { Recipe, RecipeInsert, RecipeSuggestion } from '../../types/recipe';

/** Maps a Sous Chef / Home suggestion payload to what `recipes` expects on
 * insert. `constraints` is the user's original request (or a fixed label
 * for automatic Home suggestions), used only for the explainability record. */
export function suggestionToRecipeInsert(suggestion: RecipeSuggestion, constraints: string): RecipeInsert {
  return {
    source_type: 'ai_generated',
    title: suggestion.title,
    description: suggestion.description,
    cuisine: suggestion.cuisine,
    servings: suggestion.servings,
    prep_time: suggestion.prep_time,
    cook_time: suggestion.cook_time,
    ingredients: suggestion.ingredients,
    instructions: suggestion.instructions,
    nutrition: null,
    youtube_metadata: null,
    tags: suggestion.tags,
    generated_context: {
      constraints,
      inventory_snapshot_summary: suggestion.pantry_coverage_label,
      rescue_items_used: suggestion.rescued_ingredient_names,
      dietary_restrictions_enforced: [],
      cuisine_preference_used: suggestion.cuisine,
      why_this_works: suggestion.why_this_works,
    },
  };
}

export async function createRecipe(userId: string, recipe: RecipeInsert): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...recipe, user_id: userId })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchRecipeById(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase.from('recipes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

import { supabase } from '../supabase';
import type { Recipe, RecipeInsert, RecipeSuggestion, RecipeYoutubeMetadata } from '../../types/recipe';

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
    nutrition: suggestion.nutrition,
    youtube_metadata: suggestion.youtube_metadata,
    equipment_needed: suggestion.equipment_needed,
    tags: suggestion.tags,
    is_favorite: false,
    generated_context: {
      constraints,
      inventory_snapshot_summary: suggestion.pantry_coverage_label,
      rescue_items_used: suggestion.rescued_ingredient_names,
      dietary_restrictions_enforced: [],
      cuisine_preference_used: suggestion.cuisine,
      why_this_works: suggestion.why_this_works,
      why_bullets: suggestion.why_bullets,
      score: suggestion.score,
      score_breakdown: suggestion.score_breakdown,
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

/** All of the user's saved recipes for Cookbook — AI-generated (Sous
 * Chef/Home suggestions), manual, and cookbook_scan alike; they're all
 * just rows in the same table, distinguished only by source_type. */
export async function fetchUserRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setRecipeFavorite(id: string, isFavorite: boolean): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Persists a recipe-videos lookup result onto an already-saved recipe —
 * the cache Phase 7's spec asks for ("don't re-search every time the
 * recipe is viewed"). Called after a lazy fetch on first detail-screen
 * view, or after a manual refresh; never called from generation, since
 * generated recipes never carry youtube_metadata until they're saved and
 * viewed (or, for Sous Chef, looked up client-side right after the reply). */
export async function updateRecipeYoutubeMetadata(
  id: string,
  youtubeMetadata: RecipeYoutubeMetadata
): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .update({ youtube_metadata: youtubeMetadata })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Cook events survive this — their recipe_id is set null and History
 * falls back to the title snapshot (0021). Leftovers and shopping items
 * that referenced the recipe keep existing with source_recipe_id null. */
export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

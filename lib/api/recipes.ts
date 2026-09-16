import { supabase } from '../supabase';
import type { Recipe, RecipeInsert } from '../../types/recipe';

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

import { supabase } from '../supabase';
import type { CookEvent, CookEventInsert } from '../../types/cookEvent';

export async function createCookEvent(userId: string, event: CookEventInsert): Promise<CookEvent> {
  const { data, error } = await supabase
    .from('cook_events')
    .insert({ ...event, user_id: userId })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export interface CookEventWithRecipeTitle extends CookEvent {
  recipeTitle: string;
}

/**
 * For History. Two queries rather than a PostgREST embedded select
 * (`.select('*, recipes(title)')`) — the embedded-select return type only
 * infers correctly when a table's `Relationships` array in
 * types/database.ts describes the foreign key, and every table here
 * deliberately leaves that empty (see CLAUDE.md's Supabase typing gotcha).
 * Two simple queries joined client-side sidesteps that entirely and is
 * plenty for a history list.
 */
export async function fetchCookEvents(): Promise<CookEventWithRecipeTitle[]> {
  const { data: events, error } = await supabase
    .from('cook_events')
    .select('*')
    .order('cooked_at', { ascending: false });
  if (error) throw error;
  if (!events || events.length === 0) return [];

  // Current title wins (recipes can't be renamed today, but that's the
  // honest source); the snapshot covers deleted recipes (recipe_id null).
  const recipeIds = [...new Set(events.flatMap((event) => (event.recipe_id ? [event.recipe_id] : [])))];
  let titleById = new Map<string, string>();
  if (recipeIds.length > 0) {
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id, title')
      .in('id', recipeIds);
    if (recipesError) throw recipesError;
    titleById = new Map((recipes ?? []).map((recipe) => [recipe.id, recipe.title]));
  }

  return events.map((event) => ({
    ...event,
    recipeTitle:
      (event.recipe_id ? titleById.get(event.recipe_id) : undefined) ?? event.recipe_title ?? 'Deleted recipe',
  }));
}

import { supabase } from '../supabase';
import type { RecommendationAction, RecommendationEvent } from '../../types/database';

/**
 * Logs a Home suggestion being shown or tapped — the one Phase 8 signal
 * that can't be derived from any existing table (see
 * db/migrations/0017_recommendation_events.sql). Best-effort: never
 * blocks the screen it's instrumenting.
 */
export async function logRecommendationEvent(
  userId: string,
  recipeTitle: string,
  cuisine: string | null,
  action: RecommendationAction
): Promise<void> {
  const { error } = await supabase.from('recommendation_events').insert({
    user_id: userId,
    recipe_title: recipeTitle,
    cuisine,
    action,
  });
  if (error) throw error;
}

/** For lib/behavioralSignals.ts's "frequently skipped suggestions"
 * derivation. */
export async function fetchRecentRecommendationEvents(sinceDays = 30): Promise<RecommendationEvent[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('recommendation_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

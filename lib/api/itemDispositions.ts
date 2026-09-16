import { supabase } from '../supabase';
import type { ItemDisposition, ItemDispositionValue } from '../../types/database';

/**
 * Logs why an inventory item left the pantry — see
 * db/migrations/0016_item_dispositions.sql for the full reasoning on why
 * this is a separate insert-only log. Best-effort: a logging failure here
 * should never block the actual removal it's describing, so every call
 * site wraps this in its own try/catch rather than letting it fail the
 * user-facing action.
 */
export async function logItemDisposition(
  userId: string,
  item: { canonical_food_id: string | null; display_name: string },
  disposition: ItemDispositionValue,
  source: string
): Promise<void> {
  const { error } = await supabase.from('item_dispositions').insert({
    user_id: userId,
    canonical_food_id: item.canonical_food_id,
    display_name: item.display_name,
    disposition,
    source,
  });
  if (error) throw error;
}

/** For lib/behavioralSignals.ts's "ingredients frequently discarded"
 * derivation. `sinceDays` bounds it to recent behavior — an item
 * discarded once a year ago shouldn't weigh the same as a weekly pattern. */
export async function fetchRecentItemDispositions(sinceDays = 60): Promise<ItemDisposition[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('item_dispositions')
    .select('*')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

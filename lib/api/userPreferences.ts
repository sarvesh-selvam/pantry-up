import { supabase } from '../supabase';
import type { UserPreferences } from '../../types/database';

/** Every user has a row from the signup trigger (see
 * db/migrations/0009_user_preferences.sql) — this should never return
 * null for a real signed-in user, but the screen calling this still
 * handles null defensively rather than assuming. */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateUserPreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

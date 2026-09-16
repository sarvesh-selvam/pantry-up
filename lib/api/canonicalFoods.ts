import { supabase } from '../supabase';
import type { CanonicalFood } from '../../types/database';

export async function fetchCanonicalFoods(): Promise<CanonicalFood[]> {
  const { data, error } = await supabase.from('canonical_foods').select('*');
  if (error) throw error;
  return data ?? [];
}

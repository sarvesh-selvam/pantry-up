import { supabase } from '../supabase';
import type { NutritionData } from '../../types/database';

export async function fetchNutritionData(): Promise<NutritionData[]> {
  const { data, error } = await supabase.from('nutrition_data').select('*');
  if (error) throw error;
  return data ?? [];
}

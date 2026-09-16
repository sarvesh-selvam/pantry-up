import { supabase } from '../supabase';
import type { FoodStorageRule } from '../../types/database';

export async function fetchFoodStorageRules(): Promise<FoodStorageRule[]> {
  const { data, error } = await supabase.from('food_storage_rules').select('*');
  if (error) throw error;
  return data ?? [];
}

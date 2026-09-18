import { supabase } from '../supabase';
import type { ShoppingItem, ShoppingItemInsert, ShoppingItemUpdate } from '../../types/database';

export async function fetchShoppingItems(): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createShoppingItems(
  userId: string,
  items: ShoppingItemInsert[]
): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .insert(items.map((item) => ({ ...item, user_id: userId })))
    .select('*');

  if (error) throw error;
  return data ?? [];
}

export async function updateShoppingItem(
  id: string,
  updates: ShoppingItemUpdate
): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function setShoppingItemsChecked(ids: string[], isChecked: boolean): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('shopping_items').update({ is_checked: isChecked }).in('id', ids);
  if (error) throw error;
}

export async function deleteShoppingItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('shopping_items').delete().in('id', ids);
  if (error) throw error;
}

/** Titles for the "from <recipe>" tag on recipe-sourced items. A second
 * query rather than an embedded select — see fetchCookEvents for why. */
export async function fetchRecipeTitles(recipeIds: string[]): Promise<Map<string, string>> {
  if (recipeIds.length === 0) return new Map();
  const { data, error } = await supabase.from('recipes').select('id, title').in('id', recipeIds);
  if (error) throw error;
  return new Map((data ?? []).map((recipe) => [recipe.id, recipe.title]));
}

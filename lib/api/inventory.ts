import { supabase } from '../supabase';
import type { InventoryItem, InventoryItemInsert, InventoryItemUpdate } from '../../types/database';

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('display_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createInventoryItem(
  userId: string,
  item: InventoryItemInsert
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({ ...item, user_id: userId })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createInventoryItems(
  userId: string,
  items: InventoryItemInsert[]
): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert(items.map((item) => ({ ...item, user_id: userId })))
    .select('*');

  if (error) throw error;
  return data ?? [];
}

export async function updateInventoryItem(
  id: string,
  updates: InventoryItemUpdate
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw error;
}

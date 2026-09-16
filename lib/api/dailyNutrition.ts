import { supabase } from '../supabase';
import type { DailyNutrition } from '../../types/database';

/** "YYYY-MM-DD" in the device's local timezone — daily_nutrition.log_date
 * is a plain date, and a day should mean the user's day, not UTC's. */
export function todayLocalDate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** Shifts a "YYYY-MM-DD" date by `days` (negative for earlier) — for the
 * Macros tab's optional day-back navigation. */
export function shiftLocalDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + days);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function fetchDailyNutrition(userId: string, date: string): Promise<DailyNutrition | null> {
  const { data, error } = await supabase
    .from('daily_nutrition')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Adds a consumption event's nutrition to a day's running total — never
 * replaces it, since a day can have several meals logged. Goes through the
 * increment_daily_nutrition Postgres function (see
 * db/migrations/0014_daily_nutrition.sql) rather than a plain upsert,
 * because "add to what's there" isn't expressible as a PostgREST upsert.
 */
export async function logDailyNutrition(
  userId: string,
  date: string,
  delta: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
): Promise<DailyNutrition> {
  const { data, error } = await supabase.rpc('increment_daily_nutrition', {
    p_user_id: userId,
    p_log_date: date,
    p_calories: delta.calories,
    p_protein_g: delta.protein_g,
    p_carbs_g: delta.carbs_g,
    p_fat_g: delta.fat_g,
  });
  if (error) throw error;
  return data;
}

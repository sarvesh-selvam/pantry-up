// Curated option lists for the Settings screen's cuisine/dietary/equipment
// pickers. Small, fixed vocabularies (not derived from any table) so the
// UI can offer a real picker instead of free text, and so equipment tags
// generated server-side (recipeGeneration.ts) match what a user can
// actually select here. DIETARY_RESTRICTION_OPTIONS mirrors the keys
// structurally enforced by supabase/functions/_shared/dietaryRestrictions.ts
// (kept in sync manually — same reasoning as every other client/Deno split
// in this app); EQUIPMENT_OPTIONS mirrors
// supabase/functions/_shared/equipmentOptions.ts exactly.

export const CUISINE_OPTIONS = [
  'Italian',
  'Mexican',
  'Indian',
  'Chinese',
  'Japanese',
  'Thai',
  'Mediterranean',
  'American',
  'French',
  'Korean',
] as const;

export const DIETARY_RESTRICTION_OPTIONS = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'pescatarian', label: 'Pescatarian' },
  { key: 'gluten-free', label: 'Gluten-free' },
  { key: 'dairy-free', label: 'Dairy-free' },
  { key: 'nut-free', label: 'Nut-free' },
  { key: 'shellfish-free', label: 'Shellfish-free' },
  { key: 'egg-free', label: 'Egg-free' },
] as const;

export const EQUIPMENT_OPTIONS = [
  { key: 'oven', label: 'Oven' },
  { key: 'stovetop', label: 'Stovetop' },
  { key: 'microwave', label: 'Microwave' },
  { key: 'air_fryer', label: 'Air fryer' },
  { key: 'slow_cooker', label: 'Slow cooker' },
  { key: 'grill', label: 'Grill' },
  { key: 'blender', label: 'Blender' },
  { key: 'instant_pot', label: 'Instant Pot' },
] as const;

export type CuisineWeightTier = 'avoid' | 'neutral' | 'favorite';

/** Cuisine preferences are a soft signal, not a filter — three tiers is
 * plenty of resolution for "nudge ranking," and is far more usable on a
 * phone than a raw 0-1 slider per cuisine. */
export const CUISINE_TIER_VALUES: Record<CuisineWeightTier, number> = {
  avoid: 0,
  neutral: 0.5,
  favorite: 1,
};

export function weightToTier(weight: number | undefined): CuisineWeightTier {
  if (weight == null) return 'neutral';
  if (weight <= 0.25) return 'avoid';
  if (weight >= 0.75) return 'favorite';
  return 'neutral';
}

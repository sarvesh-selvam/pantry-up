// Deno mirror of lib/preferenceOptions.ts's EQUIPMENT_OPTIONS keys — kept
// in sync manually, same reasoning as every other client/Deno split in
// this app. The generation prompt asks the model to pick zero or more of
// these; parseGeneratedRecipes drops anything not in this set rather than
// trusting free text, so equipment_needed always matches what a user can
// actually select on the Settings screen.

export const EQUIPMENT_KEYS = [
  'oven',
  'stovetop',
  'microwave',
  'air_fryer',
  'slow_cooker',
  'grill',
  'blender',
  'instant_pot',
] as const;

export const VALID_EQUIPMENT_KEYS = new Set<string>(EQUIPMENT_KEYS);

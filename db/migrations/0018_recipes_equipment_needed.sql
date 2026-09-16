-- Phase 8: a lightweight, controlled-vocabulary tag of what equipment a
-- recipe needs (oven, stovetop, microwave, air_fryer, slow_cooker, grill,
-- blender, instant_pot — see lib/preferenceOptions.ts and
-- supabase/functions/_shared/equipmentOptions.ts, kept in sync manually).
-- Inferred heuristically by the LLM at generation time (recipeGeneration.ts
-- validates the response against the same controlled list, dropping
-- anything unrecognized rather than trusting free text) — never set for
-- manual/scanned recipes, which default to "no requirement known" (an
-- empty array), scored as a neutral match rather than a penalty.

alter table public.recipes
  add column if not exists equipment_needed text[] not null default '{}';

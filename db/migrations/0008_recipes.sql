-- Phase 3: recipe storage. Only source_type = 'ai_generated' is produced
-- this phase (Sous Chef + Home's "What should I cook?"); the other values
-- exist so later phases (manual entry, cookbook photo scan, recipe import)
-- don't need a schema migration to slot in.

create type public.recipe_source_type as enum (
  'ai_generated',
  'manual',
  'cookbook_scan',
  'imported'
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source_type public.recipe_source_type not null default 'ai_generated',
  title text not null,
  description text,
  cuisine text,
  servings integer,
  prep_time integer, -- minutes
  cook_time integer, -- minutes
  -- Array of { canonical_food_id, display_name, quantity_value,
  -- quantity_unit, inventory_match, verification_status }. inventory_match
  -- is a snapshot from the recipe-to-inventory matching engine at
  -- generation/save time, kept for explainability/history — screens that
  -- display a recipe re-run the matching engine live (lib/recipeMatching.ts)
  -- against current inventory rather than trusting this snapshot, since
  -- inventory changes after a recipe is saved.
  ingredients jsonb not null default '[]',
  -- Array of step strings, in order.
  instructions jsonb not null default '[]',
  nutrition jsonb, -- null this phase, filled in Phase 6
  youtube_metadata jsonb, -- null this phase, filled in Phase 7
  tags text[] not null default '{}',
  -- The pantry/rescue/preference context + generation constraints used to
  -- produce this recipe, plus its "why this works" explanation — Sous
  -- Chef's explainability principle: never just "Recommended by AI."
  generated_context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_user_id_idx on public.recipes (user_id);

alter table public.recipes enable row level security;

create policy "Users can view their own recipes"
  on public.recipes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recipes"
  on public.recipes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own recipes"
  on public.recipes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own recipes"
  on public.recipes for delete
  using (auth.uid() = user_id);

drop trigger if exists set_recipes_updated_at on public.recipes;

create trigger set_recipes_updated_at
  before update on public.recipes
  for each row execute procedure public.set_updated_at();

-- Phase 4: a record of every completed cook. This is what makes the core
-- loop (Capture -> Understand -> Rescue -> Decide -> Cook -> Reconcile)
-- close for the first time — inventory_mutations/leftovers_created are the
-- "Reconcile" step's audit trail, and this table is the data source for
-- History now and Global Search (Phase 5) later.

create table if not exists public.cook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cooked_at timestamptz not null default now(),
  servings_prepared integer,
  -- Nullable: real per-meal consumption tracking arrives with macro
  -- logging in Phase 6. This phase captures it opportunistically (asked
  -- alongside servings_prepared, to compute leftovers) but it's not a hard
  -- requirement of the flow.
  servings_consumed integer,
  -- What was actually applied to inventory_items on confirmation — an
  -- audit trail, not a live reference (the referenced items may since have
  -- changed further). See lib/cookingMutations.ts for the shape.
  inventory_mutations jsonb not null default '[]',
  nutrition_consumed jsonb, -- null this phase, filled in Phase 6
  leftovers_created jsonb, -- null if no leftovers were saved
  user_feedback text,
  created_at timestamptz not null default now()
);

create index if not exists cook_events_user_id_idx on public.cook_events (user_id);
create index if not exists cook_events_recipe_id_idx on public.cook_events (recipe_id);
create index if not exists cook_events_cooked_at_idx on public.cook_events (cooked_at desc);

alter table public.cook_events enable row level security;

create policy "Users can view their own cook events"
  on public.cook_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cook events"
  on public.cook_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cook events"
  on public.cook_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own cook events"
  on public.cook_events for delete
  using (auth.uid() = user_id);

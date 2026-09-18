-- Shopping list: a single flat "Need to Buy" list per user, shown on the
-- Pantry tab. Deliberately minimal — one list (no named/per-store lists),
-- no price/cost fields (this app never tracks spending).
--
-- Checking an item off (is_checked) is only a "got it" marker while
-- shopping — it never touches inventory_items. Items only become real
-- inventory through the batch review screen
-- (app/(tabs)/pantry/shopping-review.tsx), after which they're deleted
-- from this table rather than left around as stale checked rows.

create type public.shopping_item_source as enum ('manual', 'recipe');

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  canonical_food_id uuid references public.canonical_foods (id) on delete set null,
  display_name text not null,
  category public.food_category,
  quantity_value numeric,
  quantity_unit text,
  is_checked boolean not null default false,
  source public.shopping_item_source not null default 'manual',
  source_recipe_id uuid references public.recipes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_items_user_id_idx on public.shopping_items (user_id);
create index if not exists shopping_items_canonical_food_id_idx on public.shopping_items (canonical_food_id);

alter table public.shopping_items enable row level security;

create policy "Users can view their own shopping items"
  on public.shopping_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own shopping items"
  on public.shopping_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own shopping items"
  on public.shopping_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own shopping items"
  on public.shopping_items for delete
  using (auth.uid() = user_id);

drop trigger if exists set_shopping_items_updated_at on public.shopping_items;

create trigger set_shopping_items_updated_at
  before update on public.shopping_items
  for each row execute procedure public.set_updated_at();

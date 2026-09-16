create type public.quantity_confidence as enum ('confirmed', 'estimated');

create type public.quantity_state as enum (
  'full',
  'mostly_full',
  'half',
  'low',
  'almost_empty'
);

create type public.preparation_state as enum ('raw', 'prepared', 'leftover');

create type public.storage_location as enum ('fridge', 'freezer', 'pantry', 'counter');

create type public.inventory_source as enum (
  'manual',
  'quick_add',
  'receipt_scan',
  'pantry_snapshot'
);

create type public.verification_status as enum (
  'confirmed',
  'ai_estimated',
  'needs_verification'
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  canonical_food_id uuid references public.canonical_foods (id) on delete set null,
  display_name text not null,
  category public.food_category,
  quantity_value numeric,
  quantity_unit text,
  quantity_confidence public.quantity_confidence not null default 'estimated',
  quantity_state public.quantity_state,
  preparation_state public.preparation_state not null default 'raw',
  storage_location public.storage_location not null default 'fridge',
  source public.inventory_source not null default 'manual',
  purchased_at timestamptz,
  opened_at timestamptz,
  expiry_user_provided date,
  expiry_estimated date,
  verification_status public.verification_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz
);

create index if not exists inventory_items_user_id_idx on public.inventory_items (user_id);
create index if not exists inventory_items_storage_location_idx on public.inventory_items (storage_location);
create index if not exists inventory_items_canonical_food_id_idx on public.inventory_items (canonical_food_id);

alter table public.inventory_items enable row level security;

create policy "Users can view their own inventory items"
  on public.inventory_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own inventory items"
  on public.inventory_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own inventory items"
  on public.inventory_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own inventory items"
  on public.inventory_items for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;

create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute procedure public.set_updated_at();

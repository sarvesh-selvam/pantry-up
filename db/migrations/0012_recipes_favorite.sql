-- Phase 6: favoriting, for Cookbook's "Favorites" filter.
alter table public.recipes
  add column if not exists is_favorite boolean not null default false;

create index if not exists recipes_user_favorite_idx
  on public.recipes (user_id, is_favorite);

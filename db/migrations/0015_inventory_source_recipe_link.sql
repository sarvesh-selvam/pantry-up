-- Phase 6: lets a leftover inventory_item point back at the recipe it came
-- from, so eating it later can compute real per-serving nutrition instead
-- of guessing. Nullable and backfilled as null for existing rows — a
-- leftover with no link just can't have its consumption's nutrition logged
-- (see lib/nutritionLogging.ts), which is the honest outcome, not an error.

alter table public.inventory_items
  add column if not exists source_recipe_id uuid references public.recipes (id) on delete set null;

create index if not exists inventory_items_source_recipe_id_idx
  on public.inventory_items (source_recipe_id);

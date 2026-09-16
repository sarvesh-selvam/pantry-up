-- Phase 2: preserve exactly what the user typed / what was extracted from a
-- receipt, alongside the normalized fields. Never discard original input,
-- even after Quick Add / receipt scan normalization resolves a canonical
-- match and overwrites display_name/category/etc.
alter table public.inventory_items
  add column if not exists raw_input_text text;

-- Inventory items added from the shopping list's "Review & Add to Pantry"
-- flow get their own source value, so they stay traceable back to the
-- shopping list rather than blending into 'manual'.
--
-- In its own migration/transaction on purpose: Postgres doesn't allow a
-- new enum value to be used in the same transaction that adds it (same
-- reason as 0011_inventory_source_cooking.sql).

alter type public.inventory_source add value if not exists 'shopping_list';

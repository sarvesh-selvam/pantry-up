-- Phase 4: leftovers created from Cooking Mode get their own source value
-- rather than being shoehorned into 'manual' — makes it possible to tell
-- "the user typed this in" apart from "this came out of a cook_event"
-- later (History, Phase 5 search, analytics).
--
-- In its own migration/transaction on purpose: Postgres doesn't allow a
-- new enum value to be used in the same transaction that adds it.

alter type public.inventory_source add value if not exists 'cooking';

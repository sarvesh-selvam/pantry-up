-- Recipes can now be deleted from the Cookbook. cook_events.recipe_id was
-- `on delete cascade` (0010), which would silently erase cook History and
-- the cook-history ranking signals along with the recipe. Instead: keep
-- the event, null out the link, and snapshot the title so History can
-- still say what was cooked.

alter table public.cook_events
  add column if not exists recipe_title text;

update public.cook_events ce
set recipe_title = r.title
from public.recipes r
where ce.recipe_id = r.id
  and ce.recipe_title is null;

alter table public.cook_events
  alter column recipe_id drop not null;

alter table public.cook_events
  drop constraint if exists cook_events_recipe_id_fkey;

alter table public.cook_events
  add constraint cook_events_recipe_id_fkey
  foreign key (recipe_id) references public.recipes (id) on delete set null;

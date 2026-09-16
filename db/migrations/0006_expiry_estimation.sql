-- Phase 2: deterministic (non-LLM) expiry estimation.
--
-- Fires whenever a row's food/storage/prep/date fields change and looks up
-- public.food_storage_rules to set expiry_estimated. If no matching rule
-- exists (unresolved canonical_food_id, or a storage/prep combination we
-- have no data for), expiry_estimated is left null rather than guessed —
-- "no data" is always preferred over an invented number. expiry_estimated
-- is computed independently of expiry_user_provided (both are kept up to
-- date; the UI prefers expiry_user_provided when both are present — see
-- lib/formatInventory.ts).

create or replace function public.compute_expiry_estimated()
returns trigger
language plpgsql
as $$
declare
  matched_rule public.food_storage_rules%rowtype;
  is_opened_flag boolean;
  base_date date;
begin
  if new.canonical_food_id is null then
    new.expiry_estimated := null;
    return new;
  end if;

  is_opened_flag := (new.opened_at is not null);

  select * into matched_rule
  from public.food_storage_rules r
  where r.canonical_food_id = new.canonical_food_id
    and r.preparation_state = new.preparation_state
    and r.storage_location = new.storage_location
    and r.is_opened = is_opened_flag
  limit 1;

  -- Fall back to the unopened baseline rule for this food/storage/prep if
  -- there's no opened-specific rule — better than no estimate for items
  -- that have just been marked opened with no dedicated "opened" row.
  if not found and is_opened_flag then
    select * into matched_rule
    from public.food_storage_rules r
    where r.canonical_food_id = new.canonical_food_id
      and r.preparation_state = new.preparation_state
      and r.storage_location = new.storage_location
      and r.is_opened = false
    limit 1;
  end if;

  if not found then
    new.expiry_estimated := null;
    return new;
  end if;

  base_date := coalesce(new.opened_at, new.purchased_at, new.created_at, now())::date;
  new.expiry_estimated := base_date + matched_rule.typical_shelf_life_days;
  return new;
end;
$$;

drop trigger if exists compute_inventory_item_expiry on public.inventory_items;

create trigger compute_inventory_item_expiry
  before insert or update of canonical_food_id, storage_location, preparation_state, purchased_at, opened_at
  on public.inventory_items
  for each row execute procedure public.compute_expiry_estimated();

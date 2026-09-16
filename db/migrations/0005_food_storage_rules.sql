-- Phase 2: structured, deterministic shelf-life reference data. This table
-- is the ONLY source of truth for expiry estimation (see
-- 0006_expiry_estimation.sql) — the LLM used elsewhere in this phase is never
-- allowed to invent a shelf-life number.
--
-- Seed values below are hand-curated approximations of commonly published
-- USDA FoodKeeper guidance, not a verbatim FoodKeeper export. Treat them as
-- a reasonable MVP default — validate against the actual FoodKeeper
-- dataset/API before relying on this for real food-safety decisions.

create table if not exists public.food_storage_rules (
  id uuid primary key default gen_random_uuid(),
  -- Nullable in the schema for future category-wide fallback rules, but
  -- every row seeded below targets a specific canonical food — see
  -- 0006_expiry_estimation.sql for why an unresolved (null) canonical food
  -- gets no expiry estimate rather than a guessed one.
  canonical_food_id uuid references public.canonical_foods (id) on delete cascade,
  category public.food_category not null,
  preparation_state public.preparation_state not null,
  storage_location public.storage_location not null,
  -- Distinguishes "unopened, as purchased" (false) from "opened" (true)
  -- shelf life, where that distinction materially changes it (dairy,
  -- condiments, canned goods). Not meaningful for everything (raw produce,
  -- raw meat) — left false there.
  is_opened boolean not null default false,
  typical_shelf_life_days integer not null check (typical_shelf_life_days > 0),
  is_safety_critical boolean not null default false,
  source_note text not null default 'USDA FoodKeeper (approximate)',
  created_at timestamptz not null default now(),
  unique (canonical_food_id, preparation_state, storage_location, is_opened)
);

alter table public.food_storage_rules enable row level security;

create policy "Authenticated users can read food storage rules"
  on public.food_storage_rules for select
  using (auth.role() = 'authenticated');

create index if not exists food_storage_rules_canonical_food_id_idx
  on public.food_storage_rules (canonical_food_id);

with rules (canonical_name, storage_location, preparation_state, is_opened, typical_shelf_life_days, is_safety_critical, source_note) as (
  values
    -- produce
    ('onion', 'pantry', 'raw', false, 30, false, 'USDA FoodKeeper (approximate)'),
    ('garlic', 'pantry', 'raw', false, 90, false, 'USDA FoodKeeper (approximate)'),
    ('tomato', 'counter', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('potato', 'pantry', 'raw', false, 30, false, 'USDA FoodKeeper (approximate)'),
    ('carrot', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('celery', 'fridge', 'raw', false, 14, false, 'USDA FoodKeeper (approximate)'),
    ('bell pepper', 'fridge', 'raw', false, 10, false, 'USDA FoodKeeper (approximate)'),
    ('cilantro', 'fridge', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('parsley', 'fridge', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('lettuce', 'fridge', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('spinach', 'fridge', 'raw', false, 5, false, 'USDA FoodKeeper (approximate)'),
    ('broccoli', 'fridge', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('lemon', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('lemon', 'counter', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('lime', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('lime', 'counter', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('avocado', 'counter', 'raw', false, 5, false, 'USDA FoodKeeper (approximate)'),
    ('avocado', 'fridge', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('banana', 'counter', 'raw', false, 5, false, 'USDA FoodKeeper (approximate)'),
    ('apple', 'fridge', 'raw', false, 30, false, 'USDA FoodKeeper (approximate)'),
    ('apple', 'counter', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('ginger', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('mushroom', 'fridge', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('cucumber', 'fridge', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),

    -- dairy
    ('milk', 'fridge', 'raw', false, 7, true, 'USDA FoodKeeper (approximate)'),
    ('butter', 'fridge', 'raw', false, 90, false, 'USDA FoodKeeper (approximate)'),
    ('butter', 'freezer', 'raw', false, 180, false, 'USDA FoodKeeper (approximate)'),
    ('eggs', 'fridge', 'raw', false, 28, true, 'USDA FoodKeeper (approximate)'),
    ('cheddar cheese', 'fridge', 'raw', false, 180, false, 'USDA FoodKeeper (approximate)'),
    ('cheddar cheese', 'fridge', 'raw', true, 21, false, 'USDA FoodKeeper (approximate)'),
    ('mozzarella cheese', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('mozzarella cheese', 'fridge', 'raw', true, 7, false, 'USDA FoodKeeper (approximate)'),
    ('parmesan cheese', 'fridge', 'raw', false, 180, false, 'USDA FoodKeeper (approximate)'),
    ('parmesan cheese', 'fridge', 'raw', true, 30, false, 'USDA FoodKeeper (approximate)'),
    ('yogurt', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('yogurt', 'fridge', 'raw', true, 7, false, 'USDA FoodKeeper (approximate)'),
    ('sour cream', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('sour cream', 'fridge', 'raw', true, 14, false, 'USDA FoodKeeper (approximate)'),
    ('cream cheese', 'fridge', 'raw', false, 30, false, 'USDA FoodKeeper (approximate)'),
    ('cream cheese', 'fridge', 'raw', true, 10, false, 'USDA FoodKeeper (approximate)'),
    ('heavy cream', 'fridge', 'raw', false, 30, false, 'USDA FoodKeeper (approximate)'),
    ('heavy cream', 'fridge', 'raw', true, 10, false, 'USDA FoodKeeper (approximate)'),

    -- meat / protein (raw storage + cooked leftovers)
    ('chicken breast', 'fridge', 'raw', false, 2, true, 'USDA FoodKeeper (approximate)'),
    ('chicken breast', 'freezer', 'raw', false, 270, true, 'USDA FoodKeeper (approximate)'),
    ('chicken breast', 'fridge', 'leftover', false, 4, true, 'USDA FoodKeeper (approximate)'),
    ('chicken thigh', 'fridge', 'raw', false, 2, true, 'USDA FoodKeeper (approximate)'),
    ('chicken thigh', 'freezer', 'raw', false, 270, true, 'USDA FoodKeeper (approximate)'),
    ('chicken thigh', 'fridge', 'leftover', false, 4, true, 'USDA FoodKeeper (approximate)'),
    ('ground beef', 'fridge', 'raw', false, 2, true, 'USDA FoodKeeper (approximate)'),
    ('ground beef', 'freezer', 'raw', false, 120, true, 'USDA FoodKeeper (approximate)'),
    ('ground beef', 'fridge', 'leftover', false, 4, true, 'USDA FoodKeeper (approximate)'),
    ('bacon', 'fridge', 'raw', false, 14, true, 'USDA FoodKeeper (approximate)'),
    ('bacon', 'freezer', 'raw', false, 30, true, 'USDA FoodKeeper (approximate)'),
    ('salmon', 'fridge', 'raw', false, 2, true, 'USDA FoodKeeper (approximate)'),
    ('salmon', 'freezer', 'raw', false, 90, true, 'USDA FoodKeeper (approximate)'),
    ('salmon', 'fridge', 'leftover', false, 3, true, 'USDA FoodKeeper (approximate)'),
    ('shrimp', 'fridge', 'raw', false, 2, true, 'USDA FoodKeeper (approximate)'),
    ('shrimp', 'freezer', 'raw', false, 180, true, 'USDA FoodKeeper (approximate)'),
    ('shrimp', 'fridge', 'leftover', false, 3, true, 'USDA FoodKeeper (approximate)'),
    ('pork chop', 'fridge', 'raw', false, 3, true, 'USDA FoodKeeper (approximate)'),
    ('pork chop', 'freezer', 'raw', false, 120, true, 'USDA FoodKeeper (approximate)'),
    ('pork chop', 'fridge', 'leftover', false, 4, true, 'USDA FoodKeeper (approximate)'),
    ('tofu', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('tofu', 'fridge', 'raw', true, 5, false, 'USDA FoodKeeper (approximate)'),
    ('turkey', 'fridge', 'raw', false, 2, true, 'USDA FoodKeeper (approximate)'),
    ('turkey', 'freezer', 'raw', false, 120, true, 'USDA FoodKeeper (approximate)'),
    ('turkey', 'fridge', 'leftover', false, 4, true, 'USDA FoodKeeper (approximate)'),
    ('sausage', 'fridge', 'raw', false, 2, true, 'USDA FoodKeeper (approximate)'),
    ('sausage', 'freezer', 'raw', false, 60, true, 'USDA FoodKeeper (approximate)'),

    -- grains / pasta / bread
    ('rice', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('rice', 'fridge', 'leftover', false, 5, true, 'USDA FoodKeeper (approximate) — Bacillus cereus risk in cooked rice'),
    ('pasta', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('pasta', 'fridge', 'leftover', false, 5, false, 'USDA FoodKeeper (approximate)'),
    ('bread', 'pantry', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('bread', 'freezer', 'raw', false, 90, false, 'USDA FoodKeeper (approximate)'),
    ('tortilla', 'pantry', 'raw', false, 7, false, 'USDA FoodKeeper (approximate)'),
    ('tortilla', 'fridge', 'raw', false, 21, false, 'USDA FoodKeeper (approximate)'),
    ('tortilla', 'freezer', 'raw', false, 60, false, 'USDA FoodKeeper (approximate)'),
    ('oats', 'pantry', 'raw', false, 365, false, 'USDA FoodKeeper (approximate)'),
    ('flour', 'pantry', 'raw', false, 240, false, 'USDA FoodKeeper (approximate)'),
    ('quinoa', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('cereal', 'pantry', 'raw', false, 240, false, 'USDA FoodKeeper (approximate)'),
    ('cereal', 'pantry', 'raw', true, 90, false, 'USDA FoodKeeper (approximate)'),

    -- canned goods
    ('canned tomatoes', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('canned tomatoes', 'fridge', 'raw', true, 5, false, 'USDA FoodKeeper (approximate)'),
    ('canned beans', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('canned beans', 'fridge', 'raw', true, 4, false, 'USDA FoodKeeper (approximate)'),
    ('canned corn', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('canned corn', 'fridge', 'raw', true, 5, false, 'USDA FoodKeeper (approximate)'),
    ('chicken broth', 'pantry', 'raw', false, 365, false, 'USDA FoodKeeper (approximate)'),
    ('chicken broth', 'fridge', 'raw', true, 4, true, 'USDA FoodKeeper (approximate)'),
    ('vegetable broth', 'pantry', 'raw', false, 365, false, 'USDA FoodKeeper (approximate)'),
    ('vegetable broth', 'fridge', 'raw', true, 4, true, 'USDA FoodKeeper (approximate)'),
    ('tuna', 'pantry', 'raw', false, 1095, false, 'USDA FoodKeeper (approximate)'),
    ('tuna', 'fridge', 'raw', true, 3, true, 'USDA FoodKeeper (approximate)'),
    ('coconut milk', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('coconut milk', 'fridge', 'raw', true, 5, false, 'USDA FoodKeeper (approximate)'),

    -- condiments / pantry staples
    ('olive oil', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('olive oil', 'pantry', 'raw', true, 365, false, 'USDA FoodKeeper (approximate)'),
    ('vegetable oil', 'pantry', 'raw', false, 730, false, 'USDA FoodKeeper (approximate)'),
    ('vegetable oil', 'pantry', 'raw', true, 365, false, 'USDA FoodKeeper (approximate)'),
    ('soy sauce', 'pantry', 'raw', false, 1095, false, 'USDA FoodKeeper (approximate)'),
    ('soy sauce', 'pantry', 'raw', true, 365, false, 'USDA FoodKeeper (approximate)'),
    ('ketchup', 'pantry', 'raw', false, 365, false, 'USDA FoodKeeper (approximate)'),
    ('ketchup', 'fridge', 'raw', true, 180, false, 'USDA FoodKeeper (approximate)'),
    ('mustard', 'pantry', 'raw', false, 365, false, 'USDA FoodKeeper (approximate)'),
    ('mustard', 'fridge', 'raw', true, 365, false, 'USDA FoodKeeper (approximate)'),
    ('mayonnaise', 'pantry', 'raw', false, 90, true, 'USDA FoodKeeper (approximate)'),
    ('mayonnaise', 'fridge', 'raw', true, 60, true, 'USDA FoodKeeper (approximate)'),
    ('salsa', 'pantry', 'raw', false, 365, false, 'USDA FoodKeeper (approximate)'),
    ('salsa', 'fridge', 'raw', true, 14, true, 'USDA FoodKeeper (approximate)'),
    ('hot sauce', 'pantry', 'raw', false, 1095, false, 'USDA FoodKeeper (approximate)'),
    ('hot sauce', 'pantry', 'raw', true, 730, false, 'USDA FoodKeeper (approximate)'),
    ('salt', 'pantry', 'raw', false, 3650, false, 'USDA FoodKeeper (approximate) — indefinite, long default used'),
    ('black pepper', 'pantry', 'raw', false, 1460, false, 'USDA FoodKeeper (approximate)'),
    ('sugar', 'pantry', 'raw', false, 3650, false, 'USDA FoodKeeper (approximate) — indefinite, long default used'),
    ('honey', 'pantry', 'raw', false, 3650, false, 'USDA FoodKeeper (approximate) — does not spoil, long default used'),
    ('peanut butter', 'pantry', 'raw', false, 270, false, 'USDA FoodKeeper (approximate)'),
    ('peanut butter', 'pantry', 'raw', true, 90, false, 'USDA FoodKeeper (approximate)'),
    ('garlic powder', 'pantry', 'raw', false, 1095, false, 'USDA FoodKeeper (approximate)'),
    ('cumin', 'pantry', 'raw', false, 1095, false, 'USDA FoodKeeper (approximate)'),
    ('cinnamon', 'pantry', 'raw', false, 1095, false, 'USDA FoodKeeper (approximate)'),
    ('vanilla extract', 'pantry', 'raw', false, 3650, false, 'USDA FoodKeeper (approximate) — alcohol-preserved, long default used')
)
insert into public.food_storage_rules
  (canonical_food_id, category, preparation_state, storage_location, is_opened, typical_shelf_life_days, is_safety_critical, source_note)
select
  cf.id,
  cf.category,
  r.preparation_state::public.preparation_state,
  r.storage_location::public.storage_location,
  r.is_opened,
  r.typical_shelf_life_days,
  r.is_safety_critical,
  r.source_note
from rules r
join public.canonical_foods cf on cf.canonical_name = r.canonical_name
on conflict (canonical_food_id, preparation_state, storage_location, is_opened) do nothing;

-- Phase 6: per-100g reference nutrition for every canonical food. This
-- table is the ONLY source of truth nutrition calculation reads from (see
-- lib/nutritionCalculation.ts / supabase/functions/_shared/nutritionCalculation.ts)
-- — the LLM is never allowed to invent a calorie/macro number.
--
-- Seed values below are hand-curated approximations of commonly published
-- USDA FoodData Central figures (raw/as-purchased basis, not cooked —
-- cooking-state-adjusted nutrition is out of scope for this phase), not a
-- verbatim database export. Treat as a reasonable MVP default — validate
-- against the actual FoodData Central dataset/API before relying on this
-- for real dietary decisions. Same caveat pattern as
-- 0005_food_storage_rules.sql's shelf-life data.

create table if not exists public.nutrition_data (
  id uuid primary key default gen_random_uuid(),
  canonical_food_id uuid not null unique references public.canonical_foods (id) on delete cascade,
  calories_per_100g numeric not null check (calories_per_100g >= 0),
  protein_g_per_100g numeric not null check (protein_g_per_100g >= 0),
  carbs_g_per_100g numeric not null check (carbs_g_per_100g >= 0),
  fat_g_per_100g numeric not null check (fat_g_per_100g >= 0),
  source_note text not null default 'USDA FoodData Central (approximate)',
  created_at timestamptz not null default now()
);

alter table public.nutrition_data enable row level security;

create policy "Authenticated users can read nutrition data"
  on public.nutrition_data for select
  using (auth.role() = 'authenticated');

with data (canonical_name, calories, protein, carbs, fat) as (
  values
    -- produce (per 100g, raw)
    ('onion', 40, 1.1, 9.3, 0.1),
    ('garlic', 149, 6.4, 33.1, 0.5),
    ('tomato', 18, 0.9, 3.9, 0.2),
    ('potato', 77, 2.0, 17.5, 0.1),
    ('carrot', 41, 0.9, 9.6, 0.2),
    ('celery', 16, 0.7, 3.0, 0.2),
    ('bell pepper', 31, 1.0, 6.0, 0.3),
    ('cilantro', 23, 2.1, 3.7, 0.5),
    ('parsley', 36, 3.0, 6.3, 0.8),
    ('lettuce', 15, 1.4, 2.9, 0.2),
    ('spinach', 23, 2.9, 3.6, 0.4),
    ('broccoli', 34, 2.8, 7.0, 0.4),
    ('lemon', 29, 1.1, 9.3, 0.3),
    ('lime', 30, 0.7, 10.5, 0.2),
    ('avocado', 160, 2.0, 8.5, 14.7),
    ('banana', 89, 1.1, 22.8, 0.3),
    ('apple', 52, 0.3, 13.8, 0.2),
    ('ginger', 80, 1.8, 17.8, 0.8),
    ('mushroom', 22, 3.1, 3.3, 0.3),
    ('cucumber', 15, 0.7, 3.6, 0.1),

    -- dairy (per 100g)
    ('milk', 61, 3.2, 4.8, 3.3),
    ('butter', 717, 0.9, 0.1, 81.1),
    ('eggs', 155, 13.0, 1.1, 11.0),
    ('cheddar cheese', 403, 25.0, 1.3, 33.0),
    ('mozzarella cheese', 280, 28.0, 3.1, 17.0),
    ('parmesan cheese', 431, 38.0, 4.1, 29.0),
    ('yogurt', 61, 3.5, 4.7, 3.3),
    ('sour cream', 198, 2.4, 4.6, 19.4),
    ('cream cheese', 342, 6.0, 4.1, 34.0),
    ('heavy cream', 340, 2.1, 2.8, 36.1),

    -- meat / protein (per 100g, raw)
    ('chicken breast', 165, 31.0, 0.0, 3.6),
    ('chicken thigh', 209, 26.0, 0.0, 10.9),
    ('ground beef', 254, 17.0, 0.0, 20.0),
    ('bacon', 541, 37.0, 1.4, 42.0),
    ('salmon', 208, 20.4, 0.0, 13.4),
    ('shrimp', 99, 24.0, 0.2, 0.3),
    ('pork chop', 231, 25.0, 0.0, 14.0),
    ('tofu', 76, 8.1, 1.9, 4.8),
    ('turkey', 143, 18.0, 0.0, 8.0),
    ('sausage', 301, 12.0, 2.0, 27.0),

    -- grains / pasta / bread (per 100g, dry unless noted)
    ('rice', 365, 7.1, 80.0, 0.7),
    ('pasta', 371, 13.0, 75.0, 1.5),
    ('bread', 265, 9.0, 49.0, 3.2),
    ('tortilla', 218, 6.0, 36.0, 5.4),
    ('oats', 389, 16.9, 66.3, 6.9),
    ('flour', 364, 10.0, 76.0, 1.0),
    ('quinoa', 368, 14.1, 64.2, 6.1),
    ('cereal', 379, 7.0, 84.0, 1.5),

    -- canned goods (per 100g)
    ('canned tomatoes', 18, 0.9, 4.2, 0.1),
    ('canned beans', 127, 8.7, 22.8, 0.5),
    ('canned corn', 76, 2.7, 17.1, 1.0),
    ('chicken broth', 4, 0.6, 0.3, 0.1),
    ('vegetable broth', 3, 0.2, 0.5, 0.1),
    ('tuna', 116, 26.0, 0.0, 0.8),
    ('coconut milk', 230, 2.3, 5.5, 24.0),

    -- condiments / pantry staples (per 100g)
    ('olive oil', 884, 0.0, 0.0, 100.0),
    ('vegetable oil', 884, 0.0, 0.0, 100.0),
    ('soy sauce', 53, 8.1, 4.9, 0.1),
    ('ketchup', 101, 1.2, 25.8, 0.2),
    ('mustard', 66, 4.4, 5.8, 3.3),
    ('mayonnaise', 680, 1.0, 0.6, 75.0),
    ('salsa', 36, 1.6, 7.5, 0.4),
    ('hot sauce', 12, 0.5, 2.1, 0.4),
    ('salt', 0, 0.0, 0.0, 0.0),
    ('black pepper', 251, 10.4, 64.0, 3.3),
    ('sugar', 387, 0.0, 100.0, 0.0),
    ('honey', 304, 0.3, 82.4, 0.0),
    ('peanut butter', 588, 25.0, 20.0, 50.0),
    ('garlic powder', 331, 16.6, 72.7, 0.7),
    ('cumin', 375, 17.8, 44.2, 22.3),
    ('cinnamon', 247, 4.0, 80.6, 1.2),
    ('vanilla extract', 288, 0.1, 12.7, 0.1)
)
insert into public.nutrition_data (canonical_food_id, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g)
select cf.id, d.calories, d.protein, d.carbs, d.fat
from data d
join public.canonical_foods cf on cf.canonical_name = d.canonical_name
on conflict (canonical_food_id) do nothing;

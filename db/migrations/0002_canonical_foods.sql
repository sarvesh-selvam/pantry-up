create type public.food_category as enum (
  'produce',
  'dairy',
  'meat',
  'grains',
  'canned_goods',
  'condiments',
  'pantry_staple',
  'prepared',
  'other'
);

create table if not exists public.canonical_foods (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  category public.food_category not null,
  default_unit text,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Readable by any authenticated user (it's shared reference data, not
-- per-user data), writable only via migrations/admin.
alter table public.canonical_foods enable row level security;

create policy "Authenticated users can read canonical foods"
  on public.canonical_foods for select
  using (auth.role() = 'authenticated');

create index if not exists canonical_foods_aliases_gin_idx
  on public.canonical_foods using gin (aliases);

insert into public.canonical_foods (canonical_name, category, default_unit, aliases) values
  -- produce
  ('onion', 'produce', 'count', array['onions', 'yellow onion', 'white onion']),
  ('garlic', 'produce', 'clove', array['garlic clove', 'garlic cloves']),
  ('tomato', 'produce', 'count', array['tomatoes', 'roma tomato']),
  ('potato', 'produce', 'count', array['potatoes', 'russet potato']),
  ('carrot', 'produce', 'count', array['carrots', 'baby carrots']),
  ('celery', 'produce', 'stalk', array['celery stalk', 'celery stalks']),
  ('bell pepper', 'produce', 'count', array['bell peppers', 'green pepper', 'red pepper']),
  ('cilantro', 'produce', 'bunch', array['coriander', 'fresh cilantro']),
  ('parsley', 'produce', 'bunch', array['fresh parsley']),
  ('lettuce', 'produce', 'head', array['romaine', 'romaine lettuce']),
  ('spinach', 'produce', 'oz', array['baby spinach']),
  ('broccoli', 'produce', 'head', array['broccoli florets']),
  ('lemon', 'produce', 'count', array['lemons']),
  ('lime', 'produce', 'count', array['limes']),
  ('avocado', 'produce', 'count', array['avocados']),
  ('banana', 'produce', 'count', array['bananas']),
  ('apple', 'produce', 'count', array['apples']),
  ('ginger', 'produce', 'oz', array['fresh ginger', 'ginger root']),
  ('mushroom', 'produce', 'oz', array['mushrooms', 'button mushrooms']),
  ('cucumber', 'produce', 'count', array['cucumbers']),

  -- dairy
  ('milk', 'dairy', 'gallon', array['whole milk', '2% milk', 'skim milk']),
  ('butter', 'dairy', 'stick', array['unsalted butter', 'salted butter']),
  ('eggs', 'dairy', 'dozen', array['egg', 'large eggs']),
  ('cheddar cheese', 'dairy', 'oz', array['cheddar', 'shredded cheddar']),
  ('mozzarella cheese', 'dairy', 'oz', array['mozzarella', 'shredded mozzarella']),
  ('parmesan cheese', 'dairy', 'oz', array['parmesan', 'grated parmesan']),
  ('yogurt', 'dairy', 'container', array['greek yogurt', 'plain yogurt']),
  ('sour cream', 'dairy', 'container', array[]::text[]),
  ('cream cheese', 'dairy', 'oz', array[]::text[]),
  ('heavy cream', 'dairy', 'cup', array['heavy whipping cream']),

  -- meat / protein
  ('chicken breast', 'meat', 'lb', array['chicken breasts', 'boneless chicken', 'boneless chicken breast', 'chix breast']),
  ('chicken thigh', 'meat', 'lb', array['chicken thighs', 'boneless chicken thigh']),
  ('ground beef', 'meat', 'lb', array['hamburger meat', 'ground chuck']),
  ('bacon', 'meat', 'lb', array['bacon strips']),
  ('salmon', 'meat', 'lb', array['salmon fillet', 'salmon filet']),
  ('shrimp', 'meat', 'lb', array['prawns']),
  ('pork chop', 'meat', 'lb', array['pork chops']),
  ('tofu', 'meat', 'block', array['firm tofu', 'extra firm tofu']),
  ('turkey', 'meat', 'lb', array['ground turkey']),
  ('sausage', 'meat', 'lb', array['italian sausage', 'breakfast sausage']),

  -- grains / pasta
  ('rice', 'grains', 'lb', array['white rice', 'jasmine rice', 'basmati rice']),
  ('pasta', 'grains', 'lb', array['spaghetti', 'penne', 'noodles']),
  ('bread', 'grains', 'loaf', array['sandwich bread', 'white bread', 'whole wheat bread']),
  ('tortilla', 'grains', 'pack', array['tortillas', 'flour tortilla', 'corn tortilla']),
  ('oats', 'grains', 'lb', array['oatmeal', 'rolled oats']),
  ('flour', 'grains', 'lb', array['all purpose flour', 'all-purpose flour']),
  ('quinoa', 'grains', 'lb', array[]::text[]),
  ('cereal', 'grains', 'box', array[]::text[]),

  -- canned goods
  ('canned tomatoes', 'canned_goods', 'can', array['crushed tomatoes', 'diced tomatoes']),
  ('canned beans', 'canned_goods', 'can', array['black beans', 'kidney beans', 'canned black beans']),
  ('canned corn', 'canned_goods', 'can', array['corn']),
  ('chicken broth', 'canned_goods', 'quart', array['chicken stock']),
  ('vegetable broth', 'canned_goods', 'quart', array['vegetable stock']),
  ('tuna', 'canned_goods', 'can', array['canned tuna']),
  ('coconut milk', 'canned_goods', 'can', array['canned coconut milk']),

  -- condiments / pantry staples
  ('olive oil', 'condiments', 'bottle', array['extra virgin olive oil', 'evoo']),
  ('vegetable oil', 'condiments', 'bottle', array['cooking oil', 'canola oil']),
  ('soy sauce', 'condiments', 'bottle', array[]::text[]),
  ('ketchup', 'condiments', 'bottle', array[]::text[]),
  ('mustard', 'condiments', 'bottle', array['dijon mustard', 'yellow mustard']),
  ('mayonnaise', 'condiments', 'jar', array['mayo']),
  ('salsa', 'condiments', 'jar', array[]::text[]),
  ('hot sauce', 'condiments', 'bottle', array[]::text[]),
  ('salt', 'pantry_staple', 'container', array['table salt', 'kosher salt']),
  ('black pepper', 'pantry_staple', 'container', array['pepper', 'ground pepper']),
  ('sugar', 'pantry_staple', 'lb', array['white sugar', 'granulated sugar']),
  ('honey', 'condiments', 'jar', array[]::text[]),
  ('peanut butter', 'condiments', 'jar', array[]::text[]),
  ('garlic powder', 'pantry_staple', 'container', array[]::text[]),
  ('cumin', 'pantry_staple', 'container', array['ground cumin']),
  ('cinnamon', 'pantry_staple', 'container', array['ground cinnamon']),
  ('vanilla extract', 'pantry_staple', 'bottle', array[]::text[])
on conflict (canonical_name) do nothing;

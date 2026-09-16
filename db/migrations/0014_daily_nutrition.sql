-- Phase 6: daily aggregated nutrition, written only by confirmed
-- consumption (Finish Cooking, or eating a leftover) — never by recipe
-- generation/saving. One row per user per day; each consumption event
-- increments it rather than replacing it, since a day can have several
-- meals logged.

create table if not exists public.daily_nutrition (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  log_date date not null,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists daily_nutrition_user_date_idx on public.daily_nutrition (user_id, log_date desc);

alter table public.daily_nutrition enable row level security;

create policy "Users can view their own daily nutrition"
  on public.daily_nutrition for select
  using (auth.uid() = user_id);

-- No direct insert/update policy: writes go through increment_daily_nutrition
-- below, which enforces auth.uid() = p_user_id itself. This is the one place
-- in the schema where a table is write-protected by a function rather than
-- ordinary RLS insert/update policies, specifically because "increment,
-- don't overwrite" isn't expressible as a plain PostgREST upsert.

create or replace function public.increment_daily_nutrition(
  p_user_id uuid,
  p_log_date date,
  p_calories numeric,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric
)
returns public.daily_nutrition
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.daily_nutrition;
begin
  if p_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  insert into public.daily_nutrition (user_id, log_date, calories, protein_g, carbs_g, fat_g)
  values (p_user_id, p_log_date, p_calories, p_protein_g, p_carbs_g, p_fat_g)
  on conflict (user_id, log_date)
  do update set
    calories = public.daily_nutrition.calories + excluded.calories,
    protein_g = public.daily_nutrition.protein_g + excluded.protein_g,
    carbs_g = public.daily_nutrition.carbs_g + excluded.carbs_g,
    fat_g = public.daily_nutrition.fat_g + excluded.fat_g,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant execute on function public.increment_daily_nutrition(uuid, date, numeric, numeric, numeric, numeric) to authenticated;

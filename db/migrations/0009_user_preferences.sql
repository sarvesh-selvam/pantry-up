-- Phase 3: minimal preferences table for Sous Chef's get_user_preferences
-- tool. Phase 1 didn't include one. Rows are auto-created (empty) on
-- signup via the same trigger that creates the users profile row, so
-- get_user_preferences always finds a row rather than needing null-handling
-- everywhere. Full onboarding-driven preferences (richer cuisine/dietary
-- UI) arrive in a later phase — this is placeholder-shaped on purpose.

create table if not exists public.user_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  -- e.g. {"italian": 0.8, "thai": 0.6} — a soft signal, never a hard filter.
  cuisine_weights jsonb not null default '{}',
  -- e.g. ["vegetarian", "gluten-free"] — hard constraints, enforced
  -- structurally in generate_recipe, not just prompted (see
  -- supabase/functions/_shared/dietaryRestrictions.ts).
  dietary_restrictions text[] not null default '{}',
  skill_level text not null default 'intermediate'
    check (skill_level in ('beginner', 'intermediate', 'advanced')),
  equipment text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can view their own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;

create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

-- Extend the Phase 1 signup trigger to also create an empty preferences row.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name'
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

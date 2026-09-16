-- Phase 1: user profile table, kept in sync with auth.users via trigger.
-- A trigger (rather than a client-side insert after signUp) is used because
-- when Supabase email confirmation is enabled, signUp() does not return an
-- authenticated session immediately, so a client-side insert into `users`
-- would fail RLS. The trigger runs with the privileges of auth.users writes
-- and always succeeds.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- Allow the trigger's insert (running as the row owner) as a safety net in
-- case a client-side upsert is ever needed.
create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

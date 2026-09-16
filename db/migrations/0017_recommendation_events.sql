-- Phase 8: a minimal insert-only log of Home's "What should I cook?"
-- suggestions being shown vs. actually saved — the one Phase 8 signal
-- (product spec section 1's "frequently skipped suggestions") that
-- genuinely cannot be derived from any existing table, since suggestions
-- are ephemeral (generated fresh each visit, no id until a user taps to
-- save one). Keyed by cuisine rather than exact title, since a freshly
-- LLM-generated title essentially never repeats across sessions — "which
-- cuisines get shown a lot but rarely chosen" is the meaningful aggregate,
-- not "was this exact title tapped."

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  cuisine text,
  recipe_title text not null,
  action text not null check (action in ('shown', 'tapped')),
  created_at timestamptz not null default now()
);

create index if not exists recommendation_events_user_id_idx on public.recommendation_events (user_id);
create index if not exists recommendation_events_created_at_idx on public.recommendation_events (created_at desc);

alter table public.recommendation_events enable row level security;

create policy "Users can view their own recommendation events"
  on public.recommendation_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recommendation events"
  on public.recommendation_events for insert
  with check (auth.uid() = user_id);

-- Deliberately no update/delete policy — append-only event log.

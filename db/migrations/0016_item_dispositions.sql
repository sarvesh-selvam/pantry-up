-- Phase 8: an insert-only log of *why* an inventory item left the pantry —
-- consumed, discarded, or genuinely unknown. inventory_items rows are
-- hard-deleted on removal (established Phase 5 pattern: one consistent
-- "how does an item stop being active," not a second archived-status
-- concept), so the reason would otherwise be lost entirely. This table is
-- the minimal thing needed to make "ingredients frequently discarded" a
-- real, derivable signal (product spec, Phase 8 section 1) rather than an
-- unanswerable question.
--
-- Written only from the two places that already carry an honest, specific
-- reason: Kitchen Check-In's leftover/existence responses
-- (lib/checkInResponses.ts) and Pantry's "I ate this" action
-- (app/(tabs)/pantry/index.tsx's confirmAte) — both functionally "this
-- item is gone and here's why," not a guess. Plain Pantry deletes and
-- Finish Cooking's mutation-driven removals are NOT logged here: a manual
-- delete's reason is genuinely ambiguous (added by mistake? expired
-- unnoticed? thrown out?), and cooking consumption already has full
-- provenance via cook_events/inventory_mutations — logging it again here
-- would just duplicate an existing, better signal.

create table if not exists public.item_dispositions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  canonical_food_id uuid references public.canonical_foods (id) on delete set null,
  display_name text not null,
  disposition text not null check (disposition in ('consumed', 'discarded', 'unknown')),
  source text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists item_dispositions_user_id_idx on public.item_dispositions (user_id);
create index if not exists item_dispositions_canonical_food_id_idx on public.item_dispositions (canonical_food_id);
create index if not exists item_dispositions_recorded_at_idx on public.item_dispositions (recorded_at desc);

alter table public.item_dispositions enable row level security;

create policy "Users can view their own item dispositions"
  on public.item_dispositions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own item dispositions"
  on public.item_dispositions for insert
  with check (auth.uid() = user_id);

-- Deliberately no update/delete policy — this is an append-only event log,
-- not a mutable record.

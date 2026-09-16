# PantryUp

A mobile-first, inventory-aware kitchen app.

- **Phase 1: Foundation** — project skeleton, authentication, the canonical
  food model, the inventory database, a manual Pantry screen with full CRUD,
  and a deterministic (non-AI) Quick Add flow.
- **Phase 2: Inventory Intelligence** — real (LLM-backed) ingredient
  normalization, receipt scanning, deterministic expiry estimation, real
  verification/confidence handling, and the Home tab's Rescue Row.
- **Phase 3: Decision Engine** — the "what should I cook" experience:
  Sous Chef (a tool-calling chat assistant), pantry-aware recipe
  generation, recipe-to-inventory matching, and Home's "What should I
  cook?" suggestions.

## Stack

- **Frontend:** React Native + Expo (TypeScript), file-based routing via
  [expo-router](https://docs.expo.dev/router/introduction/)
- **Backend:** [Supabase](https://supabase.com) (Postgres, Auth, Storage,
  Edge Functions)
- **LLM:** [Claude](https://www.anthropic.com/claude) (`claude-opus-5`),
  called only from server-side Edge Functions — never from the client

## Project structure

```
app/              Screens and routes (expo-router)
  (auth)/         Login / signup, shown when signed out
  (tabs)/         Home, Search, Pantry, Cookbook, Macros tabs
    pantry/       Pantry list, add/edit item, Quick Add, Receipt Scan, review
  sous-chef.tsx   Sous Chef chat (modal, reachable from Home)
  recipe/[id]     Recipe detail screen (static — no cooking mode yet)
components/       Shared UI components (incl. RecipeCard, reused by Sous
                   Chef's inline cards and Home's suggestion cards)
constants/        Design tokens (colors, spacing)
lib/              Supabase client, auth/inventory contexts, API helpers,
                   the Quick Add parser, the receipt scanner, and the
                   client-side recipe-to-inventory matching engine
types/            Hand-written types mirroring the Postgres schema
db/migrations/    SQL migrations, applied in filename order
supabase/functions/  Edge Functions (Deno):
                      quick-add-parse, receipt-scan — Phase 2 normalization
                      sous-chef-chat — tool-calling recipe assistant
                      recipe-suggestions — Home's automatic suggestions
                      _shared/ — normalization pipeline, recipe generation,
                      dietary-restriction enforcement, matching engine (Deno
                      port), pantry context loader
```

## Prerequisites

- Node.js 22+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- The [Supabase CLI](https://supabase.com/docs/guides/cli), to deploy the
  Edge Functions
- An [Anthropic API key](https://console.anthropic.com/), for Quick Add,
  Receipt Scan, Sous Chef, and recipe suggestions
- Expo Go app on your phone, or an iOS Simulator / Android Emulator

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy the env template and fill in your Supabase project's URL and anon
   key (Project Settings → API in the Supabase dashboard):

   ```sh
   cp .env.example .env
   ```

   These are `EXPO_PUBLIC_`-prefixed, so Metro inlines them into the app at
   build time. The anon key is meant to be public — it's safe as long as
   Row Level Security is enabled on every table (it is, see below).

3. Apply the database migrations. In the Supabase dashboard, open the SQL
   Editor and run each file in `db/migrations/` **in order**:

   ```
   db/migrations/0001_users.sql
   db/migrations/0002_canonical_foods.sql
   db/migrations/0003_inventory_items.sql
   db/migrations/0004_raw_input_text.sql
   db/migrations/0005_food_storage_rules.sql
   db/migrations/0006_expiry_estimation.sql
   db/migrations/0007_receipts_storage.sql
   db/migrations/0008_recipes.sql
   db/migrations/0009_user_preferences.sql
   ```

   (If you have the Supabase CLI linked to your project — `supabase link` —
   copy these into a `supabase/migrations` folder and run `supabase db
   push` instead.)

   Together these create `users`, `canonical_foods`, `inventory_items`,
   `food_storage_rules`, `recipes`, and `user_preferences`; enable Row
   Level Security everywhere (including a private `receipts` Storage
   bucket scoped to each user's own folder); seed ~70 canonical
   ingredients and ~100 shelf-life reference rows; wire up the
   `users`-profile-on-signup trigger (extended in `0009` to also create an
   empty `user_preferences` row); and install the deterministic, non-LLM
   trigger that computes `expiry_estimated` from `food_storage_rules`
   whenever an item's food/storage/prep/date fields change.

4. In Supabase Auth settings, email/password sign-in is enabled by default.
   If you want to skip email confirmation during local testing, turn off
   "Confirm email" under Authentication → Providers → Email.

5. Deploy the Edge Functions and set your Anthropic key as a **Supabase
   secret** (never a client-side env var — it must never reach the app
   bundle):

   ```sh
   supabase link --project-ref <your-project-ref>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy quick-add-parse
   supabase functions deploy receipt-scan
   supabase functions deploy sous-chef-chat
   supabase functions deploy recipe-suggestions
   ```

   See [Edge Functions](#edge-functions) below for what each one does.

## Running the app

```sh
npm start
```

Then press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR
code with Expo Go.

## Edge Functions

All four live under `supabase/functions/`, sharing common modules in
`supabase/functions/_shared/`. All require `SUPABASE_URL` /
`SUPABASE_ANON_KEY` (auto-injected by the Edge Runtime) and
`ANTHROPIC_API_KEY` (set via `supabase secrets set`, above).
`supabase/functions/deno.lock` pins the resolved `npm:`/`jsr:` dependency
versions for reproducible deploys — commit it like a regular lockfile.

**Phase 2 — normalization** (share `_shared/matching.ts`: builds the
canonical-foods prompt fragment and validates the model's JSON response).
Neither writes to `inventory_items` — both only return suggestions; the
client always routes the result through the Quick Add review/confirm
screen before saving anything.

- **`quick-add-parse`** — input `{ text: string }`. One `claude-opus-5` call
  splits the freeform text into grocery items and matches each against
  `canonical_foods` in a single pass. Behind `lib/quickAddParser.ts`'s
  interface.
- **`receipt-scan`** — input `{ storagePath: string }` (a path already
  uploaded to the private `receipts` Storage bucket). Downloads the image,
  sends it to `claude-opus-5` with vision, and extracts item
  names/quantities/category — explicitly prompted not to extract prices or
  invent items not visible on the receipt. Same matching pipeline as
  `quick-add-parse`.

**Phase 3 — the decision engine** (share `_shared/recipeGeneration.ts`,
`_shared/dietaryRestrictions.ts`, `_shared/recipeMatching.ts` — a Deno port
of `lib/recipeMatching.ts` — and `_shared/pantryContext.ts`). Neither
writes to `recipes` either — the client saves on the user's tap, after
seeing the card.

- **`sous-chef-chat`** — input `{ messages: {role, content}[] }` (full
  text-only history, stateless per request — see the function's header
  comment for why tool calls aren't replayed across turns). Runs a manual
  Claude tool-calling loop with six tools (`get_inventory`,
  `get_rescue_items`, `get_user_preferences`, `generate_recipe`,
  `match_recipe_to_inventory`, `create_shopping_items` — the last is a
  stub, see below) and returns `{ reply, recipe }`.
- **`recipe-suggestions`** — input `{}`. No chat, no tool loop: directly
  calls the same `generate_recipe`/matching pipeline Sous Chef's tools use,
  with rescue items + pantry as implicit context, to produce Home's 3-5
  suggestion cards. Returns `{ recipes: [] }` (not an error) when the
  pantry is empty.

**Dietary restrictions/allergies are a hard constraint, enforced in code —
not just prompted.** `_shared/recipeGeneration.ts`'s `generateRecipes` runs
every candidate recipe's ingredient names through
`_shared/dietaryRestrictions.ts`'s keyword-based `findDietaryViolations`
and discards + regenerates anything that matches (up to 3 attempts),
before a recipe is ever returned to the client. See Known limitations for
what that keyword list does and doesn't cover.

`create_shopping_items` is intentionally a stub — it logs and returns
`{ status: 'not_implemented' }` with no DB writes. The Need to Buy /
shopping list feature is a later phase.

## What's implemented

**Phase 1**
- Email/password auth (sign up, log in, log out, persisted sessions)
- Pantry tab: list grouped by storage location, add/edit/delete items
- Manual entry (name required, everything else optional with sensible
  defaults)
- An orange "?" indicator on any item that isn't confirmed data
  (`verification_status` is `ai_estimated` or `needs_verification`)

**Phase 2**
- Quick Add and Receipt Scan both go through the real, server-side Claude
  normalization pipeline above, always land on a review/confirm screen, and
  preserve the original text/line item in `raw_input_text` — normalization
  never overwrites what the user actually typed or what was on the receipt
- Deterministic expiry estimation: a Postgres trigger (not the LLM) computes
  `expiry_estimated` from the seeded `food_storage_rules` table whenever a
  relevant field changes; items with only an estimated expiry always show
  the orange "?", and the edit screen (`app/(tabs)/pantry/[id].tsx`) shows a
  visually distinct, more urgent style for safety-critical estimates
  (`is_safety_critical`) versus ordinary freshness guidance
- A "Verify" quick-action on any uncertain item's row confirms it in place;
  saving from the edit screen also confirms it
- Home tab's Rescue Row: a horizontally scrollable, purely-derived-from-
  inventory-state row (`lib/rescueRow.ts`) surfacing items expiring within 3
  days, low/almost-empty quantities, and leftovers older than 2 days — no
  recommendation logic, just "what needs attention"

**Phase 3**
- Sous Chef: a real chat interface (`app/sous-chef.tsx`, opened from Home's
  entry bar) backed by `sous-chef-chat`'s tool-calling loop — asks for a
  recipe idea in your own words, gets one grounded in real inventory/rescue
  data, with an inline recipe card and a "why this works" explanation
- Home's "What should I cook?" section: 3-5 automatic, pantry-aware
  suggestion cards from `recipe-suggestions`, no chat required
- Recipe-to-inventory matching (`lib/recipeMatching.ts`, reused by both
  card renderers and the recipe detail screen): every ingredient
  classified as Already Have / Verify / Missing against real inventory,
  with a "X of Y ingredients" pantry coverage label
- Tapping any recipe card saves it to `recipes` and opens the detail screen
  (`app/recipe/[id].tsx`), which re-runs the matching engine live against
  current inventory rather than trusting the saved snapshot
- Dietary restrictions/allergies are structurally enforced — see Edge
  Functions above — not just prompted

Search, Cookbook, and Macros are still placeholder "Coming soon" screens —
their functionality lands in later phases. Recipes can be viewed but not
yet cooked (no timers, no cooking mode, no inventory deduction) — that's
Phase 4.

## Known limitations

- Shelf-life figures in `food_storage_rules` are hand-curated
  approximations of commonly published USDA FoodKeeper guidance, not a
  verbatim FoodKeeper export — validate before relying on them for real
  food-safety decisions.
- `food_storage_rules` coverage isn't exhaustive: only the realistic/common
  storage-location + preparation-state combinations per ingredient are
  seeded (e.g. most "leftover" rows only exist for proteins and cooked
  grains). An item with no matching rule simply gets no expiry estimate —
  by design (no data beats an invented guess), but it does mean some valid
  combinations won't show an estimate yet.
- Dietary restriction enforcement (`_shared/dietaryRestrictions.ts`) is a
  curated keyword list for a common set of restrictions (vegetarian,
  vegan, pescatarian, gluten-free, dairy-free, nut-free, shellfish-free,
  egg-free) — not exhaustive, and matches on ingredient display-name text
  rather than a verified allergen database. An unrecognized restriction
  string still reaches the model as a soft prompt instruction but isn't
  structurally checked. Do not treat this as a substitute for real
  allergen safety review before this handles anyone's actual dietary needs.
- `user_preferences` has no editing UI yet — every user gets an empty row
  (no restrictions, no cuisine weights, `skill_level: 'intermediate'`) via
  the signup trigger. `get_user_preferences` and recipe generation both
  work correctly against that empty state; a preferences screen is a later
  phase.
- Recipe-to-inventory quantity matching (`lib/recipeMatching.ts` /
  `_shared/recipeMatching.ts`) sums quantities only when units match via a
  small synonym table (same limitation as Phase 1's Quick Add parser) — no
  lb↔oz or metric↔imperial conversion. A mismatched-unit match falls back
  to "Verify" rather than guessing a conversion.
- Sous Chef's chat history is client-side only and text-only between
  turns — closing the chat loses the conversation, and each turn re-fetches
  fresh inventory/rescue/preference data rather than replaying prior tool
  results (intentional — see `sous-chef-chat`'s header comment — but it
  does mean the model can't literally "remember" a tool result verbatim
  from three turns ago, only what its own prior text said).

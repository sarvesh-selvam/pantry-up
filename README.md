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
- **Phase 4: Cooking Loop** — Cooking Mode with step timers, a
  confirm-before-mutate inventory deduction flow, leftovers, and cook
  History. This is the first phase where the full core loop (Capture →
  Understand → Rescue → Decide → Cook → Reconcile) works end to end.
- **Phase 5: Reconciliation** — Kitchen Check-In: a deterministic
  staleness/uncertainty scoring function surfaces a small, capped batch of
  genuinely-in-doubt items, reviewed via a fast tap-through card flow that
  repairs pantry drift without ever asking about the whole pantry.
- **Phase 6: Cookbook and Nutrition** — a real Cookbook tab (favorites,
  manual entry, cookbook page scanning, all through the review-before-save
  pattern), a deterministic nutrition calculation service backed by seeded
  USDA-derived reference data (never LLM-invented), and consumption-
  triggered macro logging (finishing a cook, or eating a leftover) feeding
  Home's compact macro rings and a real Macros tab.
- **Phase 7: Visual Assistance** — live YouTube technique-video search: an
  LLM identifies a recipe's single key technique (its only job), a real
  YouTube Data API call finds demonstrations for it, and the cached result
  surfaces on the recipe detail screen's "Watch" section, inline on Sous
  Chef's chat cards, and on Cooking Mode's previously-empty per-step video
  slots.
- **Phase 8: Personalization** — a real Settings screen for cuisine/dietary/
  equipment preferences, and a deterministic multi-signal scoring function
  (pantry coverage, rescue urgency, cuisine preference, stated time limit,
  equipment owned, novelty/repetition from cook history) that ranks Home's
  suggestions and Sous Chef's recipe — never an LLM judgment call, so ranking
  stays inspectable. "Why this works" is now grounded in the actual score
  breakdown instead of trusting LLM prose alone; dietary restrictions remain
  a hard pre-filter that behavioral learning can never touch.

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
  (tabs)/         Home, Pantry, Cook, Nutrition tabs
    pantry/       Pantry list, add/edit item, Quick Add, Receipt Scan, review
    cookbook/     The Cook tab: Suggested (today's 3 AI picks, unsaved
                   until saved), Cookbook (saved recipe grid), History
  suggestion/     Read-only preview of an unsaved daily suggestion
    macros.tsx    Daily macro rings + day-back navigation
  sous-chef.tsx   Sous Chef chat (modal, reachable from Home or mid-cook,
                   optionally grounded in the recipe being cooked)
  recipe/[id]     Recipe detail screen — ingredients live-matched, "Cook This",
                   favorite toggle, per-serving nutrition, "Watch" section
  recipe/[id]/cook     Cooking Mode: step-by-step, timers, inline ingredients,
                        cached technique videos per step
  recipe/[id]/finish   Finish Cooking: servings → mutation proposal →
                        confirm → optional leftovers → consumed-nutrition
                        logging, in that order
  check-in.tsx    Kitchen Check-In (modal, reachable only from Home's
                   entry banner, only when something needs review)
  settings.tsx    Cuisine/dietary/equipment preferences (modal, reachable
                   from Home's gear icon) — the only place user_preferences
                   is ever written
components/       Shared UI components (incl. RecipeCard, reused by Sous
                   Chef's inline cards, Home's suggestion cards, and
                   Cookbook's grid — now also renders deterministic
                   why_bullets; StepTimer and TechniqueVideoSlot for
                   Cooking Mode; CheckInCard/CheckInBanner/KitchenStatusRow
                   for Check-In; MacroRingRow for Home and Macros)
constants/        Design tokens (colors, spacing)
lib/              Supabase client, auth/inventory contexts, API helpers,
                   the Quick Add parser, the receipt scanner, shared image
                   capture (imageCapture.ts), the daily-suggestions cache
                   (suggestions/DailySuggestionsContext.tsx), the client-side
                   recipe-to-inventory matching engine, the deterministic
                   nutrition calculation service (nutritionCalculation.ts)
                   and consumption logging (nutritionLogging.ts), the
                   inventory mutation proposal engine (cookingMutations.ts),
                   Check-In's staleness scoring + response handling
                   (checkInScoring.ts, checkInResponses.ts), the
                   recipe-videos client (api/youtube.ts) and its dumb
                   step/technique keyword matcher (matchTechniqueToStep.ts),
                   the curated Settings option lists (preferenceOptions.ts),
                   and pure behavioral-signal derivation functions
                   (behavioralSignals.ts)
  cookbook/CookbookScanContext.tsx   scan-draft handoff, scoped to the
                   Cookbook stack (same pattern as quickAddDraft)
types/            Hand-written types mirroring the Postgres schema
db/migrations/    SQL migrations, applied in filename order
supabase/functions/  Edge Functions (Deno):
                      quick-add-parse, receipt-scan — Phase 2 normalization
                      sous-chef-chat — tool-calling recipe assistant,
                      optionally grounded in a recipe being cooked
                      recipe-suggestions — Home's automatic suggestions,
                      now ranked by the deterministic scoring formula
                      cookbook-scan — vision-extracts title/ingredients/
                      instructions from a cookbook photo, nothing invented
                      recipe-videos — identifies a recipe's key technique
                      (LLM), then a real YouTube Data API search for it
                      _shared/ — normalization pipeline, recipe generation,
                      dietary-restriction enforcement, matching engine (Deno
                      port), pantry context loader (now also cook history
                      + equipment), nutrition calculation (Deno port),
                      YouTube search wrapper, technique identification, the
                      recommendation scoring engine (+ its own deno tests)
```

## Prerequisites

- Node.js 22+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- The [Supabase CLI](https://supabase.com/docs/guides/cli), to deploy the
  Edge Functions
- An [Anthropic API key](https://console.anthropic.com/), for Quick Add,
  Receipt Scan, Sous Chef, and recipe suggestions
- A [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
  key (Google Cloud Console — enable the API, then create an API key), for
  Phase 7's technique video search. The default free quota is small
  (10,000 units/day, 100 per search call) — see Known limitations
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
   db/migrations/0010_cook_events.sql
   db/migrations/0011_inventory_source_cooking.sql
   db/migrations/0012_recipes_favorite.sql
   db/migrations/0013_nutrition_data.sql
   db/migrations/0014_daily_nutrition.sql
   db/migrations/0015_inventory_source_recipe_link.sql
   db/migrations/0016_item_dispositions.sql
   db/migrations/0017_recommendation_events.sql
   db/migrations/0018_recipes_equipment_needed.sql
   db/migrations/0019_shopping_items.sql
   db/migrations/0020_inventory_source_shopping_list.sql
   ```

   (If you have the Supabase CLI linked to your project — `supabase link` —
   copy these into a `supabase/migrations` folder and run `supabase db
   push` instead.)

   Together these create `users`, `canonical_foods`, `inventory_items`,
   `food_storage_rules`, `recipes`, `user_preferences`, and `cook_events`;
   enable Row Level Security everywhere (including a private `receipts`
   Storage bucket scoped to each user's own folder); seed ~70 canonical
   ingredients and ~100 shelf-life reference rows; wire up the
   `users`-profile-on-signup trigger (extended in `0009` to also create an
   empty `user_preferences` row); install the deterministic, non-LLM
   trigger that computes `expiry_estimated` from `food_storage_rules`
   whenever an item's food/storage/prep/date fields change; and add
   `'cooking'` to the `inventory_source` enum (its own migration —
   `0011` — since Postgres won't let a new enum value be used in the same
   transaction that adds it) for leftovers created from Cooking Mode.

   `0012`-`0015` (Phase 6) add `recipes.is_favorite`; a `nutrition_data`
   table seeded with per-100g calories/protein/carbs/fat for every
   canonical food (sourced from USDA FoodData Central figures — see Known
   limitations for what "sourced from" means here); a `daily_nutrition`
   table plus the `increment_daily_nutrition` Postgres function consumption
   logging writes through (a plain PostgREST upsert can't express "add to
   today's total," only replace it); and `inventory_items.source_recipe_id`
   so eating a leftover can trace back to the recipe it was cooked from.

   `0016`-`0018` (Phase 8) add `item_dispositions` (an insert-only log of
   why an item left the pantry — consumed/discarded/unknown, since
   hard-deleted rows would otherwise lose that reason entirely);
   `recommendation_events` (Home suggestions shown vs. saved); and
   `recipes.equipment_needed` (a controlled-vocabulary tag, always empty
   for manual/scanned recipes).

   `0019`-`0020` (Shopping list) add `shopping_items` (one flat Need to Buy
   list per user, RLS-scoped, no price fields) and `'shopping_list'` to the
   `inventory_source` enum (its own migration, same reason as `0011`).

4. In Supabase Auth settings, email/password sign-in is enabled by default.
   If you want to skip email confirmation during local testing, turn off
   "Confirm email" under Authentication → Providers → Email.

5. Deploy the Edge Functions and set your Anthropic key as a **Supabase
   secret** (never a client-side env var — it must never reach the app
   bundle):

   ```sh
   supabase link --project-ref <your-project-ref>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set YOUTUBE_API_KEY=...
   supabase functions deploy quick-add-parse
   supabase functions deploy receipt-scan
   supabase functions deploy sous-chef-chat
   supabase functions deploy recipe-suggestions
   supabase functions deploy cookbook-scan
   supabase functions deploy recipe-videos
   ```

   See [Edge Functions](#edge-functions) below for what each one does.

## Running the app

```sh
npm start
```

Then press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR
code with Expo Go.

## Edge Functions

All six live under `supabase/functions/`, sharing common modules in
`supabase/functions/_shared/`. All require `SUPABASE_URL` /
`SUPABASE_ANON_KEY` (auto-injected by the Edge Runtime) and
`ANTHROPIC_API_KEY` (set via `supabase secrets set`, above);
`recipe-videos` additionally requires `YOUTUBE_API_KEY`.
`supabase/functions/deno.lock` pins the resolved `npm:`/`jsr:` dependency
versions for reproducible deploys — commit it like a regular lockfile.

None of the six write directly to `inventory_items`, `recipes`,
`cook_events`, or `daily_nutrition` — every one only returns suggestions or
computed values; the client is the only thing that ever persists them, and
only after the user reviews/confirms or (for macro logging) actually
finishes cooking or eats a leftover.

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

- **`sous-chef-chat`** — input `{ messages: {role, content}[], recipeContext?:
  {title, ingredients, instructions} }` (full text-only history, stateless
  per request — see the function's header comment for why tool calls
  aren't replayed across turns). `recipeContext` is set when Sous Chef is
  opened mid-cook (Cooking Mode's "Ask Sous Chef") and is folded into the
  system prompt so answers — substitutions, "what does simmer mean?" — are
  grounded in that specific recipe. Runs a manual Claude tool-calling loop
  with six tools (`get_inventory`, `get_rescue_items`,
  `get_user_preferences`, `generate_recipe`, `match_recipe_to_inventory`,
  `create_shopping_items` — the last is a stub, see below) and returns
  `{ reply, recipe }`.
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

`create_shopping_items` is intentionally still a stub — it logs and
returns `{ status: 'not_implemented' }` with no DB writes. The shopping
list itself exists (Pantry → Need to Buy), but AI-suggested shopping items
are an explicit non-goal of that feature: items only get onto the list
when the user types them or taps "Add Missing to Shopping List" on a
recipe.

**Phase 6 — Cookbook scanning and deterministic nutrition** (shares
`_shared/nutritionCalculation.ts`, a Deno port of
`lib/nutritionCalculation.ts`).

- **`cookbook-scan`** — input `{ storagePath: string }` (uploaded to the
  same private `receipts` bucket Receipt Scan uses, under a
  `<user>/cookbook/` prefix). Downloads the image, sends it to
  `claude-opus-5` with vision, prompted to extract only what's actually on
  the page — title, ingredients (with quantities where legible),
  instructions, nothing else invented. Runs extracted ingredients through
  the same canonical-food matching used everywhere else, then computes
  nutrition server-side via `computeRecipeNutrition` before returning.
  Confidence values on the title/instructions/each ingredient drive a
  deterministic `needs_verification` flag computed server-side (not left to
  the model to self-report) — see Known limitations for the exact
  threshold. Like every other function here, it never writes to `recipes`;
  the client always lands on a review/confirm screen first.

**Nutrition is computed, never guessed by the LLM.** `nutrition_data`
(`db/migrations/0013_nutrition_data.sql`) holds per-100g calories/protein/
carbs/fat for every canonical food. `computeRecipeNutrition` (client:
`lib/nutritionCalculation.ts`; server: `_shared/nutritionCalculation.ts`,
kept in sync manually) sums each ingredient's nutrition scaled by its
quantity — converted to grams only for real weight units (g/kg/oz/lb via
fixed factors) — then divides by servings. An ingredient with no
`canonical_food_id` match, or a quantity in a non-weight unit (cup, clove,
can, ...), is excluded from the sum rather than guessed, and the whole
result is flagged `is_partial: true` so the UI can say so honestly instead
of showing a falsely-precise number. This is wired into recipe generation
(both `sous-chef-chat` and `recipe-suggestions` populate `nutrition` on
every generated recipe) and into manual/scanned saves on the client — but
**never into `daily_nutrition`**. Saving or generating a recipe only
computes and stores a per-serving nutrition estimate on the recipe itself;
only a confirmed consumption event (Finish Cooking, or eating a leftover —
see Known limitations) logs anything to `daily_nutrition`.

**Phase 7 — live technique video search** (shares
`_shared/techniqueIdentification.ts` and `_shared/youtubeSearch.ts`).

- **`recipe-videos`** — input `{ recipe: { title, ingredients: string[],
  instructions: string[] } }` (the same shape `sous-chef-chat`'s
  `recipeContext` already uses). Two steps, in order: (1) one small,
  text-only `claude-opus-5` call identifies the recipe's single most
  important or non-obvious technique — its only job; (2) a real YouTube
  Data API v3 `search` call runs against `"<technique> technique"`, and
  every field in the response (`video_id`, `title`, `channel_title`,
  `thumbnail_url`, `published_at`) comes straight from that API response —
  never invented, never filled in by the model. Returns `{ technique,
  search_query, retrieved_at, results }`. Like every other function here,
  it never writes to `recipes`; the client persists the result after
  getting it back.

**The LLM only ever decides what to search for — it never touches the
actual video data.** This is the same LLM/deterministic split the app uses
everywhere else (nutrition math, recipe-to-inventory matching, expiry
estimation): the model's output feeds into a real, independently-verifiable
system (here, a live API call) rather than being trusted as the final
answer. A genuinely empty `results` array (the search ran, found nothing)
is treated differently from a thrown error (the search couldn't run at
all — bad key, quota exceeded, network failure) — see
`_shared/youtubeSearch.ts`'s header comment.

**Video lookups aren't triggered by every generated recipe — quota, not
laziness.** The YouTube Data API's default free quota is small (10,000
units/day, 100 per search call — effectively ~100 searches/day). Since
`recipe-suggestions` generates 3-5 candidates per Home visit that are
mostly never saved, eagerly searching for all of them would exhaust that
quota almost immediately for an active user. Instead: Sous Chef (one
user-requested recipe at a time) fetches client-side right after the reply
lands; Home's suggestion strip fetches nothing; every recipe (including
Home suggestions, once saved) gets its lookup lazily, once, the first time
its detail screen is opened, then cached on `recipes.youtube_metadata` — no
new migration needed, the column already existed from Phase 3's schema
(`db/migrations/0008_recipes.sql`), just typed as `unknown` until now.

**Phase 8 — personalization ranking, no new Edge Function.** No new
secret, no new function: `recipe-suggestions` and `sous-chef-chat` are
extended in place. `_shared/recommendationScoring.ts` is a deterministic
weighted-sum function — pantry coverage, urgency-weighted rescue score,
explicit cuisine preference nudged (never overwritten) by recent cook
frequency, a stated time limit if one exists, equipment owned, and
novelty/repetition from cook history, minus missing-ingredient and
repetition penalties — called from `_shared/recipePayload.ts`'s
`buildRecipeSuggestionPayload`, the single choke point both entry points
already shared, so the two can't drift into different ranking behavior.
`recipe-suggestions` sorts its four candidates by score before returning;
`sous-chef-chat` computes one recipe's score for explainability (no
sorting needed for a single candidate). `_shared/pantryContext.ts` now
also loads the last 30 days of `cook_events` (joined to `recipes` for
cuisine + ingredient categories) and exposes the user's own equipment
(previously fetched but silently dropped before reaching generation).

**Ranking runs strictly after the hard dietary filter, never instead of
it or before it.** `generateRecipes` (Phase 3) already only returns
recipes that passed `findDietaryViolations`; both `recipe-suggestions`
and `sous-chef-chat` additionally re-run that same check defensively
right before scoring, as a belt-and-suspenders verification that the
invariant actually held, not the primary enforcement. Every write to
`user_preferences` (including `dietary_restrictions`) goes through
exactly one path — the Settings screen's `updateUserPreferences` — audited
by grep; there is no behavioral-learning code path that could silently
alter a hard constraint. See Known limitations for what "verify" meant in
an environment with no test framework: two new Deno test files
(`_shared/dietaryRestrictions.test.ts`, `_shared/
recommendationScoring.test.ts`, runnable via `deno test`) pin down the
properties that matter — violations are flagged/not-flagged correctly,
an honestly-neutral term stays neutral, repetition nudges rather than
dominates.

**"Why this works" is now grounded in the score, not LLM narration.**
`buildWhyBullets` (`_shared/recommendationScoring.ts`) generates plain
strings straight from the score breakdown's real numbers — "Uses spinach,
which needs to be used soon," "You have 9 of 10 ingredients already,"
"Fits your request for under 30 minutes" — never asked of or trusted from
the model. `RecipeCard` and the recipe detail screen render these bullets
when present, falling back to the old free-text `why_this_works` for
recipes saved before Phase 8 or manual/scanned recipes that never went
through scoring.

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

**Phase 4**
- Cooking Mode (`app/recipe/[id]/cook.tsx`): one step at a time, prev/next
  navigation, a countdown timer wherever a step's text implies a duration
  (`lib/parseStepDuration.ts`), inline ingredient quantities for that step
  (`lib/matchIngredientsToStep.ts`), a technique-video slot (placeholder —
  real lookup is Phase 7), and "Ask Sous Chef" grounded in the recipe
  currently being cooked
- Finish Cooking (`app/recipe/[id]/finish.tsx`): asks servings made/eaten,
  proposes specific inventory deductions from specific matched
  `inventory_items` (`lib/cookingMutations.ts` — deterministic, no LLM),
  shown as an editable/uncheckable checklist. **Nothing is deducted until
  the user taps "Update Pantry"** — no silent decrementing, hard rule.
  Precise-quantity items are reduced or removed if fully used;
  approximate-state items step down one level (Full → Mostly Full → Half →
  Low → Almost Empty, floored at Almost Empty rather than disappearing)
- If servings made > servings eaten, offers to save the difference as a new
  `leftover` inventory item (`source: 'cooking'`) in the fridge — appears
  in Pantry immediately and becomes Rescue-Row-eligible once it's 2+ days
  old, same aging rule as any other leftover
- Every completed cook creates a `cook_events` row (servings, applied
  mutations, any leftovers created) — originally shown in a History list
  on the Search tab, which has since been removed (see Known limitations)
- Verified no regression: opening, generating, and saving a recipe still
  never touch inventory — only a confirmed "Update Pantry" tap does (see
  Known limitations for how this was checked)

**Phase 5**
- Deterministic staleness/uncertainty scoring (`lib/checkInScoring.ts`) —
  no new migrations this phase; every signal it uses (`verification_status`,
  `last_verified_at`, `expiry_estimated`/`expiry_user_provided`,
  `preparation_state`, `quantity_confidence`) already existed. Most items
  score 0 and never surface — see Known limitations for the exact
  thresholds and why they're centralized in one place
- `app/check-in.tsx` — a fast, tap-through card flow (not a form): one item
  at a time, response buttons that apply immediately (tapping a response
  *is* the confirmation, unlike Cooking Mode's separate propose/confirm
  split), capped to a small batch per session
  (`CHECK_IN_THRESHOLDS.batchSize`)
- Three prompt variants chosen per item by a small decision function
  (`determinePromptType`, not hardcoded per item): existence (Gone / Still
  Here / Frozen), approximate quantity (Empty / Low / Half / Mostly Full /
  Full), and leftover-specific (Discarded / Ate It / Still Here)
- "Gone" / "Discarded" / "Ate It" delete the item outright — the same
  pattern Phase 4's cooking mutations use for fully-consumed items, so
  there's one consistent answer to "how does an item stop being active,"
  not two. Every other response confirms in place (`verification_status:
  'confirmed'`, fresh `last_verified_at`), which is what clears the orange
  "?" everywhere — Pantry, Rescue Row, recipe matching — since they all
  derive from the same `useInventory().items` state Check-In writes
  through the same `editItem`/`removeItem` methods every other screen uses
- Home gained a compact `KitchenStatusRow` (item count / needing check-in /
  uncertain — three numbers, not a dashboard) and a `CheckInBanner` that's
  simply absent, not a zero-state, when nothing needs review. Check-In
  never auto-launches — the banner is the only entry point, always tapped

**Phase 6** (manual entry and Cookbook Scan were later removed from the
client, and the Favorites filter dropped — see Known limitations)
- Cookbook tab (`app/(tabs)/cookbook/`): a real 2-column grid of every
  saved recipe — AI-generated (Sous Chef/Home), manual, and cookbook-scanned
  all show up together — with a Favorites filter chip and a favorite-star
  toggle on each card, live "X of Y ingredients" pantry coverage computed
  the same way Home's suggestion cards do, and the same coverage/nutrition
  on the recipe detail screen
- Manual Recipe Entry (`cookbook/add.tsx`): a two-stage form → review flow
  — ingredients typed as free text go through the same `parseQuickAddText`
  normalization Quick Add uses, so they resolve to `canonical_food_id`
  where possible before saving with `source_type: 'manual'`
- Cookbook Scan (`cookbook/scan.tsx` + `scan-review.tsx`): reuses Receipt
  Scan's camera/photo-picker infrastructure (`lib/imageCapture.ts`,
  extracted this phase) and the same private Storage bucket, sends the
  photo to `cookbook-scan` for vision extraction, and requires a
  review/confirm step before saving as `source_type: 'cookbook_scan'` —
  low-confidence fields (per-ingredient and whole-recipe) get the same
  orange "?" `UncertaintyBadge` pattern used everywhere else in the app
- Deterministic nutrition (`lib/nutritionCalculation.ts` /
  `_shared/nutritionCalculation.ts`): per-serving calories/protein/carbs/fat
  computed from seeded `nutrition_data`, never LLM-invented — see Edge
  Functions above for the full algorithm and the honest-partial-estimate
  rule. Shown on the recipe detail screen with a disclaimer when partial
- Macro logging only on confirmed consumption: Finish Cooking
  (`recipe/[id]/finish.tsx`) computes `nutrition_consumed` from
  `servings_consumed` and logs it to `daily_nutrition` right before writing
  the `cook_event`; eating a leftover (Check-In's "Ate It", or Pantry's new
  "I ate this" action on any `leftover` item) logs the same way via
  `lib/nutritionLogging.ts`, tied back to the leftover's `source_recipe_id`
  when traceable. Recipe generation and every save path (manual, scanned,
  AI-suggested) never logs nutrition — only a real consumption event does
- Macros tab (`app/(tabs)/macros.tsx`): real ring-style badges
  (`components/MacroRingRow.tsx`) for the day's logged totals, plus simple
  day-back navigation; Home gained a compact version of the same rings at
  the top of the screen, both reading from the same `daily_nutrition` table

**Phase 7**
- Live YouTube technique search (`recipe-videos`): an LLM identifies a
  recipe's key technique, a real YouTube Data API call searches for it —
  see Edge Functions above for the full LLM/real-data boundary and why
  results aren't fetched eagerly for every generated candidate
- Recipe detail's "Watch" section (`app/recipe/[id].tsx`): lazily fetches
  and caches results the first time a saved recipe is opened
  (`recipes.youtube_metadata`), with a manual refresh action and a muted
  "no videos found yet" state instead of an error when there's nothing to
  show
- Cooking Mode's previously-empty video slots (`TechniqueVideoSlot.tsx`)
  now render the recipe's cached videos — relabeled ("This step: ...") when
  a dumb keyword check (`lib/matchTechniqueToStep.ts`) thinks the current
  step matches the recipe's technique, otherwise still shown as a
  persistent small section per spec rather than forcing per-step precision
- Sous Chef's inline chat recipe card (`RecipeCard`, full variant) shows a
  compact 1-2 thumbnail preview once the client-side lookup for that one
  generated recipe resolves — Home's compact card variant and Cookbook's
  grid don't show video previews (not required by spec, and consistent
  with the quota-conscious "don't fetch for unsaved candidates" decision)

**Phase 8**
- Settings screen (`app/settings.tsx`, reachable from Home's gear icon):
  the only place `user_preferences` is ever written — skill level, dietary
  restrictions, equipment, and three-tier (Avoid/Neutral/Favorite) cuisine
  preferences, all previously populated only by an empty signup-trigger
  default with zero write path anywhere in the app
- Deterministic multi-signal recommendation scoring
  (`_shared/recommendationScoring.ts`) ranks Home's four suggestion
  candidates and computes an inspectable score for Sous Chef's — pantry
  coverage, urgency-weighted rescue score, cuisine preference (explicit
  weight nudged, never overwritten, by recent cook frequency), a stated
  time limit if one exists, equipment owned, and novelty/repetition from
  cook history, minus missing-ingredient and repetition penalties
- "Why this works" bullets (`buildWhyBullets`) are generated straight from
  the score breakdown's real numbers, not LLM narration — rendered on
  `RecipeCard`'s full variant and the recipe detail screen, falling back
  to the old free-text explanation for pre-Phase-8 or manual/scanned
  recipes that never went through scoring
- Behavioral signal tracking: `item_dispositions` logs why an inventory
  item left the pantry (Check-In's Gone/Ate It/Discarded, Pantry's "I ate
  this"), `recommendation_events` logs Home suggestions shown vs. saved,
  and `lib/behavioralSignals.ts` adds pure derivation functions for the
  signals the product spec calls out — see Known limitations for exactly
  which of these feed the score today versus exist as real, correct
  signals without being force-fit into a formula that doesn't name them
- Dietary restrictions/allergies remain a hard pre-filter verified to
  precede ranking (audited by grep, backed by two new Deno test files —
  see Edge Functions above) — behavioral learning has no code path that
  could alter them, only an explicit Settings edit can

### Shopping list

- Pantry has an **In Kitchen / Need to Buy** toggle. Need to Buy is one
  flat list (`shopping_items`), grouped by food category with an
  Uncategorized group for free-text items and a Checked group at the
  bottom
- Typed items try for a canonical-food match (exact name/alias first,
  then the same `quick-add-parse` function Quick Add uses), but a failed
  match never blocks saving — the item just lands in Uncategorized
- Recipe detail shows **Add Missing to Shopping List** whenever the live
  matching engine finds Missing ingredients; it dedupes against unchecked
  list items and always says what happened ("3 items added", "Already on
  your list")
- Checking an item off only toggles `is_checked` — no inventory side
  effects. **Review & Add to Pantry** is the only path into
  `inventory_items`: per-item quantity, storage location, and
  include/skip, then confirmed items become new `source: 'shopping_list'`
  inventory rows and are deleted from the list, while skipped ones go
  back to unchecked

## Known limitations

- The shopping list's Review & Add to Pantry always creates a *new*
  inventory row per item rather than merging quantities into an existing
  row for the same food. Deliberate: each purchase keeps its own
  `purchased_at` and so its own expiry estimate, instead of a fresh carton
  inheriting an older one's expiry. It does mean the same food can show up
  as two rows in Pantry.

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
- The tab bar is Home, Pantry, Cook, Nutrition. Cook has three sub-views:
  Suggested, Cookbook, History (cook History moved here from the removed
  Search tab).
- Daily suggestions are capped at 3 and generated once per local day,
  cached on-device (AsyncStorage). They're only written to `recipes` when
  the user saves one, and reinstalling the app or switching devices
  regenerates that day's set.
- Manual recipe entry and Cookbook Scan are removed from the app for now.
  The `cookbook-scan` Edge Function is still deployed with no client
  caller, and previously saved manual/scanned recipes still show in the
  Cookbook.
- No regression check for "generate/save/open a recipe never touches
  inventory" is a manual code-path audit (`grep` for every
  `editItem`/`removeItem`/`addItem` call site), not an automated test —
  this repo has no test suite yet. The audit found exactly the expected
  call sites: Pantry's own CRUD screens (pre-existing) and
  `recipe/[id]/finish.tsx` (this phase, behind the "Update Pantry"
  confirmation) — nothing in recipe generation, viewing, or saving.
- `proposeInventoryMutations` (`lib/cookingMutations.ts`) scales
  quantity-mode deductions by `servingsPrepared / recipe.servings`, but
  state-mode step-downs (Full → Mostly Full, etc.) are servings-agnostic —
  "used some of the half-full jar" doesn't have a meaningful linear scale.
  When multiple inventory items match one ingredient with only a
  `quantity_state` (no numeric quantity), only the first matched item is
  stepped down; picking how to split a state-based "some of it" across
  several packages isn't meaningful without real quantities.
- Cooking Mode's per-step timer and ingredient-inline matching are both
  regex/substring heuristics (`extractStepDurationSeconds`,
  `findIngredientsInStep`) — good enough for "where applicable," not a
  recipe-instruction parser. A step like "reduce heat and cook 5-7 more
  minutes, stirring occasionally" gets a timer; oddly-phrased durations may
  not.
- No swipe gestures in Cooking Mode — Previous/Next are buttons only,
  consistent with the rest of the app's approach to gesture-vs-button
  tradeoffs (see Pantry's delete-by-button instead of swipe, Phase 1).
- Check-In is tap-button-based, not swipe-based, for the same reason
  (spec explicitly allowed either). No gesture library work was needed.
- Check-In's scoring thresholds (`lib/checkInScoring.ts`'s
  `CHECK_IN_THRESHOLDS`) are reasonable starting guesses, not tuned against
  real usage — `staleDays: 4`, `leftoverStaleDays: 2`,
  `expiryProximityDays: 3`, `minimumScore: 30`, `batchSize: 6`. They're
  centralized in one exported constant specifically so they're easy to
  retune later without touching the scoring logic itself.
- A Check-In session snapshots its batch once at screen mount
  (`useState(() => getCheckInBatch(items))`) rather than recomputing live —
  intentional (a session shouldn't reshuffle under the user mid-review),
  but it does mean an item that becomes newly stale *during* an active
  session won't appear until the next session.
- State-mode staleness scoring and Cooking Mode's state-mode mutations
  (Phase 4) both step through the same `QuantityState` progression but
  don't share a threshold/weighting model — Check-In's "how stale before
  flagging" and cooking's "how far to step down" are independent concerns
  answered independently; no code duplication issue, just worth knowing
  they're not the same knob.
- Section 5's verification (items resolved via Check-In correctly drop out
  of Rescue Row/matching/uncertainty badges) was a manual code-path
  read-through, not a runtime test — same "no test suite yet, no
  device/simulator in this environment" constraint as every prior phase's
  regression checks. The claim rests on all three consumers deriving
  reactively from the same `useInventory().items` state that Check-In
  mutates through the exact same `editItem`/`removeItem` methods every
  other screen already uses — there is no parallel code path that could
  diverge, which is a stronger guarantee than "we tested it once," but
  it's still not the same as having actually run it.
- `nutrition_data`'s per-100g figures are hand-curated approximations
  informed by commonly published USDA FoodData Central values, not a
  verbatim FoodData Central export/API pull — same caveat as
  `food_storage_rules`' shelf-life figures, and same reasoning (validate
  before relying on this for real dietary decisions, e.g. medical macro
  tracking).
- Nutrition math converts only real weight units (g/kg/oz/lb, via fixed
  factors) to grams. Count-ish units (cup, clove, can, tbsp, ...) are
  excluded from the sum entirely rather than guessed at a conversion — same
  "no data beats an invented number" stance as recipe-to-inventory matching
  (Phase 3) and cooking mutations (Phase 4). This is a meaningful source of
  `is_partial: true` recipes, not just unmatched ingredients.
- `cookbook-scan` computes `needs_verification` for the *whole recipe* from
  a threshold on title/instructions/ingredient confidence
  (`LOW_CONFIDENCE_THRESHOLD = 0.5`), plus a per-ingredient orange "?" for
  any ingredient below that same threshold — there's no separate
  per-field (title vs. instructions) indicator beyond that. A recipe with
  one low-confidence line still needs full review, not just that line.
- The `Functions` field of `types/database.ts`'s `Database` type can't use
  the same `Record<string, never>` empty-schema shortcut `Views`/`Enums`/
  `CompositeTypes` use — `@supabase/supabase-js` resolves `.rpc()`'s params
  type to `undefined` for any function typed that way. Any new RPC function
  needs a real `{ Args: {...}; Returns: T }` entry in `Functions`, not the
  shortcut. Discovered adding `increment_daily_nutrition`; see CLAUDE.md's
  Gotchas.
- Eating a leftover doesn't prompt "how many servings did you eat?" as the
  spec's literal wording suggested — it defaults to the leftover's full
  remaining `quantity_value` as servings consumed (reasoned as: "Ate It"/
  removing the item means it's gone now, so what was left is what was
  eaten). A servings-count prompt would have added a step Check-In's
  "tapping a response IS the confirmation" design (Phase 5) deliberately
  avoids. Eating a leftover also never creates a new `cook_events` row —
  no new cooking happened, so only `daily_nutrition` updates directly.
- Consumption logging for a leftover with no `source_recipe_id` (or whose
  source recipe has no computed `nutrition`) is silently skipped, not
  logged as some fabricated "standalone" entry — consistent with every
  other "no data beats a guess" decision in this app, at the cost of
  under-counting nutrition for leftovers that predate this phase or that
  were added by some path other than Cooking Mode.
- The macro rings (`components/MacroRingRow.tsx`) are plain colored-border
  circular badges showing raw totals, not true percent-of-goal progress
  fills — there's no calorie/macro target data model in this phase (no
  personalization was scoped), so a fill percentage would either be
  meaningless or silently imply a target the app never actually set. No
  new dependency (`react-native-svg`) was added for this reason.
- YouTube technique video results are only fetched eagerly for Sous
  Chef's one inline chat card per turn and lazily on first recipe-detail
  view — never for Home's 3-5 suggestion candidates, which mostly go
  unsaved. This is a deliberate quota-driven scope cut (the YouTube Data
  API's default free tier is ~100 searches/day), not an oversight — see
  the Edge Functions section above for the full reasoning. A heavy user
  opening many new recipe detail screens in one day can still exhaust the
  quota; `recipe-videos` surfaces that as a thrown error, which the client
  treats the same as "no results" (a muted empty state, never a scary
  error banner) per spec, so a quota exhaustion is currently
  indistinguishable in the UI from a genuinely fruitless search.
- Cooking Mode's per-step technique match (`lib/matchTechniqueToStep.ts`)
  is a dumb keyword-overlap check, not real NLP — same "deliberately not
  smarter than that" philosophy as `matchIngredientsToStep.ts`. Most steps
  won't obviously match the recipe's identified technique phrase; when
  none do, the recipe's cached videos still show as a persistent small
  section throughout Cooking Mode rather than attaching to a specific
  step, which is what spec explicitly allows as the fallback.
- The single technique identified per recipe (`_shared/
  techniqueIdentification.ts`) is one LLM judgment call, not validated
  against what a cook would actually consider "the" key technique — a
  recipe with two equally important techniques only gets videos for
  whichever one the model picked. No per-technique or per-step video
  identification was built (out of scope, and would multiply the API
  quota cost described above).
- Video results are cached indefinitely once fetched (manual refresh is
  the only way to update them) — there's no automatic staleness check
  (e.g. re-searching after N months), so a very old cached result is never
  proactively refreshed on its own.
- Of the six behavioral signals the product spec calls out in Phase 8
  section 1, only two are actually wired into the ranking score: cuisines
  frequently cooked (feeds `preference_match`'s behavioral nudge) and
  recent cook history broadly (feeds `novelty_score`/
  `recent_meal_repetition_penalty`). The other four — recipes saved but
  never cooked, ingredients frequently discarded, average cooking time,
  and frequently skipped suggestions — are implemented as real, correct
  derivation functions (`lib/behavioralSignals.ts`) and, for the two that
  needed one, a real backing table (`item_dispositions`,
  `recommendation_events`), but aren't force-fit into the scoring
  formula, because the product spec's own formula (section 3) doesn't
  name them as score terms. No dedicated "Insights" UI surfaces them
  either — that wasn't in this phase's Definition of Done. A future phase
  could wire either in without new data collection.
- `macro_match` is a constant 0.5 (neutral) for every recipe — there's no
  stated macro/nutrition goal anywhere in `user_preferences` to compare a
  recipe's nutrition against (Phase 6 deliberately didn't fabricate one,
  and this phase didn't add macro-goal onboarding either, since it wasn't
  asked for). Scoring it as anything other than neutral would mean
  inventing a preference nobody stated — the formula's full shape (all
  nine terms from the product spec) is still implemented and visible in
  `score_breakdown`, just honestly inert for this one term until a real
  macro-goal input exists.
- `equipment_needed` is only ever populated by the LLM at generation time
  (Sous Chef, Home suggestions) — manual and cookbook-scanned recipes
  always get an empty array (no equipment requirement inferred), which
  `equipment_match` treats as a full match rather than a penalty. This is
  the honest default (no data beats a guess), but it does mean
  `equipment_match` is currently a no-op for every non-generated recipe.
- The cuisine list on the Settings screen (`lib/preferenceOptions.ts`'s
  `CUISINE_OPTIONS`) is a fixed 10-cuisine picker, not a free-text field
  or a list derived from what's actually been generated/cooked — a
  cuisine a recipe uses that isn't in this list can still be scored (via
  `cuisineWeights`' neutral 0.5 default and the behavioral nudge) but has
  no way to get an explicit user-set weight.
- The `recommendation_events`/`item_dispositions` tables and their
  behavioral-nudge math have never run against real usage data (same
  "no Supabase CLI/Docker/device in this environment" constraint as every
  prior phase) — the scoring formula's weights and the
  `MAX_BEHAVIORAL_PREFERENCE_NUDGE`/repetition-window constants in
  `_shared/recommendationScoring.ts` are reasoned-through defaults, not
  tuned against how real cooking behavior actually distributes.
- Building a "rank my saved Cookbook recipes too" feature was explicitly
  scoped out — the product spec's section 3 mentions candidates "whether
  freshly LLM-generated or pulled from Cookbook" as describing the
  scoring function's general applicability, but the Definition of Done
  only requires Home's suggestions and Sous Chef's recipe to be ranked.
  `recommendationScoring.ts` is written generically enough that a future
  phase could score Cookbook recipes with it, but nothing calls it there
  today, and no audit of "does ranking respect a Cookbook recipe's
  possibly-stale dietary compliance" was needed as a result.

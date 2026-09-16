# PantryUp

A mobile-first, inventory-aware kitchen app.

- **Phase 1: Foundation** — project skeleton, authentication, the canonical
  food model, the inventory database, a manual Pantry screen with full CRUD,
  and a deterministic (non-AI) Quick Add flow.
- **Phase 2: Inventory Intelligence** — real (LLM-backed) ingredient
  normalization, receipt scanning, deterministic expiry estimation, real
  verification/confidence handling, and the Home tab's Rescue Row.

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
components/       Shared UI components
constants/        Design tokens (colors, spacing)
lib/              Supabase client, auth/inventory contexts, API helpers,
                   the Quick Add parser, and the receipt scanner
types/            Hand-written types mirroring the Postgres schema
db/migrations/    SQL migrations, applied in filename order
supabase/functions/  Edge Functions (Deno) — quick-add-parse, receipt-scan,
                      and their shared normalization pipeline in _shared/
```

## Prerequisites

- Node.js 22+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- The [Supabase CLI](https://supabase.com/docs/guides/cli), to deploy the
  Edge Functions
- An [Anthropic API key](https://console.anthropic.com/), for Quick Add and
  Receipt Scan
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
   ```

   (If you have the Supabase CLI linked to your project — `supabase link` —
   copy these into a `supabase/migrations` folder and run `supabase db
   push` instead.)

   Together these create `users`, `canonical_foods`, `inventory_items`, and
   `food_storage_rules`; enable Row Level Security everywhere (including a
   private `receipts` Storage bucket scoped to each user's own folder);
   seed ~70 canonical ingredients and ~100 shelf-life reference rows; wire
   up the `users`-profile-on-signup trigger; and install the deterministic,
   non-LLM trigger that computes `expiry_estimated` from
   `food_storage_rules` whenever an item's food/storage/prep/date fields
   change.

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
   ```

   See [Edge Functions](#edge-functions) below for what each one does.

## Running the app

```sh
npm start
```

Then press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR
code with Expo Go.

## Edge Functions

Both live under `supabase/functions/` and share a normalization pipeline in
`supabase/functions/_shared/` (`matching.ts` builds the canonical-foods
prompt fragment and validates the model's JSON response — the actual code
reuse between the two entry points). **Neither function writes to
`inventory_items`** — each only returns suggestions; the client always
routes the result through the Quick Add review/confirm screen before saving
anything.

- **`quick-add-parse`** — input `{ text: string }`. One `claude-opus-5` call
  splits the freeform text into grocery items and matches each against
  `canonical_foods` in a single pass. Replaces Phase 1's deterministic
  regex/Levenshtein parser behind the same `lib/quickAddParser.ts`
  interface.
- **`receipt-scan`** — input `{ storagePath: string }` (a path already
  uploaded to the private `receipts` Storage bucket). Downloads the image,
  sends it to `claude-opus-5` with vision, and extracts item
  names/quantities/category — explicitly prompted not to extract prices or
  invent items not visible on the receipt. Runs the result through the same
  matching prompt/response-validator as `quick-add-parse`.

Both require `SUPABASE_URL` / `SUPABASE_ANON_KEY` (auto-injected by the Edge
Runtime) and `ANTHROPIC_API_KEY` (set via `supabase secrets set`, above).
`supabase/functions/deno.lock` pins the resolved `npm:`/`jsr:` dependency
versions for reproducible deploys — commit it like a regular lockfile.

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

Home, Search, Cookbook, and Macros beyond the Rescue Row are still
placeholder "Coming soon" screens — their remaining functionality lands in
later phases.

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
